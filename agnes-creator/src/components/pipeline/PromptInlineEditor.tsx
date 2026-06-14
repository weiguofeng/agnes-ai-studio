"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n";
import { usePromptHistoryStore, type PromptVersion } from "@/stores/promptHistoryStore";
import { Edit3, Save, RotateCcw, History } from "lucide-react";

interface PromptInlineEditorProps {
  shotId: string;
  initialPrompt: string;
  defaultPrompt: string;
  onSave: (prompt: string) => void;
}

const EMPTY_HISTORY: PromptVersion[] = [];

export function PromptInlineEditor({ shotId, initialPrompt, defaultPrompt, onSave }: PromptInlineEditorProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt || defaultPrompt);
  const historyVersions = usePromptHistoryStore((s) => (s.history || {})[shotId] || EMPTY_HISTORY);
  const saveVersion = usePromptHistoryStore((s) => s.saveVersion);
  const [showHistory, setShowHistory] = useState(false);

  const handleSave = () => {
    saveVersion(shotId, prompt);
    onSave(prompt);
    setIsEditing(false);
  };

  const handleReset = () => {
    setPrompt(defaultPrompt);
    onSave(defaultPrompt);
    setIsEditing(false);
  };

  const displayPrompt = initialPrompt || defaultPrompt || "-";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Edit3 className="h-3 w-3" />
          {isEditing ? t("common.close") : t("pipeline.editPrompt")}
        </button>
        {!isEditing && historyVersions.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <History className="h-3 w-3" />
            {t("pipeline.promptHistory")} ({historyVersions.length})
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-1.5">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[84px] text-xs"
            placeholder={defaultPrompt}
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-[10px] px-2" onClick={handleSave}>
              <Save className="h-3 w-3 mr-1" />{t("pipeline.savePrompt")}
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={handleReset}>
              <RotateCcw className="h-3 w-3 mr-1" />{t("pipeline.resetPrompt")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
          {displayPrompt}
        </p>
      )}

      {showHistory && historyVersions.length > 0 && (
        <div className="rounded-md border bg-card p-2 space-y-1 max-h-[160px] overflow-y-auto">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">{t("pipeline.promptHistory")}</p>
          {historyVersions.map((v, i) => (
            <div key={i} className="group flex items-start gap-1 text-[10px] p-1 rounded bg-muted/50 cursor-pointer hover:bg-muted"
              onClick={() => { setPrompt(v.prompt); setShowHistory(false); }}>
              <span className="flex-1 truncate">{v.prompt.slice(0, 80)}</span>
              <span className="shrink-0 text-[8px] text-muted-foreground opacity-0 group-hover:opacity-100">
                {new Date(v.savedAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
