/**
 * useInputStability - Prevents input clearing and ensures stable input handling
 * Fixes issues with microsecond timeouts that cause inputs to clear or reject text
 */
import { useState, useCallback, useRef, useEffect } from "react";

interface UseInputStabilityOptions {
  /** Delay before considering input stable (ms) */
  stabilityDelay?: number;
  /** Whether to preserve value on blur */
  preserveOnBlur?: boolean;
  /** Custom validation function */
  validate?: (value: string) => boolean;
}

export function useInputStability<T extends string = string>(
  initialValue: T = "" as T,
  options: UseInputStabilityOptions = {},
) {
  const { stabilityDelay = 150, preserveOnBlur = true, validate } = options;

  // Internal state - never exposed directly to avoid race conditions
  const [internalValue, setInternalValue] = useState<T>(initialValue);

  // Track if we're currently typing
  const isTypingRef = useRef(false);
  const lastUpdateRef = useRef(Date.now());
  const blurValueRef = useRef<T>(initialValue);
  const mountedRef = useRef(true);

  // Debounce timer for stability
  const stabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ensure component is mounted before updating state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (stabilityTimerRef.current) {
        clearTimeout(stabilityTimerRef.current);
      }
    };
  }, []);

  // Stable value setter - doesn't clear on re-render
  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      if (!mountedRef.current) return;

      isTypingRef.current = true;
      lastUpdateRef.current = Date.now();

      const valueToSet =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(internalValue)
          : newValue;

      // Validate if validator provided
      if (validate && !validate(valueToSet)) {
        return;
      }

      // Clear any pending stability timer
      if (stabilityTimerRef.current) {
        clearTimeout(stabilityTimerRef.current);
      }

      // Update immediately for responsive feel
      setInternalValue(valueToSet);

      // Set stability timer
      stabilityTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          isTypingRef.current = false;
        }
      }, stabilityDelay);
    },
    [internalValue, stabilityDelay, validate],
  );

  // Handle blur - preserve value
  const handleBlur = useCallback(() => {
    if (preserveOnBlur) {
      blurValueRef.current = internalValue;
    }
    isTypingRef.current = false;
  }, [internalValue, preserveOnBlur]);

  // Handle focus - restore value if needed
  const handleFocus = useCallback(() => {
    isTypingRef.current = true;
    // Restore from blur if needed
    if (preserveOnBlur && blurValueRef.current !== internalValue) {
      setInternalValue(blurValueRef.current);
    }
  }, [internalValue, preserveOnBlur]);

  // Reset to specific value
  const reset = useCallback(
    (value: T = initialValue) => {
      if (stabilityTimerRef.current) {
        clearTimeout(stabilityTimerRef.current);
      }
      blurValueRef.current = value;
      setInternalValue(value);
      isTypingRef.current = false;
    },
    [initialValue],
  );

  // Check if currently typing
  const isTyping = useCallback(() => isTypingRef.current, []);

  // Get time since last update
  const timeSinceUpdate = useCallback(
    () => Date.now() - lastUpdateRef.current,
    [],
  );

  return {
    value: internalValue,
    setValue,
    handleBlur,
    handleFocus,
    reset,
    isTyping,
    timeSinceUpdate,
  };
}

/**
 * StableInput - A wrapper component for input fields that prevents clearing
 */
interface StableInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onStableChange?: (value: string) => void;
  stabilityDelay?: number;
}

export function StableInput({
  onStableChange,
  stabilityDelay = 150,
  ...props
}: StableInputProps) {
  const { value, setValue, handleBlur, handleFocus } = useInputStability(
    (props.value as string) || "",
    { stabilityDelay },
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onStableChange?.(newValue);
    },
    [setValue, onStableChange],
  );

  return (
    <input
      {...props}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );
}

/**
 * StableTextarea - A wrapper component for textarea that prevents clearing
 */
interface StableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onStableChange?: (value: string) => void;
  stabilityDelay?: number;
}

export function StableTextarea({
  onStableChange,
  stabilityDelay = 150,
  ...props
}: StableTextareaProps) {
  const { value, setValue, handleBlur, handleFocus } = useInputStability(
    (props.value as string) || "",
    { stabilityDelay },
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onStableChange?.(newValue);
    },
    [setValue, onStableChange],
  );

  return (
    <textarea
      {...props}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );
}

/**
 * ClickGuard - Prevents accidental double-clicks and rapid clicking
 */
interface ClickGuardOptions {
  /** Minimum time between clicks (ms) */
  minClickInterval?: number;
  /** Show loading state during click */
  showLoading?: boolean;
  /** Loading duration (ms) */
  loadingDuration?: number;
}

export function useClickGuard(options: ClickGuardOptions = {}) {
  const {
    minClickInterval = 300,
    showLoading = true,
    loadingDuration = 500,
  } = options;

  const lastClickRef = useRef(0);
  const isLoadingRef = useRef(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  const canClick = useCallback(() => {
    if (isLoadingRef.current) return false;
    const now = Date.now();
    if (now - lastClickRef.current < minClickInterval) return false;
    return true;
  }, [minClickInterval]);

  const recordClick = useCallback(() => {
    lastClickRef.current = Date.now();

    if (showLoading) {
      isLoadingRef.current = true;

      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }

      loadingTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          isLoadingRef.current = false;
        }
      }, loadingDuration);
    }
  }, [showLoading, loadingDuration]);

  const withClickGuard = useCallback(
    <T extends (...args: any[]) => any>(
      handler: T,
    ): ((...args: Parameters<T>) => ReturnType<T> | void) => {
      return (...args: Parameters<T>) => {
        if (!canClick()) return;
        recordClick();
        return handler(...args);
      };
    },
    [canClick, recordClick],
  );

  return {
    canClick,
    recordClick,
    withClickGuard,
    isLoading: () => isLoadingRef.current,
  };
}

export default useInputStability;
