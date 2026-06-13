"use client";

import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GenerationLayoutProps {
  /** 页面图标 (lucide 组件) */
  icon: ReactNode;
  /** 页面标题 */
  title: string;
  /** 页面描述 */
  description: string;
  /** 左侧参数面板 (通常 7/12 宽度) */
  leftPanel: ReactNode;
  /** 右侧任务结果面板 (通常 5/12 宽度) */
  rightPanel: ReactNode;
  /** 背景渐变色 (tailwind class, e.g. "via-emerald-50/20") */
  bgGradient?: string;
  /** 是否全宽布局 */
  fullWidth?: boolean;
}

export function GenerationLayout({
  icon, title, description, leftPanel, rightPanel,
  bgGradient = "via-emerald-50/20",
  fullWidth = false,
}: GenerationLayoutProps) {
  return (
    <AppShell>
      <div className={cn(
        "min-h-screen bg-gradient-to-b from-background to-background dark:from-background dark:to-background",
        bgGradient && `from-background ${bgGradient} to-background dark:from-background dark:${bgGradient.replace("dark:", "").replace("via-", "dark:via-")} dark:to-background`
      )}>
        <div className={cn(
          "px-4 py-6 sm:px-6 lg:px-8",
          fullWidth ? "mx-auto max-w-full" : "mx-auto max-w-7xl"
        )}>
          {/* 页面标题 */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 shadow-lg shadow-emerald-500/25">
                {icon}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>

          {/* 双栏布局 */}
          <div className="grid gap-8 lg:grid-cols-12">
            {/* 左侧参数区 (7/12) */}
            <div className="space-y-6 lg:col-span-7">
              {leftPanel}
            </div>

            {/* 右侧结果区 (5/12) */}
            <div className="space-y-4 lg:col-span-5">
              {rightPanel}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
