// ============================================================
// /models — 模型中心页面
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useConfig } from "@/hooks/useConfig";
import { REGISTERED_MODELS, getModelsByCategory } from "@/services/modelSchema";
import {
  Cpu,
  ImageIcon,
  Video,
  Check,
  Sparkles,
  Zap,
  Settings,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function ModelsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("all");
  const { textToImageModel, imageToImageModel, textToVideoModel, imageToVideoModel,
    setTextToImageModel, setImageToImageModel, setTextToVideoModel, setImageToVideoModel } = useConfig();

  const imageModels = getModelsByCategory("image");
  const videoModels = getModelsByCategory("video");

  const filteredModels = useMemo(() => {
    switch (activeTab) {
      case "image": return imageModels;
      case "video": return videoModels;
      default: return REGISTERED_MODELS;
    }
  }, [activeTab, imageModels, videoModels]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 p-2.5 text-white shadow-lg shadow-blue-500/20">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("models.title")}</h1>
            <p className="text-sm text-muted-foreground">
              浏览可用模型并设置默认生成模型
            </p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings">
                <Settings className="mr-1.5 h-4 w-4" />
                API 配置
              </Link>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">全部 ({REGISTERED_MODELS.length})</TabsTrigger>
            <TabsTrigger value="image">图片模型 ({imageModels.length})</TabsTrigger>
            <TabsTrigger value="video">视频模型 ({videoModels.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredModels.map((model) => {
                const isImageDefault = model.id === textToImageModel || model.id === imageToImageModel;
                const isVideoDefault = model.id === textToVideoModel || model.id === imageToVideoModel;
                const isDefault = isImageDefault || isVideoDefault;

                return (
                  <Card key={model.id} className={cn(
                    "transition-all hover:shadow-md",
                    isDefault && "border-primary/50 bg-primary/5"
                  )}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "rounded-lg p-2",
                            model.category === "image" 
                              ? "bg-purple-100 dark:bg-purple-900/30"
                              : "bg-emerald-100 dark:bg-emerald-900/30"
                          )}>
                            {model.category === "image" 
                              ? <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              : <Video className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            }
                          </div>
                          <div>
                            <CardTitle className="text-sm">{model.name}</CardTitle>
                            <CardDescription className="text-xs">{model.id}</CardDescription>
                          </div>
                        </div>
                        {isDefault && (
                          <Badge variant="default" className="text-[10px] h-5">
                            <Check className="h-3 w-3 mr-1" />默认
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">{model.description}</p>

                      {/* 参数列表 */}
                      <div className="flex flex-wrap gap-1">
                        {model.params.slice(0, 5).map((p) => (
                          <span key={p.key} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {p.label}
                          </span>
                        ))}
                        {model.params.length > 5 && (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            +{model.params.length - 5}
                          </span>
                        )}
                      </div>

                      {/* 设为默认按钮 */}
                      <div className="flex gap-2 pt-1">
                        {model.category === "image" && (
                          <Button
                            variant={isImageDefault ? "secondary" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setTextToImageModel(model.id);
                              setImageToImageModel(model.id);
                            }}
                          >
                            {isImageDefault ? (
                              <><Check className="mr-1 h-3 w-3" /> 默认图片模型</>
                            ) : (
                              <>设为图片默认</>
                            )}
                          </Button>
                        )}
                        {model.category === "video" && (
                          <Button
                            variant={isVideoDefault ? "secondary" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setTextToVideoModel(model.id);
                              setImageToVideoModel(model.id);
                            }}
                          >
                            {isVideoDefault ? (
                              <><Check className="mr-1 h-3 w-3" /> 默认视频模型</>
                            ) : (
                              <>设为视频默认</>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
