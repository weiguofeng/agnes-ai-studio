# API 文档

> [English](API_EN.md) · [架构](ARCHITECTURE.md) · [部署](DEPLOYMENT.md)

## 概述
所有 API 请求通过 Next.js 服务端代理转发，避免浏览器 CORS 和 TLS 问题。

## 代理路由
| 路由 | 目标 |
|------|------|
| /api/agnes/v1/text-to-image | apihub.agnes-ai.com/v1/text-to-image |
| /api/agnes/v1/image-to-image | apihub.agnes-ai.com/v1/image-to-image |
| /api/agnes/v1/videos | apihub.agnes-ai.com/v1/videos |
| /api/agnes/agnesapi | apihub.agnes-ai.com/agnesapi |
| /api/pipeline/download-image | 服务端下载代理 |

## 认证
请求头添加 `x-agnes-api-key` 或 `Authorization: Bearer <key>`。优先级: 请求头 > 环境变量 > localStorage > 默认值。

## SDK 使用
```typescript
import { agnes } from "@/services/agnes";

// 文生图
const images = await agnes.image.generate({ prompt: "...", size: "1024x1024" });

// 图生图
const images = await agnes.image.edit({ image: file, prompt: "...", strength: 0.7 });

// 图生视频（异步轮询等待）
const video = await agnes.video.createFromImageAndWait({ image: file });

// 动态更新配置
agnes.configure({ apiKey: "sk-xxx", model: "agnes-xl-v2" });
```

## 视频生成
- POST /v1/videos: 创建任务 (params: image, prompt, num_frames, frame_rate, size, negative_prompt)
- GET /agnesapi?video_id=<ID>: 查询状态 (returns: status, video_url)

## 限流
内置 PollRateLimiter: 创建 >=5s, 查询 >=12s, 突发 20s/3次, 429 退避 4x

## 错误处理
所有错误抛出 `AgnesApiError` (status, code, message)
