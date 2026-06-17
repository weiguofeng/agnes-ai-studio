// ============================================================
// Agnes API Proxy
// ============================================================
// 中文说明：浏览器直连 Agnes 在部分网络环境会触发 TLS/CORS 问题，统一经由 Next.js 服务端代理转发。
// ============================================================

import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BASE_URL = "https://apihub.agnes-ai.com/v1";
const ALLOWED_HOST = "apihub.agnes-ai.com";

function normalizeBaseUrl(value: unknown): string {
  const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_BASE_URL;
  const trimmed = raw.replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname !== ALLOWED_HOST || parsed.protocol !== "https:") return DEFAULT_BASE_URL;
    return trimmed;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function buildTargetUrl(baseUrl: string, path: string[], search: string): URL {
  const baseDomain = baseUrl.replace(/\/v1$/, "");
  const targetBase = path[0] === "agnesapi" ? baseDomain : baseUrl;
  const targetUrl = new URL(targetBase + "/" + path.map(encodeURIComponent).join("/"));
  targetUrl.search = search;
  return targetUrl;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const baseUrl = normalizeBaseUrl(request.headers.get("x-agnes-base-url"));
  const targetUrl = buildTargetUrl(baseUrl, path, request.nextUrl.search);

  const apiKey = request.headers.get("x-agnes-api-key") || process.env.AGNES_API_KEY || process.env.NEXT_PUBLIC_AGNES_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: { code: "AUTH_ERROR", message: "Missing Agnes API key" } }, { status: 401 });
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Accept", request.headers.get("Accept") || "application/json");
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseBody = await response.arrayBuffer();
    if (!response.ok) {
      const preview = Buffer.from(responseBody).toString("utf8").slice(0, 500);
      console.error("[Agnes Proxy] Upstream error", response.status, targetUrl.pathname, preview);
    }

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.toLowerCase().includes("abort") || message.toLowerCase().includes("timeout");
    return NextResponse.json(
      { error: { code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR", message: message.slice(0, 300) } },
      { status: isTimeout ? 408 : 502 }
    );
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, context);
}
