"use client";

import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, X, AlertCircle, FileImage, ZoomIn } from "lucide-react";

export interface FileValidation {
  maxSizeMB?: number;
  acceptTypes?: string[];
  acceptExtensions?: string[];
}

interface FileUploaderProps {
  /** 当前选中的文件 */
  file: File | null;
  /** 预览 URL */
  previewUrl: string | null;
  /** 文件选中回调 */
  onFileChange: (file: File | null, previewUrl: string | null) => void;
  /** 错误信息 */
  error?: string | null;
  /** 验证规则 */
  validation?: FileValidation;
  /** 禁用 */
  disabled?: boolean;
  /** 额外的 CSS */
  className?: string;
  /** 标签文字 */
  label?: string;
  /** 提示文字 */
  hint?: string;
}

const DEFAULT_VALIDATION: FileValidation = {
  maxSizeMB: 10,
  acceptTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  acceptExtensions: [".png", ".jpg", ".jpeg", ".webp"],
};

export function FileUploader({
  file, previewUrl, onFileChange, error: externalError,
  validation = DEFAULT_VALIDATION, disabled = false,
  className, label = "上传图片", hint,
}: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const error = externalError ?? localError;

  const validateFile = useCallback((f: File): string | null => {
    if (validation.acceptTypes && !validation.acceptTypes.includes(f.type)) {
      return `不支持的文件格式 (${f.type || "未知"})。支持：${validation.acceptExtensions?.join(", ") || ""}`;
    }
    const maxBytes = (validation.maxSizeMB ?? 10) * 1024 * 1024;
    if (f.size > maxBytes) {
      return `文件过大 (${(f.size / 1024 / 1024).toFixed(1)}MB)，最大 ${validation.maxSizeMB}MB`;
    }
    return null;
  }, [validation]);

  const handleFile = useCallback((f: File) => {
    setLocalError(null);
    const err = validateFile(f);
    if (err) { setLocalError(err); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onFileChange(f, URL.createObjectURL(f));
  }, [previewUrl, onFileChange, validateFile]);

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onFileChange(null, null);
    setLocalError(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium">{label}</label>}

      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <div className="rounded-full bg-muted p-3 mb-3">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">拖拽图片到此处，或点击选择</p>
          <p className="text-xs text-muted-foreground mt-1">
            支持 {validation.acceptExtensions?.join(", ") || "常见图片格式"}，最大 {validation.maxSizeMB}MB
          </p>
          <input ref={inputRef} type="file" accept={validation.acceptTypes?.join(",")} onChange={handleSelect}
            className="hidden" disabled={disabled} />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border bg-muted/20 group">
          <img src={previewUrl!} alt="预览" className="w-full h-48 object-contain" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3
            opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-2">
            <Button size="sm" variant="secondary" className="backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
              <ZoomIn className="mr-1 h-3.5 w-3.5" />更换
            </Button>
            <Button size="sm" variant="secondary" className="backdrop-blur-sm bg-white/90 hover:bg-destructive hover:text-white"
              onClick={(e) => { e.stopPropagation(); handleRemove(); }}>
              <X className="mr-1 h-3.5 w-3.5" />移除
            </Button>
          </div>
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
              <FileImage className="h-3 w-3" />{(file.size / 1024 / 1024).toFixed(1)}MB
            </span>
          </div>
          <input ref={inputRef} type="file" accept={validation.acceptTypes?.join(",")} onChange={handleSelect}
            className="hidden" disabled={disabled} />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {hint && !error && <p className="text-xs text-muted-foreground/60">{hint}</p>}
    </div>
  );
}
