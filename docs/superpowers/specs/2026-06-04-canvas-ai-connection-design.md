# Canvas AI Connection-Based Layout Design

## 目标

接入 LLM 根据自然语言描述自动生成 Canvas 设计方案，采用**相对连接描述**替代坐标计算，让 LLM 做语义编排、代码做几何计算。

## 问题分析

之前的方案让 LLM 直接输出像素坐标（如 `"x": 341.828`），LLM 缺乏空间几何计算能力，效果很差。根本原因是要求 LLM 同时完成语义理解和精确坐标计算。

## 方案：相对连接描述

LLM 输出连接关系而非坐标，代码负责从连接图解析出像素位置。

### 连接点编号

沿用 `src/renderer/utils/panelGeometry.ts` 中的连接点生成逻辑，编号在各面板类型中为顺时针方向。

**Hexagon — 6 个边中点（索引 0-5，rotation=0 时从右下边中点顺时针）：**

```
     4 (上)
  5      0      0=右下  1=下   2=左下
   ⬡          3=左上  4=上   5=右上
  3      1
     2 (左下)
```

(Y 轴向下，屏幕坐标)

**Triangle — 每条边 2 个三等分点，共 6 个（索引 0-5，顺时针从右边开始）：**

```
       0 (尖角朝上)
       ▲
     1   5     边 0-1(右边):  cp[0]=上, cp[1]=下
    2     4    边 1-2(底边):  cp[2]=右, cp[3]=左
      3        边 2-0(左边):  cp[4]=下, cp[5]=上
```

**Mini-Triangle — 每条边中点，共 3 个（索引 0-2，顺时针从右边开始）：**

```
       0 (尖角朝上)
       ▲
          1     cp[0]=右边中点, cp[1]=底边中点, cp[2]=左边中点
    2
```

### LLM 输出格式

```json
[
  { "type": "hexagon", "rotation": 0, "color": "#10B981" },
  { "type": "hexagon", "connectTo": 0, "at": 0, "rotation": 0, "color": "#34D399" },
  { "type": "triangle", "connectTo": 1, "at": 4, "rotation": 60, "color": "#FF6B6B" },
  { "type": "mini-triangle", "connectTo": 0, "at": 3, "rotation": 180, "color": "#cccccc" }
]
```

- 数组第一个面板放在原点 (0, 0)
- `connectTo` — 连接到的父面板索引（0-based 数组下标）
- `at` — 连接在父面板的哪个连接点
- `rotation` — 面板自身的旋转角度（度，支持 0/30/60/90/120/150/180/210/240/270/300/330）
- `color` — hex 颜色字符串 `#rrggbb`
- 子面板使用与 `at` 相对的连接点（如父用点0右下，子用点3左上，自动取对面）

### 布局解析器 `resolveLayout()`

```
输入: LLM 输出的连接数组
流程:
  1. 面板[0] 放在原点 (0, 0)
  2. 对每个后续面板:
     a. 获取父面板(connectTo)的世界位置和旋转
     b. 用 getConnectionWorldPos() 计算父面板 at 连接点的世界坐标
     c. 取子面板的对面连接点 childCp = opposite(at, childType)
     d. 用 computeSnappedPosition() 反算子面板位置
     e. 记录 snappedTo: { panelId: 父面板id, connectionIndex: at }
  3. 输出全量 CanvasDesign（含像素坐标和 snappedTo 关系）

"对面"映射:
  Hexagon (6点): opposite(i) = (i+3) % 6
  Triangle (6点): opposite(i) = (i+3) % 6
  Mini (3点): opposite(0)=2, opposite(1)=1(无对面，保持), opposite(2)=0
```

### LLM System Prompt 要点

- 用自然语言描述目标图案
- 只输出 JSON 数组，无其他文字
- prompt 中嵌入连接点编号图（ASCII art）
- 控制面板数量在 8-30 块之间
- 根据语义自动选择配色方案

## 代码改动

### 新文件

1. **`src/shared/panelGeometry.ts`** — 从 renderer/utils/panelGeometry.ts 提取几何常量
   - `getPanelGeometry(type)` — 返回顶点和连接点偏移（rotation=0）
   - `getConnectionWorldPos(panel, type, index)` — 计算连接点世界坐标
   - `computeSnappedPosition(panel, type, index, targetWorld)` — 反算放置位置
   - `oppositeConnection(type, index)` — 对面连接点索引
   - `resolveLayout(inputPanels)` — 连接描述 → 完整 PlacedPanel[]

2. **重构 `src/renderer/utils/panelGeometry.ts`** — 从 shared/panelGeometry.ts 导入几何部分，保留渲染专用逻辑（snap search、overlap detection）

### 修改文件

3. **`src/main/canvas-agent.service.ts`** — 重写
   - 新 System Prompt，连接描述格式 + 编号图
   - 生成后调用 `resolveLayout()` 计算像素坐标
   - 返回完整 `CanvasDesign`（含 id、name、panels、snappedTo）

4. **`src/main/ipc-handlers.ts`** — 添加
   - `DESIGN_AI_GENERATE` handler，调用 `canvas-agent.generateDesign()`

5. **`src/main/preload.ts`** — 暴露
   - `aiGenerateDesign(description: string): Promise<CanvasDesign>`

6. **`src/renderer/api.ts`** — 添加
   - `aiGenerateDesign(description: string): Promise<CanvasDesign>`

7. **`src/renderer/components/CanvasToolbar.tsx`** — 添加
   - AI 按钮（AutoAwesomeIcon），接收 `onAIGenerate` 回调

8. **`src/renderer/components/CanvasPage.tsx`** — 集成
   - CanvasAIDialog 状态管理
   - 生成 → 新建 CanvasDesign → 保存 → 加载到画板

## 数据流

```
用户输入描述 → CanvasAIDialog
  → api.aiGenerateDesign(description)
    → IPC design:aiGenerate
      → canvas-agent.service: generateDesign()
        → LLM chat (返回连接描述 JSON)
        → validate → resolveLayout() (计算像素坐标+snappedTo)
        → 返回 CanvasDesign { id, name, panels[] }
  → api.saveDesign(design) 保存
  → loadDesign(id) 加载到画板并显示
```
