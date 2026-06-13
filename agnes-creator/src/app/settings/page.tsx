"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/i18n";
import { useConfig } from "@/hooks/useConfig";
import { ShieldCheck, Terminal, Database, Globe } from "lucide-react";
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Sparkles } from "lucide-react";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { apiKey, baseUrl, model, textToImageModel, imageToImageModel, textToVideoModel, imageToVideoModel, setApiKey, setBaseUrl, setModel, setTextToImageModel, setImageToImageModel, setTextToVideoModel, setImageToVideoModel, reset, isConfigured, configSource } = useConfig();

  const [localKey, setLocalKey] = useState(apiKey);
  const [localUrl, setLocalUrl] = useState(baseUrl);
  const [localModel, setLocalModel] = useState(model);
  const [localTTI, setLocalTTI] = useState(textToImageModel ?? "");
  const [localITI, setLocalITI] = useState(imageToImageModel ?? "");
  const [localTTV, setLocalTTV] = useState(textToVideoModel ?? "");
  const [localITV, setLocalITV] = useState(imageToVideoModel ?? "");
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const handleSave = () => {
    setApiKey(localKey.trim());
    setBaseUrl(localUrl.trim());
    setModel(localModel.trim());
    setTextToImageModel(localTTI.trim());
    setImageToImageModel(localITI.trim());
    setTextToVideoModel(localTTV.trim());
    setImageToVideoModel(localITV.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMessage("");
    setAvailableModels([]);
    try {
      const res = await fetch(`${localUrl.trim()}/models`, {
        headers: { Authorization: `Bearer ${localKey.trim()}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const modelList: Array<{ id: string }> = data?.data ?? [];
      const imageModels = modelList.filter((m) => m.id.includes("image"));
      const modelNames = modelList.map((m) => m.id).slice(0, 30);
      setAvailableModels(modelList.map((m) => m.id));
      setTestStatus("success");
      if (imageModels.length > 0) {
        setTestMessage(`可用模型: ${modelNames.join(", ")}`);
        setLocalModel(imageModels[0].id);
      } else if (modelList.length > 0) {
        setTestMessage(`可用模型: ${modelNames.join(", ")}`);
      } else {
        setTestMessage("连接成功，但未返回模型列表");
      }
    } catch (err) {
      setTestStatus("error");
      setTestMessage(err instanceof Error ? err.message : "连接失败，请检查配置");
    }
  };

  const hasChanges = localKey !== apiKey || localUrl !== baseUrl || localModel !== model || localTTI !== (textToImageModel ?? "") || localITI !== (imageToImageModel ?? "") || localTTV !== (textToVideoModel ?? "") || localITV !== (imageToVideoModel ?? "");

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">⚙️ {t("settings.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>连接信息</CardTitle>
            <CardDescription>填入你的 Agnes API Key 和相关端点信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://api.agnesai.com/v1"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
              />
            </div>

            {/* Model Name */}
            <div className="space-y-2">
              <Label htmlFor="model">模型名称</Label>
              <Input
                id="model"
                placeholder="agnes-xl-v2"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
              />
              {availableModels.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {availableModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLocalModel(m)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        localModel === m
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} disabled={!hasChanges && isConfigured}>
                {saved ? (
                  <>
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    已保存
                  </>
                ) : (
                  "保存配置"
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={!localKey.trim() || !localUrl.trim() || testStatus === "testing"}
              >
                {testStatus === "testing" ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    测试中...
                  </>
                ) : (
                  "测试连接"
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                  setLocalKey("");
                  setLocalUrl("https://apihub.agnes-ai.com/v1");
                  setLocalModel("agnes-image-2.1-flash");
                }}
              >
                重置
              </Button>
            </div>

            {/* Test result */}
            {testStatus === "success" && (
              <div className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}
            {testStatus === "error" && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{testMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>

        
        {/* 各功能模型配置 */}
        <Card>
          <CardHeader>
            <CardTitle>各功能模型配置</CardTitle>
            <CardDescription>为不同功能指定专用的模型，留空则使用默认模型</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ttiModel">文生图模型</Label>
                <Input id="ttiModel" placeholder="agnes-image-2.1-flash" value={localTTI} onChange={(e) => setLocalTTI(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itiModel">图生图模型</Label>
                <Input id="itiModel" placeholder="agnes-image-2.1-flash" value={localITI} onChange={(e) => setLocalITI(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttvModel">文生视频模型</Label>
                <Input id="ttvModel" placeholder="agnes-video-v2.0" value={localTTV} onChange={(e) => setLocalTTV(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itvModel">图生视频模型</Label>
                <Input id="itvModel" placeholder="agnes-video-v2.0" value={localITV} onChange={(e) => setLocalITV(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>


        {/* 配置来源诊断 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              配置诊断
            </CardTitle>
            <CardDescription>查看当前 API Key 的来源和配置状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  API Key 来源
                </span>
                <span className="font-medium">
                  {configSource === "env" && "环境变量 AGNES_API_KEY"}
                  {configSource === "nextPublicEnv" && "环境变量 NEXT_PUBLIC_AGNES_API_KEY"}
                  {configSource === "localStorage" && "本地存储 (Settings 页面)"}
                  {configSource === "default" && "未配置"}
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  连接状态
                </span>
                <span className={`font-medium ${isConfigured ? "text-green-500" : "text-destructive"}`}>
                  {isConfigured ? "已配置" : "未配置"}
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Base URL
                </span>
                <span className="font-medium text-xs truncate">{baseUrl}</span>
              </div>
              <div className="space-y-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5" />
                  默认模型
                </span>
                <span className="font-medium text-xs">{model}</span>
              </div>
            </div>
            {configSource === "default" && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>API Key 未配置。请在下方输入 API Key 并保存，或通过环境变量 AGNES_API_KEY / NEXT_PUBLIC_AGNES_API_KEY 配置。</span>
              </div>
            )}
            {configSource !== "default" && !isConfigured && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>检测到配置来源，但配置不完整。请检查环境变量或本地存储。</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-muted/50">
          <CardContent className="flex items-start gap-3 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">安全提示</p>
              <p>你的 API Key 仅保存在浏览器本地存储 (localStorage) 中，不会发送到任何第三方服务器。</p>
              <p>每次 API 请求时从本地读取配置，即时生效，无需刷新页面。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
