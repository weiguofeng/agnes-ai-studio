# Agnes AI Studio - Agent Instructions

## 项目说明

项目名称：

Agnes AI Studio

项目目标：

构建 AI 视频生产流水线：

故事
↓
分镜
↓
Prompt
↓
图片
↓
图生视频
↓
素材库
↓
视频编辑器
↓
导出

---

## Read First

在开始任何任务前，请优先阅读：

docs/PROJECT_CONTEXT.md

docs/ROADMAP.md

---

# 核心原则

## Rule 1

Character Consistency First

角色一致性优先级高于任务成功率。

禁止：

图生视频失败后自动切换文生视频。

允许：

- Retry
- Recovery
- Pause Queue
- Human Review

禁止：

Silent Downgrade

---

## Rule 2

Root Cause First

优先寻找根因。

禁止使用临时绕过方案作为最终解决方案。

必须输出：

- Root Cause
- Solution
- Verification

---

## Rule 3

Pipeline Stability First

优先级：

1. Character Consistency
2. Pipeline Stability
3. Error Recovery
4. Performance
5. New Features

---

## Rule 4

Internationalization Required

所有新增UI必须支持：

- zh-CN
- en-US

禁止硬编码文本。

---

## Rule 5

Task Failure Policy

任务失败时：

优先：

- Retry
- Resume
- Pause

禁止：

- Silent Failure
- Silent Fallback
- Data Loss

---

## Video Generation Rules

图生视频是主工作流。

如果失败：

必须分析：

- CORS
- URL Expiration
- CDN Failure
- Network Issue
- Agnes API Issue

禁止自动切换文生视频。

---

## QA Rules

完成任务前必须执行：

- npm run build
- Type Check
- Lint

并输出测试结果。

---

## Output Format

每次任务结束必须输出：

1. Root Cause
2. Modified Files
3. Solution
4. Test Result
5. Remaining Risks



## Documentation Maintenance

完成任何任务后：

自动检查并更新：

- docs/PROJECT_CONTEXT.md
- docs/ROADMAP.md
- docs/CHANGELOG.md

要求：

PROJECT_CONTEXT.md
记录当前状态

ROADMAP.md
更新未来计划

CHANGELOG.md
记录本次变更

如果内容无变化：

明确说明：

"No documentation update required."



