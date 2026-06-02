# Canvas 仿真系统设计

## 概述

将现有的 Shape Canvas 画板系统扩展为 Nanoleaf 灯效仿真器。在画板上实时渲染 6 种灯效类型（Flow/Wheel/Explode/Fade/Random/Highlight），仿真效果与物理 Nanoleaf 设备行为一致。纯本地仿真，不控制物理设备。

## 架构

### 整体结构

```
CanvasPage (双模式)
├── Edit Mode (现有编辑功能 + 连接标记)
└── Sim Mode (效果浏览器 + 动画渲染)

SimulationEngine Layer
├── SimulationEngine (RAF 调度器)
├── PanelGraph (面板邻接图)
├── color-utils (HSB↔RGB, 插值)
└── engines/
    ├── EffectEngine (接口)
    ├── flow.engine.ts
    ├── wheel.engine.ts
    ├── explode.engine.ts
    ├── fade.engine.ts
    ├── random.engine.ts
    └── highlight.engine.ts
```

### 数据流

```
用户点击"播放" Skill
  → SimulationEngine.start(bodyTemplate, panels)
    → 解析 pluginUuid → 选择 EffectEngine
    → 构建 PanelGraph (snappedTo 邻接图)
    → RAF 循环: engine.getColors(elapsedMs, graph)
      → Map<panelId, RGB>
      → CanvasStage.setPanelColors() → Konva batchDraw()
```

## 文件结构

新增目录 `src/renderer/simulation/`：

```
src/renderer/simulation/
├── SimulationEngine.ts      # RAF 调度器
├── types.ts                 # 接口类型定义
├── PanelGraph.ts            # 面板邻接图构建
├── color-utils.ts           # 颜色转换和插值
└── engines/
    ├── EffectEngine.ts      # EffectEngine 接口
    ├── flow.engine.ts       # Flow 效果
    ├── wheel.engine.ts      # Wheel 效果
    ├── explode.engine.ts    # Explode 效果
    ├── fade.engine.ts       # Fade 效果
    ├── random.engine.ts     # Random 效果
    └── highlight.engine.ts  # Highlight 效果
```

## 核心接口

```typescript
// 每帧输出：面板ID → RGB颜色
type FrameColors = Map<string, { r: number; g: number; b: number }>

// 效果引擎接口
interface EffectEngine {
  init(palette: HsbColor[], options: Record<string, unknown>): void
  getColors(elapsedMs: number, graph: PanelGraph): FrameColors
}

// 面板邻接图节点
interface PanelNode {
  id: string
  type: PanelType
  x: number
  y: number
  rotation: number
  neighbors: string[]
}
```

## PanelGraph

从 `PlacedPanel.snappedTo` 构建无向图：

- 遍历所有面板，对有 `snappedTo` 的建立双向边
- 无 `snappedTo` 的面板按空间最近距离连接（阈值内）
- 提供方法：
  - `getConnectedComponents()` — 连通分量
  - `getFlowPath(startId)` — BFS 排序的流动路径
  - `getDistancesFrom(centerId)` — 到中心节点的距离

## 效果算法

### Flow（流动）
沿 BFS 路径传播颜色。波头沿面板图移动，波头前后 N 个面板显示渐变颜色，其余面板暗色。`transTime` 控制传播速度。

### Wheel（色轮）
所有面板同步循环切换调色板颜色。`colorIndex = floor(time / interval) % palette.length`。

### Explode（爆炸）
从几何中心向外扩散波纹。计算每面板到中心的距离，波纹传播经过时面板亮起调色板颜色。

### Fade（淡入淡出）
所有面板在调色板颜色之间同步平滑过渡。

### Random（随机）
每面板独立从调色板随机取色，有各自的相位偏移，避免所有面板同时变化。

### Highlight（高亮）
沿图路径逐个点亮面板。当前高亮面板显示调色板颜色，其余暗色。按路径顺序扫描。

## 颜色工具

`color-utils.ts`：

- `hsbToRgb(h, s, b)` → RGB — 已有，复用
- `rgbToHex(rgb)` → hex string — 输出给 Konva
- `lerpColor(a, b, t)` — RGB 线性插值
- `paletteIndex(palette, t)` — t:0-1 在调色板中循环取色

## CanvasStage 改造

新增 props：

```typescript
interface Props {
  // ... 现有 props
  panelOverrides?: Map<string, string>  // panelId → hex color (仿真覆盖)
  showConnectionMarks?: boolean          // 编辑模式下显示连接标记
  simMode?: boolean                      // 仿真模式（禁用交互）
}
```

- `panelOverrides` 非空时，面板颜色优先使用覆盖值
- `simMode=true` 时禁用所有 drag/click/select 交互
- `showConnectionMarks=true` 时渲染白色小短线

## 连接标记（编辑模式）

在每对 snappedTo 面板的连接点处，绘制垂直于所属边的白色小短线（8-10px）。

实现：遍历所有 `panel.snappedTo`，对每对连接点：
1. 通过 `connectionToEdgeIndices()` 获取所属边
2. 计算边的方向向量
3. 在连接点处绘制垂直短线

## 模式管理

CanvasToolbar 新增模式切换：

- **[✏️编辑]** / **[▶仿真]** 按钮组
- 快捷键 `Tab` 切换模式
- 编辑模式：现有完整编辑功能 + 连接标记
- 仿真模式：隐藏编辑工具，面板不可交互，效果浏览器显示

## 效果浏览器 (SimEffectPanel)

仿真模式左侧边栏：

- 从 Skill 库加载所有已保存的 Skill
- 卡片样式同 `SkillCard`（名称、描述、颜色条、API 信息）
- "播放" 按钮代替 "执行" 按钮
- 当前播放的卡片绿色高亮，标签 "播放中"
- 点击新效果自动停止当前效果

## 现有文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/renderer/components/CanvasPage.tsx` | 新增模式管理、效果浏览器、SimulationEngine 集成 |
| `src/renderer/components/CanvasStage.tsx` | 新增 panelOverrides/showConnectionMarks/simMode props |
| `src/renderer/components/CanvasToolbar.tsx` | 新增模式切换按钮 |
| `src/renderer/hooks/useCanvasDesign.ts` | 可能不需要修改 |

## 不修改的部分

- 不修改 Skill 数据结构
- 不修改 IPC 通道
- 不修改主进程
- 不修改物理设备交互

## 文件新增清单

| 文件 | 说明 |
|------|------|
| `src/renderer/simulation/types.ts` | EffectEngine 接口和类型 |
| `src/renderer/simulation/SimulationEngine.ts` | RAF 调度器 |
| `src/renderer/simulation/PanelGraph.ts` | 面板邻接图 |
| `src/renderer/simulation/color-utils.ts` | 颜色工具 |
| `src/renderer/simulation/engines/EffectEngine.ts` | 接口定义 |
| `src/renderer/simulation/engines/flow.engine.ts` | Flow 效果 |
| `src/renderer/simulation/engines/wheel.engine.ts` | Wheel 效果 |
| `src/renderer/simulation/engines/explode.engine.ts` | Explode 效果 |
| `src/renderer/simulation/engines/fade.engine.ts` | Fade 效果 |
| `src/renderer/simulation/engines/random.engine.ts` | Random 效果 |
| `src/renderer/simulation/engines/highlight.engine.ts` | Highlight 效果 |
