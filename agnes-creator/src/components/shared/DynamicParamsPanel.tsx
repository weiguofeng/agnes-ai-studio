// ============================================================
// DynamicParamsPanel — 动态参数面板
// ============================================================
// 根据选择的模型动态展示可配置参数
// ============================================================

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getParamsForModel, type ParamDefinition } from "@/services/modelSchema";
import { Settings2 } from "lucide-react";

interface Props {
  modelId: string;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function DynamicParamsPanel({ modelId, values, onChange }: Props) {
  const params = getParamsForModel(modelId);

  if (params.length === 0) return null;

  return (
    <Card className="border-muted">
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          模型参数
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {params.map((param) => (
          <ParamField
            key={param.key}
            param={param}
            value={values[param.key] ?? param.default}
            onChange={(v) => onChange(param.key, v)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ParamField({ param, value, onChange }: {
  param: ParamDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (param.key === "negative_prompt") return null; // handled by PromptAdvancedPanel

  switch (param.type) {
    case "select":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{param.label}</Label>
          <select
            value={String(value ?? param.default)}
            onChange={(e) => onChange(e.target.value)}
            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {param.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
          {param.description && (
            <p className="text-[10px] text-muted-foreground/60">{param.description}</p>
          )}
        </div>
      );

    case "slider":
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{param.label}</Label>
            <span className="text-xs text-muted-foreground">{String(value ?? param.default)}</span>
          </div>
          <input
            type="range"
            min={param.min ?? 0}
            max={param.max ?? 100}
            step={param.step ?? 1}
            value={Number(value ?? param.default)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
          />
          {param.description && (
            <p className="text-[10px] text-muted-foreground/60">{param.description}</p>
          )}
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{param.label}</Label>
          <Input
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : param.default;
              onChange(isNaN(v as number) ? param.default : v);
            }}
            min={param.min}
            max={param.max}
            step={param.step}
            className="h-8 text-xs"
          />
          {param.description && (
            <p className="text-[10px] text-muted-foreground/60">{param.description}</p>
          )}
        </div>
      );

    default:
      return null;
  }
}
