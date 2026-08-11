import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Check, Search } from "lucide-react";

/* ── types ─────────────────────────────────────────────────────────── */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  children?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  forceSearch?: boolean;
  searchThreshold?: number;
}

/* ── helpers ───────────────────────────────────────────────────────── */

const UNIQUE_ID_PREFIX = "sel-";
let _idCounter = 0;

function nextId() {
  _idCounter += 1;
  return `${UNIQUE_ID_PREFIX}${_idCounter}`;
}

function collectOptions(
  options: SelectOption[] | undefined,
  children: ReactNode | undefined,
): SelectOption[] {
  if (options && options.length > 0) return options;
  if (!children) return [];
  const arr: SelectOption[] = [];
  const push = (child: any) => {
    if (!child) return;
    if (Array.isArray(child)) {
      child.forEach(push);
      return;
    }
    if (child?.props) {
      const { value, children: label, disabled } = child.props;
      if (value !== undefined) {
        arr.push({
          value: String(value),
          label: typeof label === "string" ? label : String(value),
          disabled: disabled || false,
        });
      }
    }
  };
  push(children);
  return arr;
}

/* ── component ─────────────────────────────────────────────────────── */

export default function Select({
  value,
  onChange,
  options,
  children,
  placeholder = "Select option",
  disabled = false,
  id,
  ariaLabel,
  className = "",
  forceSearch = false,
  searchThreshold = 10,
}: SelectProps) {
  const allOptions = useMemo(
    () => collectOptions(options, children),
    [options, children],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const instanceId = useRef(id ?? nextId()).current;
  const listboxId = `${instanceId}-listbox`;

  const showSearch = forceSearch || allOptions.length >= searchThreshold;

  const selectedLabel = useMemo(
    () => allOptions.find((o) => o.value === value)?.label ?? "",
    [allOptions, value],
  );

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return allOptions;
    const q = query.toLowerCase();
    return allOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [allOptions, query]);

  /* ── edge-flip (Rule 2) ──────────────────────────────────────────── */
  const checkPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = Math.min(
      filteredOptions.length * 40 + (showSearch ? 48 : 0) + 16,
      320,
    );
    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      setPlacement("top");
    } else {
      setPlacement("bottom");
    }
  }, [filteredOptions.length, showSearch]);

  /* ── outside-click ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  /* ── position on open + scroll ───────────────────────────────────── */
  useEffect(() => {
    if (isOpen) {
      checkPosition();
      setFocusedIndex(allOptions.findIndex((o) => o.value === value));
      if (showSearch) {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    } else {
      setQuery("");
      setFocusedIndex(-1);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const onScroll = () => checkPosition();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [isOpen, checkPosition]);

  /* ── keyboard navigation (Rule 3) ─────────────────────────────────── */
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (
      !isOpen &&
      (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => {
          const max = filteredOptions.length - 1;
          let next = prev < max ? prev + 1 : 0;
          while (filteredOptions[next]?.disabled && next !== prev) {
            next = next < max ? next + 1 : 0;
          }
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => {
          const max = filteredOptions.length - 1;
          let next = prev > 0 ? prev - 1 : max;
          while (filteredOptions[next]?.disabled && next !== prev) {
            next = next > 0 ? next - 1 : max;
          }
          return next;
        });
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          const opt = filteredOptions[focusedIndex];
          if (!opt.disabled) {
            onChange(opt.value);
            setIsOpen(false);
            triggerRef.current?.focus();
          }
        }
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  /* ── scroll focused item into view ──────────────────────────────── */
  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return;
    const el = listRef.current?.querySelector(`[data-idx="${focusedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Rule 1: 48px touch target, hover feedback, caret icon */}
      <button
        ref={triggerRef}
        type="button"
        id={instanceId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex h-12 w-full items-center justify-between rounded-lg border px-4 text-sm font-medium transition-all duration-150 ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"
        } border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400`}
      >
        <span
          className={
            selectedLabel
              ? "truncate"
              : "truncate text-gray-400 dark:text-gray-500"
          }
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Rule 5: 150ms animation, Rule 2: edge-flip */}
      {isOpen && (
        <div
          className={`absolute left-0 z-50 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl transition-all duration-150 dark:border-gray-600 dark:bg-gray-800 ${
            placement === "top"
              ? "bottom-full mb-2 origin-bottom"
              : "top-full mt-2 origin-top"
          } ${
            isOpen
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}
        >
          {/* Rule 4: search for 10+ items */}
          {showSearch && (
            <div className="border-b border-gray-200 p-2 dark:border-gray-600">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setFocusedIndex(0);
                  }}
                  placeholder="Search..."
                  className="h-10 w-full rounded-md border border-gray-300 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>
          )}

          {/* Rule 3: ARIA listbox with keyboard navigation */}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-activedescendant={
              focusedIndex >= 0
                ? `${instanceId}-opt-${focusedIndex}`
                : undefined
            }
            className="max-h-60 overflow-y-auto p-1"
          >
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                No results found
              </li>
            )}
            {filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isFocused = idx === focusedIndex;
              return (
                <li
                  key={opt.value}
                  id={`${instanceId}-opt-${idx}`}
                  data-idx={idx}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }
                  }}
                  className={`flex h-10 cursor-pointer items-center justify-between rounded-md px-3 text-sm transition-colors duration-150 ${
                    opt.disabled
                      ? "cursor-not-allowed opacity-40"
                      : isFocused
                        ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100"
                        : isSelected
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── sub-component for children-based usage ────────────────────────── */

export function SelectOption({
  value,
  children,
  disabled,
}: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  );
}
