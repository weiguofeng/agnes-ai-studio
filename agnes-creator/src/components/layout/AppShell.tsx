"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <LanguageProvider><QueryClientProvider client={queryClient}>
      <div className="min-h-screen">
        <Sidebar />
        <div className="pl-60">
          <TopBar />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </QueryClientProvider></LanguageProvider>
  );
}
