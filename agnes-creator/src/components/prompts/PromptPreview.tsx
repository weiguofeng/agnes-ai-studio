"use client";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { PromptTemplate } from "@/types";
import { extractVariables, renderPrompt } from "@/stores/promptStore";
import { cn } from "@/lib/utils";

interface PromptPreviewProps {
  template: PromptTemplate;
  initialValues?: Record<string, string>;
}

export function PromptPreview({ template, initialValues = {} }: PromptPreviewProps) {
  const { t } = useTranslation();
  const variables = useMemo(() => extractVariables(template.content), [template.content]);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    variables.forEach((v) => { init[v] = initialValues[v] || ""; });
    return init;
  });

  const rendered = useMemo(() => renderPrompt(template.content, values), [template.content, values]);
  const missingVars = variables.filter((v) => !values[v]?.trim());
  const isValid = missingVars.length === 0;

  return (
    <Card className="p-4 space-y-4 bg-white/[0.03] backdrop-blur-xl border-white/5">
      <div className="flex items-center gap-2 text-sm font-medium">
        {isValid ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <AlertCircle className="h-4 w-4 text-yellow-400" />}
        <span>{isValid ? t("prompt.allFilled") : missingVars.length + " " + t("prompt.varsRemaining")}</span>
      </div>
      {variables.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {variables.map((v) => (
            <div key={v} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{"{" + v + "}"}</Label>
              <Input value={values[v] || ""} onChange={(e) => setValues({ ...values, [v]: e.target.value })} placeholder={t("prompt.variables") + " " + v} className={cn("h-8 text-sm", !values[v]?.trim() && "border-yellow-500/30")} />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("prompt.preview")}</Label>
        <div className={cn("rounded-md border p-3 text-sm whitespace-pre-wrap min-h-[60px]", !isValid ? "bg-yellow-500/5 border-yellow-500/20 text-muted-foreground" : "bg-purple-500/5 border-purple-500/20")}>
          {rendered}
        </div>
      </div>
    </Card>
  );
}
