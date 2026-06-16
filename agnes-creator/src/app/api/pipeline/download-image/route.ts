// ============================================================
// Pipeline Image/Video Download Proxy
// ============================================================
// Server-side download of images and videos to bypass CORS.
// Used by Production Pipeline for batch video generation.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

interface DownloadResult {
  success: boolean;
  data?: string;
  mimeType?: string;
  fileName?: string;
  error?: string;
  statusCode?: number;
  urlLength?: number;
  urlDomain?: string;
  urlProtocol?: string;
  urlHasQuery?: boolean;
  contentLength?: number;
  headers?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let body: { url?: string; shotId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to parse request body" } satisfies DownloadResult,
      { status: 400 }
    );
  }

  const { url, shotId } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { success: false, error: "Missing url parameter" } satisfies DownloadResult,
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid URL format", urlLength: url.length } satisfies DownloadResult,
      { status: 400 }
    );
  }

  const urlDomain = parsedUrl.hostname;
  const urlProtocol = parsedUrl.protocol;
  const urlHasQuery = !!parsedUrl.search;
  const urlLength = url.length;

  const logPrefix = shotId
    ? "[Pipeline Proxy] shot=".concat(shotId.slice(-8))
    : "[Pipeline Proxy]";

  console.log(
    logPrefix + " Downloading URL: " + urlLength + " chars, " +
    "domain=" + urlDomain + ", proto=" + urlProtocol + ", hasQuery=" + urlHasQuery
  );

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "image/avif,image/webp,image/apng,image/png,image/jpeg,video/mp4,video/webm,video/quicktime,*/*",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "User-Agent": "Agnes-Studio/2.4",
      },
    });

    clearTimeout(timeout);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (["content-type", "content-length", "cache-control", "expires", "last-modified"].some(p => key.toLowerCase().startsWith(p))) {
        responseHeaders[key] = value;
      }
    });

    const contentType = response.headers.get("content-type") || "unknown";
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);

    console.log(
      logPrefix + " Response: status=" + response.status + " " + response.statusText + ", " +
      "content-type=" + contentType + ", content-length=" + contentLength + ", " +
      "elapsed=" + (Date.now() - startTime) + "ms"
    );

    if (!response.ok) {
      let errorMsg = response.statusText || "Unknown";
      if (response.status === 403) {
        errorMsg = "Access denied (403 Forbidden) - possible signed URL expiration";
      } else if (response.status === 404) {
        errorMsg = "Resource not found (404 Not Found)";
      } else if (response.status === 429) {
        errorMsg = "Rate limited (429 Too Many Requests)";
      } else if (response.status >= 500) {
        errorMsg = "Server error (" + response.status + ")";
      }

      return NextResponse.json({
        success: false,
        error: errorMsg,
        statusCode: response.status,
        urlLength, urlDomain, urlProtocol, urlHasQuery,
        contentLength,
        headers: responseHeaders,
      } satisfies DownloadResult);
    }

    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      console.warn(logPrefix + " Content-Type is not image or video: " + contentType);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(
      logPrefix + " Download success: " + (buffer.length / 1024).toFixed(1) + " KB, " +
      "elapsed=" + (Date.now() - startTime) + "ms"
    );

    const base64 = buffer.toString("base64");
    const dataUrl = "data:" + contentType + ";base64," + base64;

    const pathSegments = parsedUrl.pathname.split("/");
    const rawFileName = pathSegments[pathSegments.length - 1] || "shot-" + (shotId || "unknown") + ".bin";
    const fileName = rawFileName.includes(".") ? rawFileName : "shot-" + (shotId || "unknown") + ".bin";

    return NextResponse.json({
      success: true,
      data: dataUrl,
      mimeType: contentType,
      fileName,
      urlLength, urlDomain, urlProtocol, urlHasQuery,
      contentLength: buffer.length,
      headers: responseHeaders,
    } satisfies DownloadResult);

  } catch (err) {
    const elapsed = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMessage.toLowerCase().includes("abort") || errorMessage.toLowerCase().includes("timeout");

    console.error(
      logPrefix + " Download error: " + errorMessage.slice(0, 200) + ", " +
      "elapsed=" + elapsed + "ms, isTimeout=" + isTimeout
    );

    return NextResponse.json({
      success: false,
      error: isTimeout
        ? "Download timeout (" + elapsed + "ms)"
        : "Download failed: " + errorMessage.slice(0, 200),
      statusCode: isTimeout ? 408 : 0,
      urlLength, urlDomain, urlProtocol, urlHasQuery,
    } satisfies DownloadResult, { status: 200 });
  }
}