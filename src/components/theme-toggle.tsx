import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="glass-pill flex items-center p-1 gap-0.5">
      <button
        type="button"
        aria-label="Light theme"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        className={`grid h-7 w-7 place-items-center rounded-full transition-all duration-200 ease-out ${
          theme === "light"
            ? "bg-[var(--surface-raised)] text-[var(--ink)] shadow-sm"
            : "text-[var(--text-muted)] hover:text-[var(--ink)]"
        }`}
      >
        <Sun className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        aria-label="Dark theme"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={`grid h-7 w-7 place-items-center rounded-full transition-all duration-200 ease-out ${
          theme === "dark"
            ? "bg-[var(--surface-raised)] text-[var(--ink)] shadow-sm"
            : "text-[var(--text-muted)] hover:text-[var(--ink)]"
        }`}
      >
        <Moon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
    </div>
  );
}
