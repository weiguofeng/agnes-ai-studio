"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------
// Props
// -----------------------------------------------------------

interface PromptInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onSubmit"> {
  /** 最大字符数，0 表示不限制 */
  maxLength?: number;
  /** 当前已输入字符数（若传入则覆盖自动计算） */
  currentLength?: number;
  /** 按 Ctrl/Cmd + Enter 时触发 */
  onSubmit?: () => void;
  /** 输入框标签 */
  label?: string;
  /** 底部提示文字 */
  hint?: string;
}

// -----------------------------------------------------------
// Component
// -----------------------------------------------------------

export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(
  (
    {
      className,
      maxLength = 1000,
      currentLength,
      onSubmit,
      label = "Prompt",
      hint,
      onChange,
      value,
      disabled,
      ...props
    },
    ref
  ) => {
    const len =
      currentLength ?? (typeof value === "string" ? value.length : 0);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
      }
      props.onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (maxLength > 0) {
        e.target.value = e.target.value.slice(0, maxLength);
      }
      onChange?.(e);
    };

    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(
              "flex w-full rounded-lg border border-input bg-background px-3 py-2",
              "text-sm ring-offset-background transition-all",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "resize-none",
              className
            )}
            {...props}
          />
          {maxLength > 0 && (
            <span className="absolute bottom-2 right-3 text-xs text-muted-foreground/60 select-none pointer-events-none">
              {len}/{maxLength}
            </span>
          )}
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground/60">{hint}</p>
        )}
      </div>
    );
  }
);

PromptInput.displayName = "PromptInput";
