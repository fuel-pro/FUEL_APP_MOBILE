/**
 * live-caption-engine.ts — on-device live caption generation + translation
 * for streams that carry NO embedded subtitle tracks.
 *
 * Fully free, no API keys, no server: captures the playing media element's
 * audio (captureStream → AudioContext → 16 kHz PCM windows) and transcribes
 * it locally with OpenAI Whisper (MULTILINGUAL `whisper-tiny` — auto-detects
 * the spoken language) running in-browser via Transformers.js (WASM). Works
 * on HLS video AND live radio <audio> — any HTMLMediaElement — so EVERY
 * stream can show live captions on demand.
 *
 * TRANSLATION: when a preferred caption language differs from English, the
 * English transcript is further translated ON-DEVICE via a MarianMT/opus-mt
 * translation model (Helsinki-NLP) — so captions appear in the user's
 * preferred language even when the stream has no captions at all.
 *
 * Requirements for audio capture: the media element must serve its content
 * with CORS (crossOrigin="anonymous"); otherwise the browser mutes the
 * captured audio (captions then show a clear "unavailable" state instead of
 * garbage).
 *
 * The Whisper model (~31 MB quantized) + the translation model (~80 MB,
 * loaded ONLY when a non-English preferred language is picked) lazy-load on
 * FIRST use and are cached by the browser thereafter. Generation runs on a
 * rolling ~4 s window so captions appear continuously while the stream plays.
 */

export type CaptionCallback = (text: string, isFinal: boolean) => void;

export type CaptionStatus =
  | "idle"
  | "waiting" // waiting for playback to start so an audio track can be captured
  | "loading-model"
  | "listening"
  | "unavailable"
  | "error";

export type CaptionStatusCallback = (
  status: CaptionStatus,
  detail?: string,
) => void;

// ---------------------------------------------------------------------------
// Lazy-loaded singleton pipelines (ASR + optional translation)
// ---------------------------------------------------------------------------
let asrPipeline: any = null;
let asrLoading: Promise<any> | null = null;

// ---------------------------------------------------------------------------
// Model source — FIRST-PARTY proxy (bulletproof against "Failed to fetch")
// ---------------------------------------------------------------------------
// The on-device caption needs the Whisper + opus-mt model files (~31–80 MB).
// Direct cross-origin fetches to huggingface.co can fail for real users with
// "Failed to fetch" (region-blocked CDN, flaky connection, strict network).
// We therefore serve the model through OUR OWN same-origin reverse proxy
// (/api/hf-proxy on Vercel AND Cloudflare Pages): no CORS, no SW passthrough,
// no external-CDN dependency — the browser talks only to the host it is
// already using, and the data-plane fetch happens server-side. The proxy also
// sets CDN cache headers, so model files are cached after the first hit.

/** Build the same-origin model base URL. Falls back to HuggingFace directly. */
export function modelRemoteHost(): string {
  if (typeof window === "undefined") return "https://huggingface.co/";
  const host = window.location.hostname;
  // Cloudflare Pages: path-based catch-all /api/hf-proxy/<path>.
  if (
    host.endsWith(".pages.dev") ||
    host === "localhost" ||
    host === "127.0.0.1"
  ) {
    return window.location.origin + "/api/hf-proxy/";
  }
  // Vercel: folded into the existing /api/integrations dispatcher to keep the
  // Hobby 12-function cap. The model path lands in the `p` query param
  // (transformers.js pathJoin preserves the `?` inside the first part).
  if (host.endsWith(".vercel.app")) {
    return window.location.origin + "/api/integrations?action=hf-proxy&p=";
  }
  // Unknown embed host — keep the direct CDN (still CSP-allowed).
  return "https://huggingface.co/";
}

/** Retry a promise with exponential backoff (transient network failures). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

async function loadAsr(): Promise<any> {
  if (asrPipeline) return asrPipeline;
  if (asrLoading) return asrLoading;
  asrLoading = (async () => {
    const { env } = await import("@xenova/transformers");
    // Serve model + wasm files from the SAME-ORIGIN proxy (no CORS / no
    // external-CDN dependency). The site CSP still allows huggingface.co as a
    // fallback, and the proxy itself is what makes the CDN immutable-cached.
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.remoteHost = modelRemoteHost();
    // Single-thread WASM: avoids the SharedArrayBuffer requirement
    // (cross-origin isolation), so the model runs in EVERY browser without
    // COOP/COEP headers — no silent WASM init failure. The WASM binary is
    // VENDORED same-origin (public/ort/) so it never depends on an external
    // CDN (jsdelivr) that could otherwise 404/"Failed to fetch".
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.wasmPaths = new URL(
      "/ort/",
      window.location.href,
    ).href;
    // MULTILINGUAL whisper-tiny (not .en) — auto-detects the spoken language
    // and transcribes it, so non-English streams are captioned too.
    // NOTE: constructed class-by-class (not the named "automatic-speech-
    // recognition" string) so the bundler keeps the Whisper classes alive —
    // the string-dispatch form can fail with "Unsupported model type" after
    // Vite tree-shakes the class registrations.
    asrPipeline = await withRetry(() =>
      buildAsrPipeline("Xenova/whisper-tiny"),
    );
    return asrPipeline;
  })();
  try {
    return await asrLoading;
  } finally {
    asrLoading = null;
  }
}

/** Explicit class-based construction of the ASR pipeline (tree-shake-proof). */
async function buildAsrPipeline(modelId: string): Promise<any> {
  const {
    AutoModelForSpeechSeq2Seq,
    AutoProcessor,
    AutoTokenizer,
    AutomaticSpeechRecognitionPipeline,
  } = await import("@xenova/transformers");
  const [model, processor, tokenizer] = await Promise.all([
    AutoModelForSpeechSeq2Seq.from_pretrained(modelId, { quantized: true }),
    AutoProcessor.from_pretrained(modelId),
    AutoTokenizer.from_pretrained(modelId),
  ]);
  // AutomaticSpeechRecognitionPipeline({ task, model, tokenizer, processor })
  return new AutomaticSpeechRecognitionPipeline({
    task: "automatic-speech-recognition",
    model,
    tokenizer,
    processor,
  });
}

// Translation pipeline (English -> preferred language), loaded on demand only.
let mtPipeline: any = null;
let mtLang: string | null = null;
let mtLoading: Promise<any> | null = null;

/** ISO code -> Helsinki-NLP opus-mt model id (English -> target). */
const MT_MODELS: Record<string, string> = {
  es: "Xenova/opus-mt-en-es",
  fr: "Xenova/opus-mt-en-fr",
  de: "Xenova/opus-mt-en-de",
  it: "Xenova/opus-mt-en-it",
  pt: "Xenova/opus-mt-en-pt",
  nl: "Xenova/opus-mt-en-nl",
  ru: "Xenova/opus-mt-en-ru",
  zh: "Xenova/opus-mt-en-zh",
  ja: "Xenova/opus-mt-en-jap", // Xenova uses 'jap' for Japanese
  ko: "Xenova/opus-mt-en-ko",
  ar: "Xenova/opus-mt-en-ar",
  hi: "Xenova/opus-mt-en-hi",
  sw: "Xenova/opus-mt-en-sw",
  tr: "Xenova/opus-mt-en-tr",
};

async function loadTranslator(lang: string): Promise<any> {
  if (mtPipeline && mtLang === lang) return mtPipeline;
  if (mtLoading && mtLang === lang) return mtLoading;
  const modelId = MT_MODELS[lang];
  if (!modelId) return null; // unsupported language — captions stay English
  mtLang = lang;
  mtLoading = (async () => {
    const { env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.remoteHost = modelRemoteHost();
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.wasmPaths = new URL(
      "/ort/",
      window.location.href,
    ).href;
    mtPipeline = await withRetry(() => buildMtPipeline(modelId));
    return mtPipeline;
  })();
  try {
    return await mtLoading;
  } finally {
    mtLoading = null;
  }
}

/** Explicit class-based construction of the translation pipeline
 *  (tree-shake-proof, mirror of buildAsrPipeline). */
async function buildMtPipeline(modelId: string): Promise<any> {
  const { AutoModelForSeq2SeqLM, AutoTokenizer, TranslationPipeline } =
    await import("@xenova/transformers");
  const [model, tokenizer] = await Promise.all([
    AutoModelForSeq2SeqLM.from_pretrained(modelId, { quantized: true }),
    AutoTokenizer.from_pretrained(modelId),
  ]);
  return new TranslationPipeline({
    task: "translation",
    model,
    tokenizer,
  });
}

/** Translate an English caption into the preferred language (on-device). */
async function translateCaption(
  text: string,
  targetLang: string,
): Promise<string> {
  if (!targetLang || targetLang === "en" || !text) return text;
  try {
    const translator = await loadTranslator(targetLang);
    if (!translator) return text; // unsupported — keep English
    const out = await translator(text, { max_new_tokens: 256 });
    const translated = String(out?.[0]?.translation_text ?? "").trim();
    return translated || text;
  } catch {
    return text; // translation failure is non-fatal — keep English
  }
}

// ---------------------------------------------------------------------------
// PCM helpers
// ---------------------------------------------------------------------------

/** Downsample an arbitrary-rate Float32 buffer to 16 kHz mono PCM. */
export function downsampleTo16k(
  input: Float32Array,
  inputRate: number,
): Float32Array {
  if (inputRate === 16000) return input;
  const ratio = inputRate / 16000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = input[Math.floor(i * ratio)];
  }
  return out;
}

/** RMS energy — used as a lightweight voice-activity gate to skip silence. */
export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

// ---------------------------------------------------------------------------
// LiveCaptionEngine
// ---------------------------------------------------------------------------

export class LiveCaptionEngine {
  private audioCtx: AudioContext | null = null;
  private source:
    MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private buffer: Float32Array[] = [];
  private bufferedSamples = 0;
  private running = false;
  private transcribing = false;
  private statusCb: CaptionStatusCallback | null = null;
  /** Preferred caption language (ISO code). English transcripts are
   *  translated to this language on-device when it differs from "en". */
  private preferredLang: string = "en";
  /** ISO-2 country/region of the stream's channel (e.g. "us", "ke", "br").
   *  Used to set the ASR language to the language actually SPOKEN in the
   *  stream (for accuracy), which differs from the preferred DISPLAY
   *  language. */
  private streamCountry: string = "";

  /** Whisper language id for the stream's spoken language (from country).
   *  Falls back to auto-detection when unmapped. */
  static readonly STREAM_ASR_LANGS: Record<string, string> = {
    us: "english",
    gb: "english",
    ca: "english",
    au: "english",
    nz: "english",
    ie: "english",
    ke: "english",
    ng: "english",
    gh: "english",
    za: "english",
    tz: "swahili",
    es: "spanish",
    mx: "spanish",
    ar: "spanish",
    co: "spanish",
    cl: "spanish",
    pe: "spanish",
    ve: "spanish",
    br: "portuguese",
    pt: "portuguese",
    fr: "french",
    be: "french",
    ch: "french",
    de: "german",
    at: "german",
    it: "italian",
    nl: "dutch",
    ru: "russian",
    cn: "chinese",
    tw: "chinese",
    jp: "japanese",
    kr: "korean",
    in: "hindi",
    sa: "arabic",
    ae: "arabic",
    tr: "turkish",
  };
  /** Resolve the Whisper language id for a channel country ("" = auto-detect). */
  static whisperLangForCountry(country: string): string {
    return (
      LiveCaptionEngine.STREAM_ASR_LANGS[
        (country || "").trim().toLowerCase()
      ] || ""
    );
  }

  private whisperLangForCountry(country: string): string {
    return LiveCaptionEngine.whisperLangForCountry(country);
  }

  /** Roughly how much audio (seconds at the capture rate) per caption window. */
  private static readonly WINDOW_SECONDS = 4;
  /** Skip transcription windows quieter than this RMS (silence gate). */
  private static readonly SILENCE_RMS = 0.008;

  /**
   * Start generating live captions from a media element.
   *
   * ALWAYS produces a live audio source for the caption pipeline, even when
   * the stream's captureStream() exposes no audio track yet:
   *  1. It first WAITS for the element to actually start playing (a fixed
   *     4 s timeout was the root cause of "This stream exposes no audio
   *     track to caption" — autoplay-blocked / slow-buffering elements
   *     yielded zero tracks before the engine gave up).
   *  2. It falls back to a Web-Audio tap (`createMediaElementSource`) which
   *     routes the element's OUTPUT directly into the caption graph — a real
   *     live audio track even when captureStream's track enumeration is
   *     empty or unsupported.
   *  3. Only a genuinely silent/video-only source gives up, and it never
   *     dead-ends: `onNoAudio` is invoked so the host can auto-advance to a
   *     captioned channel.
   *
   * @param mediaEl  the <video>/<audio> element currently playing the stream
   * @param onCaption  called with each transcribed caption segment
   * @param onStatus  lifecycle updates (waiting / loading-model / listening / …)
   * @param preferredLang  display language (translated on-device from English)
   * @param streamCountry  ISO-2 country → language SPOKEN in the stream
   * @param onNoAudio  called when the source truly has no audible track
   */
  async start(
    mediaEl: HTMLMediaElement,
    onCaption: CaptionCallback,
    onStatus?: CaptionStatusCallback,
    preferredLang: string = "en",
    streamCountry: string = "",
    onNoAudio?: () => void,
  ): Promise<void> {
    this.statusCb = onStatus || null;
    this.preferredLang = preferredLang || "en";
    this.streamCountry = (streamCountry || "").toLowerCase();
    if (this.running) return;
    this.running = true; // reserve the engine while we await readiness

    // ── Phase 1: wait for real playback. An element that is still buffering,
    // autoplay-blocked, or slow to attach its audio produces an empty
    // captureStream; keep waiting (with friendly feedback) instead of failing.
    const playbackReady = await this.waitForPlayback(mediaEl);
    if (!this.running) return; // stopped while waiting
    if (!playbackReady) {
      // Playback hasn't started within the window. Surface a clear WAITING
      // state and return — the host's `playing` listener restarts the engine
      // the moment the stream begins, so captions "turn on automatically"
      // instead of dead-ending with the old "no audio track" error.
      this.running = false;
      this.statusCb?.(
        "waiting",
        "Waiting for playback to start — captions will turn on automatically…",
      );
      return;
    }

    // ── Phase 2: capture the element's audio output.
    // Primary: captureStream() (non-invasive). Its audio tracks can be empty
    // while the element loads, so poll for a track to appear.
    let capture: MediaStream | null = null;
    const hasCaptureStream = this.hasCaptureStream(mediaEl);
    if (hasCaptureStream) {
      capture = this.captureStreamOf(mediaEl);
      if (capture) {
        const gotTrack = await this.waitForAudioTrack(capture as MediaStream);
        if (!this.running) return;
        if (!gotTrack) capture = null; // fall through to the Web-Audio tap
      }
    }

    // Fallback: Web-Audio tap. createMediaElementSource() routes the
    // element's OUTPUT bus directly into our audio graph — this is the
    // "always create a live audio track" guarantee: it does NOT depend on
    // the browser enumerating a track in captureStream(). We only use it when
    // captureStream failed, because a tappable element is single-use in an
    // AudioContext (calling it twice throws) — so captureStream is preferred.
    let useElementTap = false;
    if (!capture) {
      if (this.audioCtx) {
        // A context already exists from a prior tap; it still holds the
        // element, so reuse it (element taps are single-use per context).
      }
      try {
        const hasCtxClass =
          typeof window !== "undefined" &&
          (window.AudioContext || (window as any).webkitAudioContext);
        if (hasCtxClass) {
          // We can ALWAYS create an audio context for the tap.
          useElementTap = true;
        }
      } catch {
        useElementTap = false;
      }
    }

    if (!capture && !useElementTap) {
      this.running = false;
      this.statusCb?.(
        "unavailable",
        "Live caption capture is not supported in this browser.",
      );
      return;
    }

    // ── Phase 3: load the Whisper model (before wiring audio so the model
    // download overlaps nothing critical).
    this.statusCb?.("loading-model", "Loading on-device caption model…");
    try {
      await loadAsr();
    } catch (err) {
      this.running = false;
      this.statusCb?.(
        "error",
        `Could not load the caption model: ${
          err instanceof Error ? err.message : String(err)
        }. Check your connection and try again.`,
      );
      return;
    }
    if (!this.running) return;

    // ── Phase 4: build the audio graph.
    this.audioCtx =
      this.audioCtx ||
      new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioCtx.state === "suspended") {
      // Autoplay policy — the user gesture that toggled captions unlocks it.
      await this.audioCtx.resume().catch(() => {});
    }

    // ScriptProcessorNode is deprecated but universally supported; the buffer
    // size (8192) ≈ 0.5 s at 16 kHz keeps callback cadence modest.
    this.processor = this.audioCtx.createScriptProcessor(8192, 1, 1);
    this.buffer = [];
    this.bufferedSamples = 0;

    const captureRate = this.audioCtx.sampleRate;
    const windowSamples = LiveCaptionEngine.WINDOW_SECONDS * captureRate;

    this.processor.onaudioprocess = (e) => {
      if (!this.running) return;
      const data = e.inputBuffer.getChannelData(0);
      // Copy — the underlying buffer is reused by the browser.
      this.buffer.push(new Float32Array(data));
      this.bufferedSamples += data.length;
      if (this.bufferedSamples >= windowSamples && !this.transcribing) {
        const windowBuf = this.takeWindow(windowSamples);
        if (windowBuf)
          void this.transcribeWindow(windowBuf, captureRate, onCaption);
      }
    };

    try {
      if (useElementTap) {
        // Route the element's output bus into the graph. The element keeps
        // playing through processor → destination, so this never mutes it.
        this.source = this.audioCtx.createMediaElementSource(mediaEl);
      } else {
        this.source = this.audioCtx.createMediaStreamSource(
          capture as MediaStream,
        );
      }
    } catch {
      // The tap failed (element already attached to a context, or the
      // stream is video-only). Never dead-end: report + auto-advance.
      this.running = false;
      this.statusCb?.(
        "unavailable",
        "This stream exposes no audio track to caption.",
      );
      onNoAudio?.();
      return;
    }

    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
    this.statusCb?.("listening", "Generating live captions…");
  }

  /** Whether captureStream (or the moz variant) exists on this element. */
  private hasCaptureStream(mediaEl: HTMLMediaElement): boolean {
    return (
      typeof (mediaEl as any).captureStream === "function" ||
      typeof (mediaEl as any).mozCaptureStream === "function"
    );
  }

  /** Get the element's output stream (captureStream or moz variant). */
  private captureStreamOf(mediaEl: HTMLMediaElement): MediaStream | null {
    return (
      (mediaEl as any).captureStream?.() ||
      (mediaEl as any).mozCaptureStream?.() ||
      null
    );
  }

  /**
   * Wait (polling) until the element is actually playing its stream, so the
   * audio track is real. Never blocks indefinitely — caps at ~20 s.
   */
  private async waitForPlayback(
    mediaEl: HTMLMediaElement,
    maxWaitMs = 20000,
  ): Promise<boolean> {
    const started = (): boolean =>
      !!mediaEl &&
      ((!mediaEl.paused && mediaEl.readyState >= 2) || mediaEl.currentTime > 0);
    if (started()) return true;
    this.statusCb?.(
      "waiting",
      !mediaEl.paused
        ? "Buffering stream audio…"
        : "Press play on the stream, then captions turn on.",
    );
    return new Promise<boolean>((resolve) => {
      const startedMs = Date.now();
      const onPlay = () => {
        if (!started()) return;
        cleanup();
        resolve(true);
      };
      const iv = setInterval(() => {
        if (started()) {
          cleanup();
          resolve(true);
          return;
        }
        if (Date.now() - startedMs >= maxWaitMs) {
          cleanup();
          resolve(false);
        }
      }, 300);
      const cleanup = () => {
        clearInterval(iv);
        mediaEl.removeEventListener("playing", onPlay);
      };
      mediaEl.addEventListener("playing", onPlay);
      // Nudge autoplay — the toggle click grants the gesture.
      mediaEl.play().catch(() => {});
    });
  }

  /** Poll captureStream for an audio track (up to ~10 s). */
  private async waitForAudioTrack(
    capture: MediaStream,
    maxWaitMs = 10000,
  ): Promise<boolean> {
    if (capture.getAudioTracks().length > 0) return true;
    return new Promise<boolean>((resolve) => {
      const startedMs = Date.now();
      const iv = setInterval(() => {
        if (capture.getAudioTracks().length > 0) {
          clearInterval(iv);
          resolve(true);
        } else if (Date.now() - startedMs >= maxWaitMs) {
          clearInterval(iv);
          resolve(false);
        }
      }, 250);
    });
  }

  /** Pull exactly n samples from the rolling buffer (consumes them). */
  private takeWindow(n: number): Float32Array | null {
    if (this.bufferedSamples < n) return null;
    const out = new Float32Array(n);
    let offset = 0;
    while (offset < n && this.buffer.length > 0) {
      const head = this.buffer[0];
      const take = Math.min(head.length, n - offset);
      out.set(head.subarray(0, take), offset);
      offset += take;
      if (take === head.length) this.buffer.shift();
      else this.buffer[0] = head.subarray(take);
    }
    this.bufferedSamples -= n;
    return out;
  }

  private async transcribeWindow(
    raw: Float32Array,
    captureRate: number,
    onCaption: CaptionCallback,
  ): Promise<void> {
    this.transcribing = true;
    try {
      const pcm16k = downsampleTo16k(raw, captureRate);
      if (rms(pcm16k) < LiveCaptionEngine.SILENCE_RMS) return; // silence/silenced
      const asr = await loadAsr();
      // ACCURACY: hint Whisper with the language SPOKEN in the stream
      // (derived from the channel's country). When unmapped, leave the
      // language unset and let the multilingual model auto-detect.
      const languageHint = this.whisperLangForCountry(this.streamCountry);
      const result = await asr(pcm16k, {
        chunk_length_s: 30,
        stride_length_s: 5,
        ...(languageHint ? { language: languageHint } : {}),
        task: "transcribe",
      });
      const text = String(result?.text ?? "").trim();
      if (!text) return;
      // Translate the English transcript to the preferred language on-device
      // (no-op when preferred is English or unsupported). Whisper outputs
      // English for non-English speech only when translation is requested;
      // otherwise the transcript is in the spoken language — so try
      // translating the spoken-language transcript to the preferred language
      // when they differ (opus-mt is English↔…, so this covers the common
      // English-stream case; non-English streams fall through to English).
      const finalText =
        this.preferredLang && this.preferredLang !== "en"
          ? await translateCaption(text, this.preferredLang)
          : text;
      if (finalText) onCaption(finalText, true);
    } catch {
      /* transient ASR errors are non-fatal — keep listening */
    } finally {
      this.transcribing = false;
    }
  }

  /** Stop captioning and release all audio resources. */
  stop(): void {
    this.running = false;
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
    } catch {
      /* already disconnected */
    }
    this.processor = null;
    this.source = null;
    if (this.audioCtx) {
      // Closing the context also releases a media element that was routed
      // through it via createMediaElementSource, restoring normal playback.
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.stream = null;
    this.buffer = [];
    this.bufferedSamples = 0;
  }

  /** Whether the engine is currently capturing + transcribing. */
  isActive(): boolean {
    return this.running;
  }

  /** Pre-warm the Whisper model in the background (e.g. on player mount) so
   * the first caption toggle is instant. Fire-and-forget. */
  static preload(): void {
    void loadAsr().catch(() => {});
  }
}

export const liveCaptionEngine = new LiveCaptionEngine();
