"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";
import { useTranslation } from "@/i18n";
import { VIDEO_DURATION_PRESETS, DEFAULT_DURATION_FRAMES } from "@/lib/imageCompositor";

interface VideoDurationSelectorProps {
  currentFrames?: number;
  onChange: (frames: number) => void;
}

export function VideoDurationSelector({ currentFrames, onChange }: VideoDurationSelectorProps) {
  const { t } = useTranslation();
  const activeFrames = currentFrames || DEFAULT_DURATION_FRAMES;
  const allPresets = VIDEO_DURATION_PRESETS;
  const isCustomPreset = !allPresets.some((p) => p.frames === activeFrames);
  const [showCustom, setShowCustom] = useState(isCustomPreset);
  const [customSeconds, setCustomSeconds] = useState(String(Math.round(activeFrames / 24)));

  const handleCustomChange = (val: string) => {
    setCustomSeconds(val);
    const sec = parseInt(val, 10);
    if (!isNaN(sec) && sec >= 1 && sec <= 30) {
      onChange(Math.round(sec * 24));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{t("pipeline.videoDuration")}</span>
        <span className="text-[11px] font-mono text-muted-foreground">
          ({(activeFrames / 24).toFixed(1)}{t("pipeline.durationSeconds")})
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {allPresets.map((preset) => (
          <Button
            key={preset.label}
            variant={activeFrames === preset.frames ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2 min-w-[36px]"
            onClick={() => { setShowCustom(false); onChange(preset.frames); }}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          variant={showCustom ? "default" : "outline"}
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={() => setShowCustom(true)}
        >
          {t("pipeline.customDuration")}
        </Button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            max={30}
            value={customSeconds}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="h-6 w-16 text-[10px]"
          />
          <span className="text-[10px] text-muted-foreground">{t("pipeline.durationSeconds")}</span>
        </div>
      )}
    </div>
  );
}
