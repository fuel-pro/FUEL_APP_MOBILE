/**
 * NumberInput — a controlled numeric text input that lets the user CLEAR the
 * field (show nothing) instead of forcing "0" into an empty input.
 *
 * Usage:
 *   <NumberInput value={price} onChange={setPrice} placeholder="0.00" />
 *
 * Internally it keeps a string buffer so the user can delete all digits and
 * see an empty field. The parent receives a number (0 when empty) via
 * onChange. On blur, an empty field stays empty (or shows "0" if showZero).
 *
 * This fixes the recurring complaint: "I can't completely clear an input
 * field with figures; it always forces the value 0 on an empty field."
 */
import { useEffect, useRef, useState } from "react";

interface NumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value" | "type"
  > {
  value: number | undefined | null;
  onChange: (value: number) => void;
  /** When true, an empty field shows "0" on blur (e.g. a tax rate). */
  showZero?: boolean;
  /** Allow negative numbers (default false). */
  allowNegative?: boolean;
  /** Decimal places (default unrestricted). */
}

export function NumberInput({
  value,
  onChange,
  showZero = false,
  allowNegative = false,
  className = "",
  onBlur,
  ...rest
}: NumberInputProps) {
  // Internal string buffer so the user can clear the field freely.
  const [buffer, setBuffer] = useState<string>(() => formatForDisplay(value, showZero));
  const isEditingRef = useRef(false);

  // Sync the buffer from the parent value when NOT actively editing (so
  // external updates — e.g. cloud sync, "Set as station price" — propagate).
  useEffect(() => {
    if (isEditingRef.current) return;
    setBuffer(formatForDisplay(value, showZero));
  }, [value, showZero]);

  const sanitize = (raw: string): string => {
    // Strip anything that isn't a digit, dot, or (optionally) a leading minus.
    let s = raw;
    if (allowNegative) {
      // Keep only one leading minus.
      s = s.replace(/(?!^)-/g, "");
    } else {
      s = s.replace(/-/g, "");
    }
    // Keep only digits and a single dot.
    s = s.replace(/[^0-9.]/g, "");
    // Only one decimal point.
    const parts = s.split(".");
    if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
    return s;
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={buffer}
      onFocus={() => {
        isEditingRef.current = true;
      }}
      onChange={(e) => {
        const next = sanitize(e.target.value);
        setBuffer(next);
        // Notify the parent with the numeric value (0 when empty).
        const n = next.trim() === "" ? 0 : Number(next);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      onBlur={(e) => {
        isEditingRef.current = false;
        // On blur, normalize the display: empty -> "" (or "0" if showZero).
        const trimmed = buffer.trim();
        if (trimmed === "") {
          setBuffer(showZero ? "0" : "");
        } else {
          // Drop a trailing dot, leading zeros (except "0.").
          const n = Number(trimmed);
          if (Number.isFinite(n)) {
            setBuffer(n === 0 ? (showZero ? "0" : "") : String(n));
          }
        }
        if (onBlur) onBlur(e);
      }}
      {...rest}
    />
  );
}

function formatForDisplay(
  value: number | undefined | null,
  showZero: boolean,
): string {
  if (value == null) return "";
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  if (value === 0) return showZero ? "0" : "";
  return String(value);
}

export default NumberInput;
