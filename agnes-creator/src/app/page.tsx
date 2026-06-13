"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, Shuffle, Video, Sparkles } from "lucide-react";

const features = [
  { title: "menu.textToImage", desc: "generation.textToImageDesc", icon: ImageIcon, href: "/generate-image", gradient: "from-violet-500 to-purple-500" },
  { title: "menu.imageToImage", desc: "generation.imageToImageDesc", icon: Shuffle, href: "/image-to-image", gradient: "from-blue-500 to-cyan-500" },
  { title: "menu.textToVideo", desc: "generation.textToVideoDesc", icon: Video, href: "/text-to-video", gradient: "from-emerald-500 to-teal-500" },
  { title: "menu.imageToVideo", desc: "generation.imageToVideoDesc", icon: Sparkles, href: "/image-to-video", gradient: "from-orange-500 to-pink-500" },
];

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3 pt-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">{t("home.title")}</h1>
          <p className="text-lg text-muted-foreground">{t("home.subtitle")}</p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild size="lg"><Link href="/settings">{t("home.configureApi")}</Link></Button>
            <Button variant="outline" size="lg" asChild><Link href="/generate-image">{t("home.startCreating")}</Link></Button>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map(function(feature) {
            const Icon = feature.icon;
            return (
              <Link key={feature.href} href={feature.href} className="group">
                <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                  <CardHeader>
                    <div className={"inline-flex rounded-lg bg-gradient-to-br " + feature.gradient + " p-2.5 text-white"}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <CardTitle className="group-hover:text-primary transition-colors">{t(feature.title)}</CardTitle>
                    <CardDescription>{t(feature.desc)}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
        <Card className="bg-muted/50">
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-full bg-primary/10 p-2"><Sparkles className="h-5 w-5 text-primary" /></div>
            <div className="space-y-1">
              <p className="font-medium">{t("home.quickStart")}</p>
              <p className="text-sm text-muted-foreground">{t("home.quickStartDesc")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
