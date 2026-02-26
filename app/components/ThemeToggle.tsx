"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    // Reading from localStorage to sync UI state is a legitimate external-system effect
    // eslint-disable-next-line react-compiler/react-compiler
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
  };

  // Avoid hydration mismatch — render nothing until client reads preference
  if (theme === null) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      className="rounded-full border border-foreground/20 bg-foreground/5 p-1.5 text-sm leading-none hover:bg-foreground/10 transition"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
