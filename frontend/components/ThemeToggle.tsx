"use client";

import { useSyncExternalStore } from "react";
import "./ThemeToggle.css";

type Theme = "dark" | "light";
const KEY = "evnet-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function write(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable: the choice lasts for this page view only */
  }
  document.documentElement.dataset.theme = theme;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * Dark / off-white switch. It records the choice on <html data-theme> and in
 * localStorage; the light palette itself is not built yet, so for now the
 * page stays dark whichever way it is set.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);

  return (
    <input
      type="checkbox"
      role="switch"
      className={`theme-checkbox ${className}`}
      checked={theme === "dark"}
      onChange={(e) => write(e.target.checked ? "dark" : "light")}
      aria-label="Dark theme"
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    />
  );
}
