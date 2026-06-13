"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/i18n";
import { Home, Settings, ImageIcon, Shuffle, Video, Sparkles, History, Cpu, BookTemplate, Users, FolderKanban, Film, PanelsTopLeft, Clapperboard, Wand2, Factory } from "lucide-react";

const navItems = [
  { href: "/", label: "menu.home", icon: Home },
  { href: "/settings", label: "menu.apiConfig", icon: Settings },
  "sep1",
  { href: "/generate-image", label: "menu.textToImage", icon: ImageIcon },
  { href: "/image-to-image", label: "menu.imageToImage", icon: Shuffle },
  { href: "/text-to-video", label: "menu.textToVideo", icon: Video },
  { href: "/image-to-video", label: "menu.imageToVideo", icon: Sparkles },
  "sep2",
  { href: "/story-studio", label: "menu.aiStoryStudio", icon: Wand2 },
  { href: "/pipeline", label: "menu.pipeline", icon: Factory },
  { href: "/prompts", label: "menu.promptWorkflow", icon: BookTemplate },
  { href: "/characters", label: "menu.characterLibrary", icon: Users },
  { href: "/projects", label: "menu.projectManagement", icon: FolderKanban },
  { href: "/storyboard", label: "menu.storyboard", icon: Clapperboard },
  { href: "/assets", label: "menu.assetsLibrary", icon: PanelsTopLeft },
  { href: "/editor", label: "menu.videoEditor", icon: Film },
  "sep3",
  { href: "/history", label: "menu.history", icon: History },
  { href: "/models", label: "menu.models", icon: Cpu },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const isActive = (href: string) => { if (href === "/") return pathname === "/"; return pathname.startsWith(href); };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-6">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-semibold text-lg">{t("sidebar.appName")}</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(function(item, _index) {
          if (typeof item === "string") return <Separator key={item} className="my-3" />;
          const Icon = item.icon;
          return (
            <Button key={item.href} variant={isActive(item.href) ? "secondary" : "ghost"} className={cn("w-full justify-start gap-3", isActive(item.href) && "bg-secondary font-medium")} asChild>
              <Link href={item.href}><Icon className="h-4 w-4" />{t(item.label)}</Link>
            </Button>
          );
        })}
      </nav>
      <div className="border-t p-4"><p className="text-xs text-muted-foreground text-center">{t("sidebar.appName")} {t("sidebar.version")}</p></div>
    </aside>
  );
}
