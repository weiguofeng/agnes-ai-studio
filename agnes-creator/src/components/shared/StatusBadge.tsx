import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, Clock, Upload, Send, AlertTriangle, DownloadCloud } from "lucide-react";

type AnyStatus = string;

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Loader2; animate?: boolean }> = {
  queued:         { label: "排队中",     className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
  uploading:      { label: "上传中",     className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: Upload, animate: true },
  submitted:      { label: "已提交",     className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: Send },
  processing:     { label: "处理中",     className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: Loader2, animate: true },
  rate_limited:   { label: "服务器繁忙",  className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: AlertTriangle, animate: true },
  awaiting_asset: { label: "同步文件中", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", icon: DownloadCloud, animate: true },
  completed:      { label: "已完成",     className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  failed:         { label: "失败",       className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  timeout:        { label: "超时",       className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  cancelled:      { label: "已取消",     className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", icon: XCircle },
};

export function StatusBadge({ status, className }: { status: AnyStatus; className?: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap", cfg.className, className)}>
      <Icon className={cn("h-3 w-3 shrink-0", cfg.animate && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
