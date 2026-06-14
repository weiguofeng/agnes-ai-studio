# Changelog

## V2.8.1 (2026-06-14)

### Fixed
- **Production Queue 视频批量生成 404**：Agnes 视频创建响应现在会解析顶层与嵌套 `video_id`，生产流水线轮询优先使用 `videoId`，避免把 `task_id` 当成 `/agnesapi?video_id=` 查询参数导致 `task not found`。
- **批量暂停不终止任务**：批量暂停/终止会取消选中镜头的本地轮询与实时任务，并将正在生成中的图片/视频状态标记为 `cancelled`，不会误改已完成素材。
- **旧队列 Prompt 仍显示缩略标题**：生产队列会从项目分镜、角色 DNA 和风格 DNA 重新补全旧队列缺失或短标题式的 `imagePrompt` / `videoPrompt`，编辑 Prompt 默认显示完整 Prompt。
- **存储监控数量不准确**：存储监控改为当前项目维度统计，仅统计 active 图片/视频，并合并队列结果 URL 去重，不再把 thumbnail 混入图片数量。
- **项目切换后故事脚本丢失**：项目新增 `storyScript` 持久化字段，选择项目后自动恢复上一次编辑的故事脚本和风格 DNA。
- **Production Queue 视频批量生成无反应/全失败**：图生视频改为先通过 pipeline 图片代理下载 `imageResultUrl`，避免浏览器 CORS/远端 URL 读取失败；仅对已生成图片且未锁定的视频项发起任务，缺图项明确标记失败原因。
- **实时任务不显示**：生产流水线图生视频现在会写入 `useTaskStore`，从 uploading/submitted/processing 到 completed/failed 都能被实时任务面板读取。
- **编辑 Prompt 显示缩略版**：队列初始化保存完整 `imagePrompt` / `videoPrompt` / `negativePrompt`，Prompt 编辑器默认展示完整视频 Prompt，不再只显示镜头短标题。
- **Production Queue 批量生成图片失效**：修复 `src/app/pipeline/page.tsx` 中批量/单项图片生成误接入图片下载器的问题，改为真正调用 `agnes.image.generate`，并在生成失败时写回可读错误状态。
- **队列处理状态回收**：将图片/视频生成中的 `processing` 标记清理移动到 `finally`，避免早退后任务占用状态残留。
- **i18n 补齐**：为生产队列新增 `pipeline.promptRequired`、`pipeline.noImageResult`、`pipeline.statusCancelled`、`pipeline.taskCancelled` 的 zh-CN / en-US 文案。

### Added
- **生产队列回归测试**：新增 `tests/unit/productionQueueBatchImage.test.ts`、`tests/unit/productionQueueVideoWorkflow.test.ts` 与 `tests/unit/productionPipelineHardening.test.ts`，覆盖完整 Prompt、视频可运行项过滤、图片 Prompt 选择、video_id 轮询、批量终止和存储统计。

### QA
- Unit Tests: ✅ `npx.cmd vitest run tests/unit/productionPipelineHardening.test.ts tests/unit/productionQueueVideoWorkflow.test.ts tests/unit/productionQueueBatchImage.test.ts` 10 passed
- TypeScript: ✅ `npx.cmd tsc --noEmit` 通过
- Lint: ✅ `npm.cmd run lint` 通过（保留既有 warning）
- Build: ✅ `npm.cmd run build` 通过（保留既有 warning）
- Browser QA: ✅ `http://localhost:3000/pipeline` 正常加载；端口检查确认仅 3000 监听
