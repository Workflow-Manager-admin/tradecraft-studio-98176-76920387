import React, { useEffect, useState } from "react";

// PUBLIC_INTERFACE
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    (localStorage.getItem("theme") || "light")
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
