import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Robust prefers-color-scheme detection for all browsers
function getPrefersDarkMode(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia !== "function") {
      // Fallback for browsers without matchMedia
      return false;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    return mediaQuery.matches;
  } catch {
    return false;
  }
}

// Robust media query listener for all browsers
function addMediaQueryListener(
  mediaQuery: MediaQueryList,
  callback: () => void
): () => void {
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  } else if (mediaQuery.addListener) {
    // Legacy support for older browsers
    mediaQuery.addListener(callback);
    return () => mediaQuery.removeListener(callback);
  }
  return () => {};
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("fuelpro_theme");
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    } catch {
      // localStorage not available
    }
    return "system";
  });

  const getResolvedTheme = useCallback((t: Theme): "light" | "dark" => {
    if (t === "system") {
      return getPrefersDarkMode() ? "dark" : "light";
    }
    return t;
  }, []);

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    getResolvedTheme(theme)
  );

  // Apply theme to document
  const applyTheme = useCallback((resolved: "light" | "dark") => {
    try {
      const root = document.documentElement;
      if (resolved === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
        // Also set data attribute for Tailwind dark mode
        root.setAttribute("data-theme", "dark");
        // Set CSS custom property for extra compatibility
        document.body.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
        root.setAttribute("data-theme", "light");
        document.body.style.colorScheme = "light";
      }
    } catch {
      // DOM not ready
    }
  }, []);

  useEffect(() => {
    const resolved = getResolvedTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    try {
      localStorage.setItem("fuelpro_theme", theme);
    } catch {
      // localStorage not available
    }
  }, [theme, getResolvedTheme, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    try {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        const resolved = getPrefersDarkMode() ? "dark" : "light";
        setResolvedTheme(resolved);
        applyTheme(resolved);
      };

      return addMediaQueryListener(mediaQuery, handleChange);
    } catch {
      // matchMedia not supported
    }
  }, [theme, applyTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
