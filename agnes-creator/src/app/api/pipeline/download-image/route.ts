// ============================================================
// Pipeline Image Download Proxy
// ============================================================
// 服务端下载图片，绕过浏览器 CORS 限制
// 用于 Production Pipeline 批量图生视频时的图片获取
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
      { success: false, error: "请求体解析失败" } satisfies DownloadResult,
      { status: 400 }
    );
  }

  const { url, shotId } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { success: false, error: "缺少 url 参数" } satisfies DownloadResult,
      { status: 400 }
    );
  }

  // ------ 诊断信息 ------
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json(
      { success: false, error: "URL 格式无效", urlLength: url.length } satisfies DownloadResult,
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
    logPrefix + " 开始下载图片 URL: " + urlLength + " chars, " +
    "domain=" + urlDomain + ", proto=" + urlProtocol + ", hasQuery=" + urlHasQuery
  );

  // ------ 执行下载 ------
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "image/avif,image/webp,image/apng,image/png,image/jpeg,*/*",
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
      logPrefix + " 响应: status=" + response.status + " " + response.statusText + ", " +
      "content-type=" + contentType + ", content-length=" + contentLength + ", " +
      "耗时=" + (Date.now() - startTime) + "ms"
    );

    if (!response.ok) {
      let errorMsg = response.statusText || "Unknown";
      if (response.status === 403) {
        errorMsg = "图片访问被拒绝 (403 Forbidden) - 可能是 Signed URL 过期或权限不足";
      } else if (response.status === 404) {
        errorMsg = "图片不存在 (404 Not Found)";
      } else if (response.status === 429) {
        errorMsg = "请求频率过高 (429 Too Many Requests)";
      } else if (response.status >= 500) {
        errorMsg = "图片服务器错误 (" + response.status + ")";
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

    if (!contentType.startsWith("image/")) {
      console.warn(logPrefix + " 响应 Content-Type 不是图片: " + contentType);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(
      logPrefix + " 下载成功: " + (buffer.length / 1024).toFixed(1) + " KB, " +
      "耗时=" + (Date.now() - startTime) + "ms"
    );

    const base64 = buffer.toString("base64");
    const dataUrl = "data:" + contentType + ";base64," + base64;

    const pathSegments = parsedUrl.pathname.split("/");
    const rawFileName = pathSegments[pathSegments.length - 1] || "shot-" + (shotId || "unknown") + ".png";
    const fileName = rawFileName.includes(".") ? rawFileName : "shot-" + (shotId || "unknown") + ".png";

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
      logPrefix + " 下载异常: " + errorMessage.slice(0, 200) + ", " +
      "耗时=" + elapsed + "ms, isTimeout=" + isTimeout
    );

    return NextResponse.json({
      success: false,
      error: isTimeout
        ? "图片下载超时 (" + elapsed + "ms)"
        : "图片下载失败: " + errorMessage.slice(0, 200),
      statusCode: isTimeout ? 408 : 0,
      urlLength, urlDomain, urlProtocol, urlHasQuery,
    } satisfies DownloadResult, { status: 200 });
  }
}