"use client";
import { useConfig } from "@/hooks/useConfig";
import { TaskCenter } from "@/components/tasks/TaskDrawer";
import { Button } from "@/components/ui/button";
import { useLanguage, useTranslation } from "@/i18n";
import { CircleCheck, CircleX, Globe } from "lucide-react";

export function TopBar() {
  const { isConfigured, model } = useConfig();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b bg-background px-6">
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN")}
        >
          <Globe className="h-3.5 w-3.5" />
          {language === "zh-CN" ? "English" : "中文"}
        </Button>

        <TaskCenter />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isConfigured ? (
            <>
              <CircleCheck className="h-4 w-4 text-green-500" />
              <span>{t("topbar.connected")}</span>
              <span className="text-xs text-muted-foreground/60">| {model}</span>
            </>
          ) : (
            <>
              <CircleX className="h-4 w-4 text-destructive" />
              <span>{t("topbar.notConfigured")}</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
