# Agnes AI Studio Roadmap

## V2.4 (已完成)
### Character Consistency Pipeline
- ✅ Character DNA, Reference, Lock
- ✅ Batch Video Generation, Production Queue
- ✅ URL 诊断, 服务端代理, 指数退避重试

---

## V2.5
### Automation
- 自动图片生成, 自动视频生成, 自动字幕生成, 自动封面生成

---

## V2.6
### AI Production Studio
- 一键生成完整项目, 批量项目生产, 多项目队列, 云端任务调度

---

## V2.7 (已完成)
### Production Dashboard Upgrade
- ✅ 双栏布局, 统计面板, 镜头卡片, Prompt 编辑器
- ✅ 素材预览, 批量操作, 时间轴导入, 存储监控, 生产模式, 实时任务

---

## V2.8 (已完成)
### Production Hardening
- ✅ 自动保存系统 (30s + 关键操作 + 页面关闭兜底)
- ✅ Prompt 历史持久化 (IndexedDB, 50 版本/镜头)
- ✅ 资源永久存储 (始终保存 Blob, 保存 originalUrl)
- ✅ 资源完整性检查 (Blob 验证 + 状态标记)
- ✅ 安全清理 (三级确认: 预览 -> 输入 DELETE -> 执行)
- ✅ 项目备份系统 (导出 .project.json)
- ✅ 项目恢复系统 (导入 + 校验)
- ✅ 恢复中心 (/recovery 页面)
- ✅ IndexedDB 优化 (新增 sceneId, integrityStatus 索引)
- ✅ 单元测试 (9 项)

## V2.8.1 (已完成)
### Pipeline UX & Recovery Hardening
- ✅ 图生视频任务状态流加固：禁止任务创建成功即 completed，必须轮询到真实视频 URL
- ✅ 首页、恢复中心、清理确认和视频错误提示补齐 zh-CN / en-US
- ✅ StorageMonitor 三级安全清理 UI 落地
- ✅ AppShell / Sidebar / Pipeline 响应式修复，移动端改单栏和横向导航
- ✅ QueueCardView 补齐视频锁定、解锁、删除操作入口
- ✅ PromptInlineEditor 修复空历史 selector 不稳定导致的 React 19 最大更新深度崩溃
- ✅ PromptPack 生成兼容旧镜头数据，缺失 characterIds 时不再抛错
- ✅ 生产流水线生成时 sceneId/shot.sceneId 使用同一时间戳，保持引用一致
- ✅ 生产队列批量生成图片修复：改为调用文本生图 API，并补充回归测试
- ✅ 生产队列批量生成视频修复：代理读取图片、实时任务入队、缺图项明确失败
- ✅ 生产队列 Prompt 完整性修复：编辑 Prompt 展示完整图像/视频 Prompt，保障图像质量
- ✅ Agnes 视频轮询 ID 修复：优先使用 `video_id`，避免 `/agnesapi?video_id=task_*` 404
- ✅ 批量暂停/终止修复：选中生成任务会取消本地轮询和实时任务状态
- ✅ 存储监控项目级统计修复：按当前项目 active 图片/视频和队列结果 URL 去重
- ✅ 项目故事脚本恢复：选择项目自动带入上一次编辑的故事脚本

---

## V2.9
### Quality Gate Cleanup
- 清理历史 ESLint warnings，并迁移 Next lint 到 ESLint CLI
- 增加 i18n key 泄漏和新 UI 硬编码扫描
- 增加图生视频 create -> poll -> complete 的 mock E2E 覆盖
- 增加移动端主页面无横向滚动的 Playwright 检查
- 增加生产流水线故事生成与队列渲染的 Playwright 回归用例
- 增加 Agnes 404 / task not found 的端到端错误恢复检查

---

## V3.0
### Story To Final Video
目标: 输入故事 -> 自动生成: 角色, 分镜, Prompt, 图片, 视频, 字幕, 封面, 最终视频
关键技术: AI 字幕生成, 云端任务调度, 多项目队列, Service Worker 缓存, 资源去重
