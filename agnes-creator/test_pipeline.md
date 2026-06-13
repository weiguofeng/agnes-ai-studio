## AI 故事 → 视频 端到端测试步骤

### 前提

打开浏览器访问 http://localhost:3000

------

### 步骤 1：配置 API Key

**路径**: 点击左侧菜单 API 配置（齿轮图标 /settings）

**操作**:

- 填入你的 Agnes API Key
- 点击保存

------

### 步骤 2：创建项目

**路径**: /projects

**操作**:

- 点击"新建项目"
- 名称：哈利波特魔法书测试
- 描述：测试 AI 故事到视频的完整流水线
- 点击创建

------

### 步骤 3：创建角色并锁定到项目

**路径**: /characters

**操作**:

1. 点击"新建角色"
2. 填写：
   - 名称：哈利·波特
   - 描述：霍格沃茨的年轻巫师
   - Prompt：Harry Potter, teenage wizard, black messy hair, round glasses, green eyes, Hogwarts robe, red and gold scarf
   - 标签：哈利波特、巫师、霍格沃茨
3. 点击保存

------

### 步骤 4：进入 Production Pipeline

**路径**: /pipeline

**操作**:

1. 在项目选择器中选择 哈利波特魔法书测试
2. 点击"锁定角色"，选择 哈利·波特

------

### 步骤 5：输入故事 → 生成分镜

在 **Storyboard Generator** 区域：

**输入示例**（复制以下内容）：

```
Harry discovers a mysterious magic book in the Hogwarts library. As he opens it, golden sparks fly out and the bookshelf behind him starts to glow. Professor McGonagall appears and tells him the book is a ancient grimoire. Harry's scar tingles as he realizes the book is connected to Voldemort.
```

**操作**:

- 可选：在 Style DNA 输入框填入 cinematic lighting, magical atmosphere, dark fantasy style
- 点击 "Generate Storyboard"

------

### 步骤 6：批量生成图片

在 **Production Queue** 区域：

**操作**:

1. 确认队列中出现了若干镜头（5-20个）
2. 点击 "Generate All Images"
3. 观察状态变化：pending → generating → completed / failed
4. 失败的镜头可点击刷新按钮重试

------

### 步骤 7：批量图生视频

**操作**:

1. 等待所有图片状态变为 completed
2. 点击 "Generate All Videos"
3. 观察状态变化

------

### 步骤 8：导入时间轴

在 **Timeline Auto-Import** 区域：

**操作**:

1. 确认显示已完成视频的镜头数量
2. 点击 "Import to Timeline"

------

### 步骤 9：导出项目

在 **Project Export** 区域：

**操作**:

- 点击 "Export JSON" 下载项目 JSON
- 或点击 "Export Markdown" 下载 Markdown 报告