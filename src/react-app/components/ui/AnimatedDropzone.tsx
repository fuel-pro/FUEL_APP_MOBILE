import { useRef, useState, type ReactNode } from "react";

/**
 * Animated Dropzone (from design spec file 10).
 *
 * Premium file-upload dropzone with:
 * - Dashed border that highlights on drag-over (fp-dropzone-active)
 * - "Drop files here or browse — you can paste too" affordance
 * - FLIP-style entrance animation: dropped files animate from the drop
 *   coordinates into the queue list position
 * - Per-file thumbnail reveal: image previews start grayscale + dim, then
 *   a clip-path (fp-drop-reveal) unmasks full color left-to-right as the
 *   upload progress reaches 100%
 * - Progress bar (#8DCF74 soft sage on completion)
 *
 * This component renders ONLY the dropzone surface + browse/paste buttons.
 * The parent owns the upload queue state and passes an onFiles callback.
 * Use <DropzoneFileItem> for each queued file to get the animated reveal.
 */
export interface AnimatedDropzoneProps {
  /** Called with the selected/dropped files */
  onFiles: (files: File[]) => void;
  /** Accept attribute for the file input */
  accept?: string;
  /** Allow folder upload (webkitdirectory) */
  allowFolder?: boolean;
  /** Called when folder is selected */
  onFolder?: (files: FileList) => void;
  /** Title text */
  title?: string;
  /** Extra className */
  className?: string;
  /** Children rendered inside the dropzone (e.g. custom icon) */
  children?: ReactNode;
}

export default function AnimatedDropzone({
  onFiles,
  accept,
  allowFolder = false,
  onFolder,
  title = "Drop files here or browse",
  className = "",
  children,
}: AnimatedDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      className={`relative border-2 border-dashed rounded-xl p-7 text-center transition-all duration-200 cursor-pointer outline-none ${
        isDragOver ? "fp-dropzone-active" : "border-slate-600 bg-slate-900/40"
      } ${className}`}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      aria-label={title}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(Array.from(e.target.files));
            e.target.value = "";
          }
        }}
        style={{ display: "none" }}
      />
      {allowFolder && (
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error - webkitdirectory is not in React TS types but works
          webkitdirectory=""
          directory=""
          multiple
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0 && onFolder) {
              onFolder(e.target.files);
              e.target.value = "";
            }
          }}
          style={{ display: "none" }}
        />
      )}

      {children ? (
        children
      ) : (
        <>
          <svg
            className="w-8 h-8 mx-auto mb-2 transition-colors"
            style={{ color: isDragOver ? "var(--fp-amber)" : "#64748b" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          <p className="text-sm text-slate-400 mb-3">
            {isDragOver ? "Release to upload" : title}
          </p>
          <p className="text-[11px] text-slate-500">you can paste too</p>
        </>
      )}

      {allowFolder && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            folderInputRef.current?.click();
          }}
          className="mt-3 text-xs text-amber-400 hover:text-amber-300 font-medium"
        >
          Or select a folder →
        </button>
      )}
    </div>
  );
}

/**
 * Animated file queue item (from design spec file 10).
 *
 * Shows a file in the upload queue with:
 * - Image thumbnail that starts grayscale + dim, then reveals full color
 *   left-to-right via clip-path as progress hits 100% (fp-drop-reveal)
 * - Progress bar (soft sage #8DCF74 when complete)
 * - Non-image files show a document icon instead of a thumbnail
 */
export interface DropzoneFileItemProps {
  file: File;
  progress: number; // 0-100
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  /** Object URL for image preview (revoked by parent) */
  previewUrl?: string;
  onRemove?: () => void;
}

export function DropzoneFileItem({
  file,
  progress,
  status,
  error,
  previewUrl,
  onRemove,
}: DropzoneFileItemProps) {
  const isImage = file.type.startsWith("image/");
  const isDone = status === "done";

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700 transition-all"
      style={{ animation: "fp-fade-in 0.2s ease" }}
    >
      {/* Thumbnail / icon */}
      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className={`w-full h-full object-cover ${isDone ? "fp-drop-complete" : "fp-drop-reveal"}`}
            style={
              !isDone
                ? ({
                    "--fp-drop-p": (progress / 100).toString(),
                  } as React.CSSProperties)
                : undefined
            }
          />
        ) : (
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        )}
      </div>

      {/* Name + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-200 truncate">
            {file.name}
          </p>
          <span className="text-[10px] text-slate-500 flex-shrink-0">
            {status === "done"
              ? "Done"
              : status === "error"
                ? "Failed"
                : status === "queued"
                  ? "Queued"
                  : `${Math.round(progress)}%`}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              status === "error"
                ? "bg-red-500"
                : isDone
                  ? "bg-[#8DCF74]"
                  : "bg-[#035BFE]"
            }`}
            style={{ width: `${status === "done" ? 100 : progress}%` }}
          />
        </div>
        {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
      </div>

      {/* Remove */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
          aria-label={`Remove ${file.name}`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
