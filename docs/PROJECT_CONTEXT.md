# Agnes AI Studio

## 当前版本

V2.8.1

---

## 项目定位

Agnes AI Studio 是一个 AI 视频生产平台。目标是从一个故事自动生成完整短视频项目。

---

## 已完成模块
- ✅ Prompt Workflow
- ✅ Character Library
- ✅ Project Management
- ✅ Storyboard Builder
- ✅ Assets Library
- ✅ Video Editor
- ✅ AI Story Studio
- ✅ Agnes Video Integration
- ✅ 国际化系统
- ✅ API Key Management
- ✅ QA Testing
- ✅ Production Pipeline（批量图生视频修复）
- ✅ V2.7 Production Dashboard
- ✅ **V2.8 Production Hardening**
- ✅ **V2.8.1 Pipeline UX & Recovery Hardening**
- ✅ **V2.8.1 Pipeline Prompt Crash Fix**
- ✅ **V2.8.1 Production Queue Batch Image Fix**
- ✅ **V2.8.1 Production Queue Video Task Fix**
- ✅ **V2.8.1 Production Queue Control & Storage Fix**

---

## QA 状态
Build: ✅ 通过
TypeScript: ✅ 0 错误
Lint: ✅ 通过（保留既有 warning）
Unit Tests: ✅ 生产队列图片/视频/硬化回归测试通过
Browser QA: ✅ `http://localhost:3000/pipeline` 正常加载，端口检查仅 3000 监听

---

## 核心工作流
Story -> Storyboard -> Prompt -> Image -> Image-to-Video -> Assets Library -> Video Editor -> Export

---

## 当前开发重点
V2.8.1 Pipeline UX & Recovery Hardening 已完成，生产队列批量图片生成、批量图生视频、完整 Prompt 展示、实时任务显示、批量暂停/终止、项目级存储统计和故事脚本恢复已修复，并通过单元测试、TypeScript、Lint、Build 与 Browser QA 验证。

---

## 已知问题
1. Agnes 服务端仍可能返回 500 或远端任务不存在，客户端现在会保留图生视频主流程并显示失败/取消状态，不会静默降级。
2. 历史 ESLint warning 仍需在 V2.9 清理。
