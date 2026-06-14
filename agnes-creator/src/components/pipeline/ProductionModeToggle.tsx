"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { FileText, Monitor } from "lucide-react";

interface ProductionModeToggleProps {
  mode: "draft" | "production";
  onChange: (mode: "draft" | "production") => void;
}

export function ProductionModeToggle({ mode, onChange }: ProductionModeToggleProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4" />
          {t("pipeline.productionMode")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button
            variant={mode === "draft" ? "default" : "outline"}
            size="sm"
            className={`flex-1 h-8 text-xs ${mode === "draft" ? "" : "opacity-60"}`}
            onClick={() => onChange("draft")}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            {t("pipeline.draftMode")}
          </Button>
          <Button
            variant={mode === "production" ? "default" : "outline"}
            size="sm"
            className={`flex-1 h-8 text-xs ${mode === "production" ? "" : "opacity-60"}`}
            onClick={() => onChange("production")}
          >
            <Monitor className="h-3.5 w-3.5 mr-1" />
            {t("pipeline.productionMode")}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          {mode === "draft" ? t("pipeline.draftModeDesc") : t("pipeline.productionModeDesc")}
        </p>
      </CardContent>
    </Card>
  );
}
