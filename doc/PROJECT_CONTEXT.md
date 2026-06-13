# Agnes AI Studio

## 当前版本

V2.4

---

## 项目定位

Agnes AI Studio 是一个 AI 视频生产平台。
目标：
从一个故事自动生成完整短视频项目。

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
- ✅ Production Pipeline (批量图生视频修复)

---

## QA 状态
总体通过率：

92.3% → **96.8%**

### 测试统计
- TypeScript 编译: 0 错误
- ESLint: 0 错误（仅 pre-existing warnings）
- 单元测试: 47/47 通过
- 压力测试: 10 阶段全部通过

---

## Agnes Video 状态
Text-to-Video：
100% 成功

Image-to-Video：
偶发 Agnes 服务端 500

已确认：

非客户端问题。

---

## 核心工作流
Story
↓
Storyboard
↓
Prompt
↓
Image
↓
**Image-to-Video（主流程 — 禁止文生视频降级）**
↓
Assets Library
↓
Video Editor
↓
Export

---

## 当前开发重点
Character Consistency Pipeline（已完成）

---

## 当前原则

角色一致性优先于成功率。
宁可失败。
不要自动切换工作流。

---

## 已解决问题

### V2.4 Production Pipeline
1. ❌ ~~批量图生视频自动降级文生视频~~ → ✅ 已修复
2. ❌ ~~前端 fetch 导致 CORS 错误~~ → ✅ 服务端代理下载
3. ❌ ~~无 URL 过期诊断~~ → ✅ 新增诊断日志
4. ❌ ~~无重试机制~~ → ✅ 指数退避 10s/30s/60s
5. ❌ ~~单一 VIDEO_FAILED 状态~~ → ✅ 7 种精细化状态

### 已知问题
1. Agnes 图生视频偶发 500（服务端问题）

---

## 测试报告

10 阶段压力测试报告位于:
`tests/reports/`
