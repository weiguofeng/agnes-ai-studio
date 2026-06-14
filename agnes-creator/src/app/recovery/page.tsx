"use client";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { History, Download, Upload, RefreshCw, CheckCircle2, AlertTriangle, Clock, FileJson } from "lucide-react";
import { getLastSavedAt } from "@/services/ProjectAutoSaveService";
import { downloadBackup, readBackupFile } from "@/services/BackupService";
import { restoreProject } from "@/services/RestoreService";
import { runIntegrityCheck } from "@/services/AssetIntegrityService";
import { useProjectStore } from "@/stores/projectStore";

export default function RecoveryPage() {
  const { t } = useTranslation();
  const { projects } = useProjectStore();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(getLastSavedAt());
  const [backupResult, setBackupResult] = useState<string>("");
  const [restoreResult, setRestoreResult] = useState<string>("");
  const [integrityResult, setIntegrityResult] = useState<string>("");
  const [isIntegrityRunning, setIsIntegrityRunning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setLastSavedAt(getLastSavedAt()), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleExportBackup = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    const ok = await downloadBackup(selectedProjectId, project.name);
    setBackupResult(ok ? t("recovery.backupSuccess") : t("recovery.backupFailed"));
    setTimeout(() => setBackupResult(""), 3000);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    const result = await readBackupFile(file);
    if (result.success && result.data) {
      const restore = await restoreProject(result.data);
      setRestoreResult(restore.success ? t("recovery.restoreSuccess", { count: restore.restoredItems.length }) : t("recovery.restoreFailed", { error: restore.error || "" }));
    } else {
      setRestoreResult(t("recovery.readBackupFailed", { error: result.error || "" }));
    }
    setIsRestoring(false);
    setTimeout(() => setRestoreResult(""), 5000);
  };

  const handleIntegrityCheck = async () => {
    setIsIntegrityRunning(true);
    setIntegrityResult(t("recovery.checking"));
    try {
      const result = await runIntegrityCheck();
      setIntegrityResult(t("recovery.integritySummary", { verified: result.verified, total: result.totalChecked, corrupted: result.corrupted, missing: result.missing, expired: result.expired }));
    } catch (err) {
      setIntegrityResult(t("recovery.checkFailed", { error: String(err) }));
    }
    setIsIntegrityRunning(false);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            {t("menu.recoveryCenter")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("recovery.subtitle")}
          </p>
        </div>

        {/* Auto Save Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {t("pipeline.autoSave")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {lastSavedAt
                  ? t("recovery.lastSavedAt", { time: new Date(lastSavedAt).toLocaleString() })
                  : t("recovery.noAutoSave")}
              </span>
              {lastSavedAt && Date.now() - lastSavedAt < 60000 && (
                <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {t("recovery.normal")}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Backup */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              {t("pipeline.backup")}
            </CardTitle>
            <CardDescription>{t("recovery.backupDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">{t("recovery.selectProject")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button onClick={handleExportBackup} disabled={!selectedProjectId} className="gap-1.5">
              <FileJson className="h-4 w-4" /> {t("pipeline.exportBackup")}
            </Button>
            {backupResult && <p className="text-sm text-green-500">{backupResult}</p>}
          </CardContent>
        </Card>

        {/* Restore */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              {t("pipeline.restore")}
            </CardTitle>
            <CardDescription>{t("recovery.restoreDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" className="relative" disabled={isRestoring}>
                <Upload className="h-4 w-4 mr-1.5" />
                {t("pipeline.importBackup")}
                <input
                  type="file"
                  accept=".json,.project.json"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleImportBackup}
                />
              </Button>
              {isRestoring && <RefreshCw className="h-4 w-4 animate-spin" />}
            </div>
            {restoreResult && (
              <p className={`text-sm ${restoreResult.includes("失败") ? "text-red-500" : "text-green-500"}`}>
                {restoreResult}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Integrity Check */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" />
              {t("pipeline.integrityCheck")}
            </CardTitle>
            <CardDescription>{t("recovery.integrityDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleIntegrityCheck} disabled={isIntegrityRunning} className="gap-1.5">
              {isIntegrityRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("recovery.startCheck")}
            </Button>
            {integrityResult && (
              <div className={`flex items-center gap-2 text-sm ${integrityResult.includes(t("common.error")) || integrityResult.includes(t("recovery.corrupted")) ? "text-red-500" : "text-green-500"}`}>
                {integrityResult.includes(t("common.error")) || integrityResult.includes(t("recovery.corrupted")) ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {integrityResult}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
