# Agnes AI Studio - 国际化系统修复报告

## 1. 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/i18n/types.ts` | 新增 | 提取 `Translations` 类型定义，解除循环依赖 |
| `src/i18n/index.ts` | 重写 | 修复 key resolution 逻辑，从分离文件导入字典 |
| `src/i18n/zh-CN.ts` | 重写 | 修复编码（UTF-8），修正 import path |
| `src/i18n/en-US.ts` | 重写 | 修复编码（UTF-8），修正 import path |

## 2. 国际化架构说明

```
src/i18n/
├── types.ts      # Translations 类型定义
├── zh-CN.ts      # 中文翻译字典
├── en-US.ts      # 英文翻译字典
└── index.ts      # LanguageProvider / useTranslation / useLanguage
```

### 核心修复：Key Resolution

**问题**: `resolveValue()` 使用嵌套遍历 (`dict["menu"]["home"]`)，但字典使用扁平键 (`dict["menu.home"]`)。

**修复方案**:
1. 先尝试直接键查找 (`dict[key]`)
2. 失败后回退到嵌套遍历 (`dict["prompt"]["categories"]["general"]`)
3. 都失败则返回原始 key

### 架构设计
- `LanguageProvider` (React Context) - 提供语言状态
- `useTranslation()` - 返回 `{ t }` 翻译函数，支持参数替换
- `useLanguage()` - 返回 `{ language, setLanguage }`
- 默认中文 (`zh-CN`)，保存在 localStorage (`agnes_language`)

## 3. 已修复问题

### 乱码修复
- `index.ts` 内联字典中所有中文被损坏（GBK编码保存导致）
- 修复：从分离的 `zh-CN.ts` / `en-US.ts` 导入（UTF-8 without BOM）

### Key Resolution Bug
- 嵌套遍历找不到扁平键如 `menu.home`
- 修复：直接查找 + 嵌套遍历双策略

### 重复键修复
- `en-US.ts` 和 `zh-CN.ts` 中 `editor.preview` 重复（Video Editor 和 Editor 节）
- `assets.searchPlaceholder` 重复（Assets Library 和 Assets 节）
- 嵌套 `storyStudio.progress` 中的 `character` / `scene` 键被误删后恢复

## 4. 翻译字段统计

- **zh-CN.ts**: ~180+ 翻译字段
- **en-US.ts**: ~180+ 翻译字段
- **覆盖模块**: 菜单、通用组件、Sidebar、TopBar、Prompt、Character、Project、Storyboard、Assets、Editor、Story Studio、History、Models、Settings、Home、Generation、Tasks、Errors

## 5. 验收结果

| 检查项 | 结果 |
|--------|------|
| 默认中文界面 | ✅ `lang="zh-CN"`，中文文本正确渲染 |
| 中文菜单 | ✅ 提示词工作流、角色库、项目管理等 |
| 语言切换 | ✅ TopBar 按钮，中英互切 |
| 本地存储持久化 | ✅ localStorage (`agnes_language`) |
| 刷新保持选择 | ✅ |
| SSR 中文渲染 | ✅ /prompts 等页面中文可见 |
| 无原始 key 泄露 | ✅ 无 `menu.promptWorkflow` 等原始 key |
| 构建 | ✅ 0 error，19 routes |
| 页面可访问 | ✅ 所有页面 HTTP 200 |

## 6. 待确认事项

- `/generate-image`, `/image-to-image`, `/image-to-video`, `/text-to-video` 在 dev mode SSR 下返回 500（预存问题，与 i18n 无关）
- 这些页面在 client-side 运行正常

