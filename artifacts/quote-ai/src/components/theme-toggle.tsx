import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const label = theme === "dark" ? t("dashboard.nav.lightMode") : t("dashboard.nav.darkMode");

  const button = (
    <button
      onClick={toggleTheme}
      className={cn(
        "flex items-center rounded-lg transition-all text-muted-foreground hover:bg-accent hover:text-foreground",
        collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2.5 px-2.5 py-2 w-full"
      )}
      title={label}
    >
      {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {!collapsed && <span className="flex-1 text-sm text-left font-medium">{label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return button;
}
