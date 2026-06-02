# 画板 AI 助手设计文档

## 1. 产品定位

在现有的 Shape Canvas 画板系统中，增加一个"创造性 AI"功能：用户用自然语言描述想要的形状，AI 利用三种灯板（六边形、三角形、迷你三角形）自动拼接出大致轮廓。

## 2. 交互流程

1. 用户在 `CanvasToolbar` 点击"创造性 AI"按钮
2. 弹出 `CanvasAIDialog`，包含多行输入框
3. 用户输入描述（如"一个爱心"、"一颗五角星"）
4. 点击"生成"，按钮进入 loading，输入框禁用
5. 主进程调用 LLM 生成 JSON 布局
6. 成功后：关闭弹窗 → 清空画布 → 放置灯板（利用现有吸附逻辑自动对齐）→ 保存设计
7. 失败时：弹窗内显示红色错误提示，输入框恢复

## 3. 技术架构

### 方案：Prompt → 结构化 JSON 输出

参考现有 Agent 生成 Skill JSON 的单轮模式。一次 LLM 调用直接输出 `PlacedPanel[]` 数组。

```
CanvasPage → CanvasAIDialog (用户输入)
  → IPC invoke "design:aiGenerate"
  → canvas-agent.service.ts:
      1. 构建 system prompt（几何信息 + 配色规则 + 坐标参考）
      2. 调用现有 getAdapter(config).chat()（非流式）
      3. 解析/验证 JSON
      4. 返回 PlacedPanel[] 或错误
  → renderer 收到结果 → 清空画布 → 批量放置 → 保存
```

### 新增文件

- `src/main/canvas-agent.service.ts` — prompt 构建 + LLM 调用 + JSON 解析验证

### 修改文件

- `src/shared/types.ts` — 新增 IPC channel `design:aiGenerate`
- `src/main/ipc-handlers.ts` — 注册新的 ipcMain.handle
- `src/main/preload.ts` — 暴露新的 bridge API
- `src/renderer/api.ts` — 新增 renderer 端 API 封装
- `src/renderer/components/CanvasToolbar.tsx` — 添加"创造性 AI"按钮
- `src/renderer/components/CanvasPage.tsx` — 集成弹窗和生成逻辑
- `src/renderer/components/CanvasAIDialog.tsx` — 新弹窗组件

### 不修改

- LLM 配置：复用设置页面已有的 OpenAI/Ollama 配置
- Agent 聊天：不影响现有 chat 功能
- 画板核心：CanvasStage / CanvasShapePanel / 吸附逻辑均不变

## 4. System Prompt 设计

```
你是 Nanoleaf Shape 灯板布局设计师。
根据用户的描述，用三种灯板拼出大致形状。

## 可用灯板

1. 六边形 (hexagon):
   - 中心到顶点距离: 67px
   - 6条边，形似正六边形
   - 有6个连接点（每条边中点）

2. 三角形 (triangle):
   - 边长: 134px，中心到顶点约77px
   - 等边三角形
   - 有6个连接点（每条边2个三等分点）

3. 迷你三角形 (mini-triangle):
   - 边长: 67px，中心到顶点约39px
   - 等边三角形，面积约三角形的1/4
   - 有3个连接点（每条边中点）

## 几何约束

- 迷你三角形边长 = 六边形边长 = 67px
- 三角形边长 = 2 × 迷你三角形边长 = 134px
- 两个迷你三角形并排 = 一个三角形

## 坐标规则

- 画布以(0,0)为中心，x轴向右，y轴向下
- 相邻灯板中心间距参考: 六边形和六边形约116px，三角形和三角形约134px，迷你三角约67px
- 控制总量在8-30块板子之间
- rotation为角度制: 0保持三角形尖角朝上，30为六边形一个顶点朝上

## 配色规则

- 根据形状语义自动选择颜色方案
- 爱心→红/粉红系，星星→金黄系，树→绿色系，海洋→蓝色系
- 辅助/背景板用浅灰或白色
- 颜色格式: hex字符串 "#rrggbb"

## 输出格式

严格只输出一个 JSON 数组，不要任何额外文字:

[
  {"type":"hexagon","x":0,"y":0,"rotation":0,"color":"#ff4444"},
  ...
]
```

## 5. 验证层

主进程解析 LLM 响应后逐层校验：

1. JSON 解析失败 → `"AI 返回格式异常，请重试"`
2. 类型校验 — 每个元素必须有合法 type / x / y / color
3. 数量限制 — 1 到 50 块
4. 坐标范围 — 不做硬限制
5. 重叠检测 — 复用 `panelsOverlap()`，有重叠返回错误
6. LLM 未配置 → `"请先在设置中配置 LLM"`
7. API 错误 → `"AI 服务不可用: <原因>"`

## 6. UI

### CanvasToolbar 按钮

在工具栏右侧新增按钮，文本"创造性AI"，hover tooltip 同文本。

### CanvasAIDialog

- MUI Dialog，居中弹出
- 多行 TextField，placeholder: "描述你想要的形状，例如：一个爱心 / 一颗五角星 / 一棵圣诞树"
- 底部按钮: [取消] [生成]
- 生成中: 输入框和按钮禁用，生成按钮显示 loading
- 错误: 红色提示文字显示在输入框下方

### 放置策略

- LLM 不输出 snappedTo 字段
- 灯板按 JSON 顺序依次放置，利用现有 `findBestSnap` 自动检测吸附
- 放置完成后自动保存方案
- undo 栈保留操作前状态，支持撤销回退
