// ============================================================
// PromptAdvancedPanel — 高级参数面板
// ============================================================

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Sparkles, Save, RotateCcw } from "lucide-react";

export interface AdvancedParams {
  negativePrompt: string;
  seed: number;
  cfgScale: number;
  steps: number;
  promptEnhance: boolean;
}

interface Props {
  value: AdvancedParams;
  onChange: (params: AdvancedParams) => void;
  showSteps?: boolean;
  showCfg?: boolean;
}

const DEFAULTS: AdvancedParams = {
  negativePrompt: "",
  seed: -1,
  cfgScale: 7.5,
  steps: 20,
  promptEnhance: false,
};

export function PromptAdvancedPanel({ value, onChange, showSteps = true, showCfg = true }: Props) {
  const [open, setOpen] = useState(false);

  const update = (patch: Partial<AdvancedParams>) => {
    onChange({ ...value, ...patch });
  };

  const resetAll = () => {
    onChange({ ...DEFAULTS });
  };

  return (
    <Card className="border-muted">
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span>高级参数</span>
            {(value.seed !== -1 || value.negativePrompt || value.cfgScale !== 7.5 || value.steps !== 20 || value.promptEnhance) && (
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            )}
          </div>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="px-4 pb-4 space-y-4">
          {/* Negative Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs">负面提示词 (Negative Prompt)</Label>
            <textarea
              value={value.negativePrompt}
              onChange={(e) => update({ negativePrompt: e.target.value })}
              placeholder="不希望出现的内容，如：模糊、变形、多余的手指..."
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Seed */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">随机种子 (Seed)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={() => update({ seed: -1 })}
              >
                <RotateCcw className="h-3 w-3 mr-1" />随机
              </Button>
            </div>
            <Input
              type="number"
              value={value.seed === -1 ? "" : value.seed}
              onChange={(e) => {
                const v = e.target.value ? parseInt(e.target.value) : -1;
                update({ seed: isNaN(v) ? -1 : v });
              }}
              placeholder="-1 (随机)"
              className="h-8 text-xs"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={resetAll}
            >
              <RotateCcw className="mr-1 h-3 w-3" />重置为默认
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export { DEFAULTS as DEFAULT_ADVANCED_PARAMS };
export type { AdvancedParams as AdvancedParamsType };
