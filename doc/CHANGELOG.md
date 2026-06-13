# Changelog

## V2.4 (2026-06-13)

### Fixed
- **批量图生视频失败修复**：删除文生视频自动降级逻辑，新增精细化错误状态和诊断系统
  - 新增 `pipelineImageDownloader.ts`：URL 诊断、服务端代理下载、指数退避重试
  - 新增 `/api/pipeline/download-image` 路由：服务端图片下载代理（绕过 CORS）
  - 新增 7 种 ProductionStatus：`image_fetch_failed`, `image_expired`, `image_cors_blocked`, `image_not_found`, `image_rate_limited`, `video_api_failed`, `video_timeout`
  - 修复 `pipeline/page.tsx`：删除 `agnes.video.create()` 文生视频降级，使用 `downloadImageWithRetry` + `createFromImage`

### Added
- **Stress Test Suite**: 47 个单元测试，覆盖 URL 诊断、错误映射、重试策略、队列管理
- **测试报告**: 10 阶段压力测试报告，涵盖 Baseline、Batch、Large Project、Failure Recovery、Retry Strategy、Character Consistency、Memory、Queue Recovery、Production Simulation

### QA
- TypeScript 编译: 0 错误
- ESLint: 0 错误
- 单元测试: 47/47 通过
