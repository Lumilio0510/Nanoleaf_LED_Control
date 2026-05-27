# Shape 画板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Nanoleaf Shape 灯板构建虚拟画板设计工具，支持三种灯板类型吸附拼接、颜色设定、方案管理、图片导出。

**Architecture:** 新增 `canvas` 页面集成到现有 React 页面系统。react-konva 渲染无限画布，灯板几何数据用纯 TS 函数计算，方案 JSON 文件存储在 `designs/` 目录，通过 IPC 读写。

**Tech Stack:** React 19 + konva 9.x + react-konva 18.x + MUI v9 + TypeScript 6，无测试框架。

---

## File Structure

```
New:
  src/shared/canvas-types.ts              — PanelType, PlacedPanel, CanvasDesign, CanvasDesignMeta
  src/main/design.service.ts             — designs/ JSON 文件 CRUD + 图片导出
  src/renderer/utils/panelGeometry.ts    — 三种灯板顶点/连接点坐标计算
  src/renderer/hooks/useCanvasDesign.ts  — 设计状态管理、选中、撤销
  src/renderer/components/CanvasGrid.tsx        — 背景网格 Layer
  src/renderer/components/CanvasShapePanel.tsx  — 单个灯板 Konva Group
  src/renderer/components/CanvasToolbar.tsx     — 顶部工具栏
  src/renderer/components/ColorPanel.tsx        — 底部颜色面板
  src/renderer/components/CanvasStage.tsx       — Konva Stage 容器 (zoom/pan/放置)
  src/renderer/components/CanvasPage.tsx        — 主 orchestrator 页面

Modify:
  src/shared/types.ts     — 新增 5 个 IPC 常量
  src/main/ipc-handlers.ts — 新增 5 个 IPC handler
  src/main/preload.ts      — 暴露 5 个 API
  src/renderer/api.ts      — 添加 5 个 API 方法 + 类型声明
  src/renderer/App.tsx     — Page 类型加 'canvas'，渲染 CanvasPage (padding=0)
  src/renderer/components/Sidebar.tsx — 新增画板导航项
```

---

### Task 1: Install dependencies

- [ ] **Step 1: Install konva + react-konva**

```bash
npm install konva react-konva
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add konva and react-konva dependencies"
```

---

### Task 2: Define canvas types and IPC channels

- [ ] **Step 1: Create `src/shared/canvas-types.ts`**

```typescript
export type PanelType = 'hexagon' | 'triangle' | 'mini-triangle'

export interface SnappedTo {
  panelId: string
  connectionIndex: number
}

export interface PlacedPanel {
  id: string
  type: PanelType
  x: number
  y: number
  rotation: number
  color: string
  snappedTo: SnappedTo | null
}

export interface CanvasDesign {
  id: string
  name: string
  panels: PlacedPanel[]
  createdAt: string
  updatedAt: string
}

export interface CanvasDesignMeta {
  id: string
  name: string
  updatedAt: string
}
```

- [ ] **Step 2: Add IPC channels to `src/shared/types.ts`**

Add this inside the `IPC` const, after the Agent section:

```typescript
  // Canvas 画板
  DESIGN_LIST: 'design:list',
  DESIGN_LOAD: 'design:load',
  DESIGN_SAVE: 'design:save',
  DESIGN_DELETE: 'design:delete',
  DESIGN_EXPORT: 'design:export',
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/canvas-types.ts src/shared/types.ts
git commit -m "feat(canvas): add canvas types and IPC channel constants"
```

---

### Task 3: Create design file service

- [ ] **Step 1: Create `src/main/design.service.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import { v4 as uuid } from 'uuid'
import type { CanvasDesign, CanvasDesignMeta } from '../shared/canvas-types'

function getDesignsDir(): string {
  const dir = resolve(process.cwd(), 'designs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listDesigns(): CanvasDesignMeta[] {
  const files = readdirSync(getDesignsDir()).filter(f => f.endsWith('.json'))
  return files.map(f => {
    const design: CanvasDesign = JSON.parse(readFileSync(join(getDesignsDir(), f), 'utf-8'))
    return { id: design.id, name: design.name, updatedAt: design.updatedAt }
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadDesign(id: string): CanvasDesign | null {
  const fp = join(getDesignsDir(), `${id}.json`)
  if (!existsSync(fp)) return null
  return JSON.parse(readFileSync(fp, 'utf-8'))
}

export function saveDesign(design: CanvasDesign): CanvasDesignMeta {
  design.updatedAt = new Date().toISOString()
  writeFileSync(join(getDesignsDir(), `${design.id}.json`), JSON.stringify(design, null, 2), 'utf-8')
  return { id: design.id, name: design.name, updatedAt: design.updatedAt }
}

export function deleteDesign(id: string): void {
  const fp = join(getDesignsDir(), `${id}.json`)
  if (existsSync(fp)) unlinkSync(fp)
}

export function createDesign(name: string): CanvasDesign {
  return { id: uuid(), name, panels: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/design.service.ts
git commit -m "feat(canvas): add design file service for designs/ directory"
```

---

### Task 4: Register IPC handlers

- [ ] **Step 1: Add to `src/main/ipc-handlers.ts`**

Add import at top:
```typescript
import * as designService from './design.service'
```

Add at end of `registerHandlers()` before closing `}`:
```typescript
  // ======== Canvas 画板 ========
  ipcMain.handle(IPC.DESIGN_LIST, async () => designService.listDesigns())

  ipcMain.handle(IPC.DESIGN_LOAD, async (_event, id: string) => designService.loadDesign(id))

  ipcMain.handle(IPC.DESIGN_SAVE, async (_event, design) => designService.saveDesign(design))

  ipcMain.handle(IPC.DESIGN_DELETE, async (_event, id: string) => designService.deleteDesign(id))

  ipcMain.handle(IPC.DESIGN_EXPORT, async (_event, dataUrl: string) => {
    const { dialog } = require('electron')
    const { writeFileSync } = require('fs')
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
      defaultPath: 'canvas-design.png',
    })
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'))
      return result.filePath
    }
    return null
  })
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat(canvas): add canvas IPC handlers for design CRUD and export"
```

---

### Task 5: Expose canvas API to renderer

- [ ] **Step 1: Add to `src/main/preload.ts`**

Add canvas methods to the `api` const, after the Agent section:
```typescript
  // ======== Canvas 画板 ========
  listDesigns: (): Promise<unknown[]> => ipcRenderer.invoke(IPC.DESIGN_LIST),
  loadDesign: (id: string): Promise<unknown> => ipcRenderer.invoke(IPC.DESIGN_LOAD, id),
  saveDesign: (design: unknown): Promise<unknown> => ipcRenderer.invoke(IPC.DESIGN_SAVE, design),
  deleteDesign: (id: string): Promise<void> => ipcRenderer.invoke(IPC.DESIGN_DELETE, id),
  exportDesignImage: (dataUrl: string): Promise<string | null> => ipcRenderer.invoke(IPC.DESIGN_EXPORT, dataUrl),
```

- [ ] **Step 2: Update `src/renderer/api.ts`**

Add import at top:
```typescript
import type { CanvasDesign } from '../shared/canvas-types'
```

Add to `Window.electronAPI` interface (inside the declare global block), before closing `}`:
```typescript
      // Canvas
      listDesigns: () => Promise<Array<{ id: string; name: string; updatedAt: string }>>
      loadDesign: (id: string) => Promise<CanvasDesign | null>
      saveDesign: (design: CanvasDesign) => Promise<{ id: string; name: string; updatedAt: string }>
      deleteDesign: (id: string) => Promise<void>
      exportDesignImage: (dataUrl: string) => Promise<string | null>
```

Add to `api` export const, after existing methods:
```typescript
  listDesigns: () => window.electronAPI.listDesigns(),
  loadDesign: (id: string) => window.electronAPI.loadDesign(id),
  saveDesign: (design: CanvasDesign) => window.electronAPI.saveDesign(design),
  deleteDesign: (id: string) => window.electronAPI.deleteDesign(id),
  exportDesignImage: (dataUrl: string) => window.electronAPI.exportDesignImage(dataUrl),
```

- [ ] **Step 3: Commit**

```bash
git add src/main/preload.ts src/renderer/api.ts
git commit -m "feat(canvas): expose canvas API to renderer via preload"
```

---

### Task 6: Add canvas page to navigation

- [ ] **Step 1: Edit `src/renderer/App.tsx`**

Add import:
```typescript
import CanvasPage from './components/CanvasPage'
```

Change `type Page`:
```typescript
type Page = 'control' | 'skills' | 'agent' | 'settings' | 'canvas'
```

Change the main Box padding line:
```typescript
        <Box component="main" sx={{ flex: 1, overflow: 'auto', p: page === 'canvas' ? 0 : 3 }}>
```

Add after settings rendering:
```typescript
          {page === 'settings' && <SettingsPage />}
          {page === 'canvas' && <CanvasPage />}
```

- [ ] **Step 2: Edit `src/renderer/components/Sidebar.tsx`**

Add import:
```typescript
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
```

Change `type Page` to include `'canvas'`.
Add to items array:
```typescript
  { key: 'canvas', label: '画板', icon: <DashboardCustomizeIcon sx={{ fontSize: 16 }} /> },
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/Sidebar.tsx
git commit -m "feat(canvas): add canvas page to navigation"
```

---

### Task 7: Create panel geometry utility

- [ ] **Step 1: Create `src/renderer/utils/panelGeometry.ts`**

```typescript
import type { PanelType } from '../../shared/canvas-types'

export interface PanelGeometry {
  type: PanelType
  sideLength: number
  vertices: Array<{ x: number; y: number }>
  connectionPoints: Array<{ x: number; y: number }>
}

const DEG = (d: number) => (d * Math.PI) / 180

function hexGeometry(): PanelGeometry {
  const s = 67
  const v: PanelGeometry['vertices'] = []
  for (let i = 0; i < 6; i++) v.push({ x: s * Math.cos(DEG(60 * i)), y: s * Math.sin(DEG(60 * i)) })
  const a = s * Math.sqrt(3) / 2
  const cp: PanelGeometry['connectionPoints'] = []
  for (let i = 0; i < 6; i++) cp.push({ x: a * Math.cos(DEG(30 + 60 * i)), y: a * Math.sin(DEG(30 + 60 * i)) })
  return { type: 'hexagon', sideLength: s, vertices: v, connectionPoints: cp }
}

function triGeometry(): PanelGeometry {
  const s = 134
  const R = s / Math.sqrt(3)
  const v = [
    { x: 0, y: -R },
    { x: R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
    { x: -R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
  ]
  const cp: PanelGeometry['connectionPoints'] = []
  const edges: [number, number][] = [[0, 1], [1, 2], [2, 0]]
  for (const [ai, bi] of edges) {
    for (let t = 1; t <= 2; t++) {
      const r = t / 3
      cp.push({ x: v[ai].x + (v[bi].x - v[ai].x) * r, y: v[ai].y + (v[bi].y - v[ai].y) * r })
    }
  }
  return { type: 'triangle', sideLength: s, vertices: v, connectionPoints: cp }
}

function miniTriGeometry(): PanelGeometry {
  const s = 67
  const R = s / Math.sqrt(3)
  const r = s / (2 * Math.sqrt(3))
  const v = [
    { x: 0, y: -R },
    { x: R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
    { x: -R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
  ]
  const cp = [
    { x: 0, y: r },
    { x: r * Math.cos(DEG(-30)), y: r * Math.sin(DEG(-30)) },
    { x: -r * Math.cos(DEG(-30)), y: r * Math.sin(DEG(-30)) },
  ]
  return { type: 'mini-triangle', sideLength: s, vertices: v, connectionPoints: cp }
}

const CACHE: Record<PanelType, PanelGeometry> = {
  hexagon: hexGeometry(),
  triangle: triGeometry(),
  'mini-triangle': miniTriGeometry(),
}

export function getPanelGeometry(type: PanelType): PanelGeometry {
  return CACHE[type]
}

export function getConnectionWorldPos(
  panel: { x: number; y: number; rotation: number },
  type: PanelType,
  index: number,
): { x: number; y: number } | null {
  const geo = getPanelGeometry(type)
  if (index < 0 || index >= geo.connectionPoints.length) return null
  const cp = geo.connectionPoints[index]
  const a = DEG(panel.rotation)
  const c = Math.cos(a), s = Math.sin(a)
  return { x: panel.x + cp.x * c - cp.y * s, y: panel.y + cp.x * s + cp.y * c }
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/utils/panelGeometry.ts
git commit -m "feat(canvas): add panel geometry utility"
```

---

### Task 8: Create useCanvasDesign hook

- [ ] **Step 1: Create `src/renderer/hooks/useCanvasDesign.ts`**

```typescript
import { useState, useCallback, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import type { PanelType, PlacedPanel, CanvasDesign, CanvasDesignMeta } from '../../shared/canvas-types'
import { api } from '../api'

type ToolMode = 'select' | PanelType

export function useCanvasDesign() {
  const [design, setDesign] = useState<CanvasDesign | null>(null)
  const [designs, setDesigns] = useState<CanvasDesignMeta[]>([])
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const undoStack = useRef<PlacedPanel[][]>([])
  const redoStack = useRef<PlacedPanel[][]>([])

  const refreshDesigns = useCallback(async () => {
    setDesigns(await api.listDesigns())
  }, [])

  const loadDesign = useCallback(async (id: string) => {
    const d = await api.loadDesign(id)
    if (d) { setDesign(d); setSelectedIds(new Set()); undoStack.current = []; redoStack.current = [] }
  }, [])

  const saveDesign = useCallback(async () => {
    if (!design) return null
    const meta = await api.saveDesign(design)
    await refreshDesigns()
    return meta
  }, [design, refreshDesigns])

  const deleteDesign = useCallback(async (id: string) => {
    await api.deleteDesign(id)
    await refreshDesigns()
    if (design?.id === id) { setDesign(null); setSelectedIds(new Set()) }
  }, [design, refreshDesigns])

  const newDesign = useCallback((): CanvasDesign => {
    const d: CanvasDesign = { id: uuid(), name: '未命名方案', panels: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    setDesign(d); setSelectedIds(new Set()); undoStack.current = []; redoStack.current = []
    return d
  }, [])

  const pushUndo = useCallback(() => {
    if (design) { undoStack.current.push(design.panels); redoStack.current = [] }
  }, [design])

  const commit = useCallback((panels: PlacedPanel[]) => {
    if (!design) return
    setDesign({ ...design, panels, updatedAt: new Date().toISOString() })
  }, [design])

  const addPanel = useCallback((type: PanelType, x: number, y: number) => {
    if (!design) return
    pushUndo()
    const panel: PlacedPanel = { id: uuid(), type, x, y, rotation: 0, color: '#ffffff', snappedTo: null }
    commit([...design.panels, panel])
  }, [design, pushUndo, commit])

  const updatePanelColor = useCallback((ids: string[], color: string) => {
    if (!design) return
    pushUndo()
    commit(design.panels.map(p => ids.includes(p.id) ? { ...p, color } : p))
  }, [design, pushUndo, commit])

  const movePanel = useCallback((id: string, x: number, y: number) => {
    if (!design) return
    setDesign(d => d ? { ...d, panels: d.panels.map(p => p.id === id ? { ...p, x, y } : p) } : null)
  }, [])

  const movePanelEnd = useCallback((id: string, x: number, y: number) => {
    if (!design) return
    pushUndo()
    commit(design.panels.map(p => p.id === id ? { ...p, x, y } : p))
  }, [design, pushUndo, commit])

  const deleteSelected = useCallback(() => {
    if (!design || selectedIds.size === 0) return
    pushUndo()
    commit(design.panels.filter(p => !selectedIds.has(p.id)))
    setSelectedIds(new Set())
  }, [design, selectedIds, pushUndo, commit])

  const selectAll = useCallback(() => {
    if (design) setSelectedIds(new Set(design.panels.map(p => p.id)))
  }, [design])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev || !design) return
    redoStack.current.push([...design.panels])
    setDesign({ ...design, panels: prev, updatedAt: new Date().toISOString() })
    setSelectedIds(new Set())
  }, [design])

  return {
    design, designs, toolMode, selectedIds, setDesign, setToolMode, setSelectedIds,
    refreshDesigns, newDesign, loadDesign, saveDesign, deleteDesign,
    addPanel, movePanel, movePanelEnd, updatePanelColor, deleteSelected, selectAll, undo,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/hooks/useCanvasDesign.ts
git commit -m "feat(canvas): add useCanvasDesign hook"
```

---

### Task 9: Create CanvasGrid

- [ ] **Step 1: Create `src/renderer/components/CanvasGrid.tsx`**

```typescript
import { useMemo } from 'react'
import { Line } from 'react-konva'

interface Props {
  width: number; height: number; offsetX: number; offsetY: number; scale: number; gridSize?: number
}

export default function CanvasGrid({ width, height, offsetX, offsetY, scale, gridSize = 40 }: Props) {
  const lines = useMemo(() => {
    const r: number[][] = []
    const sx = Math.floor(-offsetX / scale / gridSize) * gridSize
    const sy = Math.floor(-offsetY / scale / gridSize) * gridSize
    const ex = sx + width / scale + gridSize * 2
    const ey = sy + height / scale + gridSize * 2
    for (let x = sx; x <= ex; x += gridSize) r.push([x, sy, x, ey])
    for (let y = sy; y <= ey; y += gridSize) r.push([sx, y, ex, y])
    return r
  }, [width, height, offsetX, offsetY, scale, gridSize])

  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} stroke="#333" strokeWidth={1 / scale} listening={false} />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasGrid.tsx
git commit -m "feat(canvas): add CanvasGrid component"
```

---

### Task 10: Create CanvasShapePanel

- [ ] **Step 1: Create `src/renderer/components/CanvasShapePanel.tsx`**

```typescript
import { Group, Line } from 'react-konva'
import { getPanelGeometry } from '../utils/panelGeometry'
import type { PlacedPanel } from '../../shared/canvas-types'

interface Props {
  panel: PlacedPanel
  isSelected: boolean
  isGhost?: boolean
  onDragStart?: () => void
  onDragEnd?: (x: number, y: number) => void
  onClick?: () => void
}

export default function CanvasShapePanel({ panel, isSelected, isGhost, onDragStart, onDragEnd, onClick }: Props) {
  const geo = getPanelGeometry(panel.type)
  const pts = geo.vertices.flatMap(v => [v.x, v.y])

  return (
    <Group
      x={panel.x} y={panel.y} rotation={panel.rotation}
      opacity={isGhost ? 0.4 : 1} draggable={!isGhost}
      onDragStart={onDragStart}
      onDragEnd={(e) => onDragEnd?.(e.target.x(), e.target.y())}
      onClick={onClick} onTap={onClick}
    >
      <Line
        points={pts} closed fill={panel.color}
        stroke={isSelected ? '#10B981' : '#555'} strokeWidth={isSelected ? 3 : 1}
      />
    </Group>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasShapePanel.tsx
git commit -m "feat(canvas): add CanvasShapePanel Konva component"
```

---

### Task 11: Create ColorPanel

- [ ] **Step 1: Create `src/renderer/components/ColorPanel.tsx`**

```typescript
import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'

const PRESETS = [
  '#ff0000','#ff6b00','#ffd000','#00ff00','#00ffff',
  '#0066ff','#6600ff','#ff00ff','#ffffff','#cccccc',
  '#888888','#444444','#ff9999','#99ff99','#9999ff',
  '#ffff99','#ffcc99','#99ffff','#ff99ff','#000000',
]

interface Props {
  selectedCount: number
  currentColor: string
  onColorChange: (color: string) => void
  visible: boolean
}

export default function ColorPanel({ selectedCount, currentColor, onColorChange, visible }: Props) {
  const [hex, setHex] = useState(currentColor)

  if (!visible) return null

  return (
    <Paper elevation={2} sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2, display: 'flex', alignItems: 'center', gap: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ minWidth: 120 }}>已选中 {selectedCount} 块灯板</Typography>
      <Box sx={{ width: 36, height: 36, bgcolor: currentColor, borderRadius: 1, border: 1, borderColor: 'divider', flexShrink: 0 }} />
      <TextField size="small" value={hex} onChange={e => { setHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onColorChange(e.target.value) }} sx={{ width: 100 }} placeholder="#ff0000" />
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {PRESETS.map(c => (
          <Box key={c} onClick={() => { setHex(c); onColorChange(c) }}
            sx={{ width: 24, height: 24, bgcolor: c, borderRadius: 0.5, border: c === currentColor ? 2 : 1,
              borderColor: c === currentColor ? 'primary.main' : 'divider', cursor: 'pointer', '&:hover': { transform: 'scale(1.2)' } }} />
        ))}
      </Box>
    </Paper>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/ColorPanel.tsx
git commit -m "feat(canvas): add ColorPanel component"
```

---

### Task 12: Create CanvasToolbar

- [ ] **Step 1: Create `src/renderer/components/CanvasToolbar.tsx`**

```typescript
import Paper from '@mui/material/Paper'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DeleteIcon from '@mui/icons-material/Delete'
import UndoIcon from '@mui/icons-material/Undo'
import ImageIcon from '@mui/icons-material/Image'
import NearMeIcon from '@mui/icons-material/NearMe'

type ToolMode = 'select' | 'hexagon' | 'triangle' | 'mini-triangle'

interface Props {
  toolMode: ToolMode
  onToolChange: (m: ToolMode) => void
  onDelete: () => void
  onUndo: () => void
  onExport: () => void
}

export default function CanvasToolbar({ toolMode, onToolChange, onDelete, onUndo, onExport }: Props) {
  return (
    <Paper elevation={1} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <ToggleButtonGroup value={toolMode} exclusive onChange={(_, v) => v && onToolChange(v)} size="small">
        <ToggleButton value="select"><NearMeIcon fontSize="small" /></ToggleButton>
        <ToggleButton value="hexagon">⬡</ToggleButton>
        <ToggleButton value="triangle">△</ToggleButton>
        <ToggleButton value="mini-triangle">▽</ToggleButton>
      </ToggleButtonGroup>
      <Tooltip title="删除选中 (Delete)"><IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="撤销 (Ctrl+Z)"><IconButton size="small" onClick={onUndo}><UndoIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="导出图片"><IconButton size="small" onClick={onExport}><ImageIcon fontSize="small" /></IconButton></Tooltip>
    </Paper>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasToolbar.tsx
git commit -m "feat(canvas): add CanvasToolbar component"
```

---

### Task 13: Create CanvasStage

- [ ] **Step 1: Create `src/renderer/components/CanvasStage.tsx`**

```typescript
import { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'
import CanvasGrid from './CanvasGrid'
import CanvasShapePanel from './CanvasShapePanel'
import type { PanelType, PlacedPanel, CanvasDesign } from '../../shared/canvas-types'

interface Props {
  design: CanvasDesign | null
  toolMode: 'select' | PanelType
  selectedIds: Set<string>
  ghostColor: string
  stageRef: React.MutableRefObject<Konva.Stage | null>
  onPanelClick: (id: string, shiftKey: boolean) => void
  onPanelDragStart: (id: string) => void
  onPanelDragEnd: (id: string, x: number, y: number) => void
  onStageClick: (x: number, y: number) => void
  onBlankClick: () => void
}

export default function CanvasStage({
  design, toolMode, selectedIds, ghostColor, stageRef,
  onPanelClick, onPanelDragStart, onPanelDragEnd, onStageClick, onBlankClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const panning = useRef(false)
  const lastP = useRef({ x: 0, y: 0 })
  const spaceHeld = useRef(false)

  useEffect(() => {
    const r = () => { if (containerRef.current) setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight }) }
    r(); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    const d = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); spaceHeld.current = true } }
    const u = (e: KeyboardEvent) => { if (e.code === 'Space') spaceHeld.current = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])

  const getPos = useCallback((): { x: number; y: number } => {
    return stageRef.current?.getRelativePointerPosition() ?? { x: 0, y: 0 }
  }, [stageRef])

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const st = stageRef.current; if (!st) return
    const ptr = st.getPointerPosition(); if (!ptr) return
    const ns = e.evt.deltaY > 0 ? scale * 0.9 : scale * 1.1
    const cs = Math.max(0.1, Math.min(5, ns))
    const m = { x: (ptr.x - offset.x) / scale, y: (ptr.y - offset.y) / scale }
    setScale(cs)
    setOffset({ x: ptr.x - m.x * cs, y: ptr.y - m.y * cs })
  }, [scale, offset, stageRef])

  const handleMove = useCallback(() => {
    if (toolMode === 'select') { setGhostPos(null); return }
    setGhostPos(getPos())
  }, [toolMode, getPos])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || spaceHeld.current) { panning.current = true; lastP.current = { x: e.evt.clientX, y: e.evt.clientY }; return }
    if (toolMode !== 'select') { const p = getPos(); onStageClick(p.x, p.y); return }
    if (e.target === e.target.getStage()) onBlankClick()
  }, [toolMode, getPos, onStageClick, onBlankClick])

  const handleMouseMovePan = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panning.current) { const dx = e.evt.clientX - lastP.current.x; const dy = e.evt.clientY - lastP.current.y; lastP.current = { x: e.evt.clientX, y: e.evt.clientY }; setOffset(o => ({ x: o.x + dx, y: o.y + dy })); return }
    handleMove()
  }, [handleMove])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#1a1a1a' }}>
      <Stage
        ref={stageRef}
        width={size.w} height={size.h}
        scaleX={scale} scaleY={scale} x={offset.x} y={offset.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMovePan}
        onMouseUp={() => { panning.current = false }}
      >
        <Layer listening={false}>
          <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#1a1a1a" />
          <CanvasGrid width={size.w} height={size.h} offsetX={offset.x} offsetY={offset.y} scale={scale} />
        </Layer>
        <Layer>
          {design?.panels.map(p => (
            <CanvasShapePanel
              key={p.id} panel={p}
              isSelected={selectedIds.has(p.id)}
              onDragStart={() => onPanelDragStart(p.id)}
              onDragEnd={(x, y) => onPanelDragEnd(p.id, x, y)}
              onClick={() => onPanelClick(p.id, false)}
            />
          ))}
          {ghostPos && toolMode !== 'select' && (
            <CanvasShapePanel
              panel={{ id: '__ghost__', type: toolMode as PanelType, x: ghostPos.x, y: ghostPos.y, rotation: 0, color: ghostColor, snappedTo: null }}
              isSelected={false} isGhost
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasStage.tsx
git commit -m "feat(canvas): add CanvasStage with zoom/pan/ghost preview"
```

---

### Task 14: Create CanvasPage orchestrator

- [ ] **Step 1: Create `src/renderer/components/CanvasPage.tsx`**

```typescript
import { useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type Konva from 'konva'
import CanvasToolbar from './CanvasToolbar'
import CanvasStage from './CanvasStage'
import ColorPanel from './ColorPanel'
import { useCanvasDesign } from '../hooks/useCanvasDesign'
import { api } from '../api'

export default function CanvasPage() {
  const stageRef = useRef<Konva.Stage | null>(null)
  const {
    design, designs, toolMode, selectedIds, setToolMode, setSelectedIds,
    refreshDesigns, newDesign, loadDesign, saveDesign, deleteDesign,
    addPanel, movePanel, movePanelEnd, updatePanelColor, deleteSelected, selectAll, undo,
  } = useCanvasDesign()

  useEffect(() => { refreshDesigns() }, [refreshDesigns])

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); selectAll() }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveDesign() }
      if (e.key === 'v' || e.key === 'V') setToolMode('select')
      if (e.key === '1') setToolMode('hexagon')
      if (e.key === '2') setToolMode('triangle')
      if (e.key === '3') setToolMode('mini-triangle')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [deleteSelected, undo, selectAll, saveDesign, setToolMode])

  const handleStageClick = useCallback((x: number, y: number) => {
    if (toolMode !== 'select') {
      addPanel(toolMode as 'hexagon' | 'triangle' | 'mini-triangle', x, y)
    }
  }, [toolMode, addPanel])

  const handlePanelClick = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (shiftKey) { next.has(id) ? next.delete(id) : next.add(id) }
      else { next.clear(); next.add(id) }
      return next
    })
  }, [setSelectedIds])

  const handleExport = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
    await api.exportDesignImage(dataUrl)
  }, [])

  const selectedColor = design && selectedIds.size > 0
    ? design.panels.find(p => selectedIds.has(p.id))?.color ?? '#ffffff'
    : '#ffffff'

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Design list */}
      <Paper square elevation={0} sx={{ width: 200, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>方案列表</Typography>
          <IconButton size="small" onClick={newDesign}><AddIcon fontSize="small" /></IconButton>
        </Box>
        <List dense sx={{ flex: 1, overflow: 'auto' }}>
          {designs.map(d => (
            <ListItemButton key={d.id} selected={design?.id === d.id} onClick={() => loadDesign(d.id)} sx={{ gap: 1 }}>
              <ListItemText primary={d.name} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
              <IconButton size="small" onClick={e => { e.stopPropagation(); deleteDesign(d.id) }}><DeleteIcon fontSize="small" /></IconButton>
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {/* Right: Canvas area */}
      <Box sx={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <CanvasToolbar
          toolMode={toolMode}
          onToolChange={setToolMode}
          onDelete={deleteSelected}
          onUndo={undo}
          onExport={handleExport}
        />
        <Box sx={{ flex: 1, position: 'relative' }}>
          <CanvasStage
            design={design}
            toolMode={toolMode}
            selectedIds={selectedIds}
            ghostColor={selectedColor}
            stageRef={stageRef}
            onPanelClick={handlePanelClick}
            onPanelDragStart={() => {}}
            onPanelDragEnd={(id, x, y) => movePanelEnd(id, x, y)}
            onStageClick={handleStageClick}
            onBlankClick={() => setSelectedIds(new Set())}
          />
          <ColorPanel
            selectedCount={selectedIds.size}
            currentColor={selectedColor}
            onColorChange={color => updatePanelColor([...selectedIds], color)}
            visible={selectedIds.size > 0}
          />
        </Box>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasPage.tsx
git commit -m "feat(canvas): add CanvasPage orchestrator"
```

---

### Task 15: Build and verify

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors. Fix any type mismatches found.

- [ ] **Step 2: Run dev**

```bash
npm run dev
```

Verify manually:
- Click "画板" in sidebar → CanvasPage loads
- Click "+" → new design created, listed on left
- Select hexagon tool → click canvas → hexagon placed
- Switch to select tool → click panel → selected (green outline)
- Change color in ColorPanel → panel updates
- Press Delete → panel removed
- Ctrl+Z → undo
- Wheel scroll → zoom
- Space+drag → pan
- Click Export → PNG saved via dialog

- [ ] **Step 3: Fix any issues and commit fixes**

```bash
git add -A
git commit -m "fix(canvas): resolve type errors and build issues"
```

---

## Plan Self-Review

- **Spec coverage check:**
  - Panel types (hexagon/triangle/mini-triangle) → Task 7 (geometry) + Task 10 (rendering)
  - Infinite canvas with zoom/pan → Task 13 (CanvasStage)
  - Background grid → Task 9 (CanvasGrid)
  - Toolbar with tool modes → Task 12 (CanvasToolbar)
  - Drag from toolbar to place → Task 14 (stage click handler)
  - Snap-to-edge connection → Task 7 (geometry utility for connection points) — note: snap during placement not yet implemented; current plan places at click position only. Will need a follow-up task or refinement in CanvasStage.
  - Single color per panel + batch color → Task 11 (ColorPanel) + Task 8 (hook updatePanelColor)
  - Select panel then set color → Task 14 (ColorPanel visible when selectedIds.size > 0)
  - File management (CRUD) → Task 3 (service) + Task 4 (IPC) + Task 5 (preload/api) + Task 14 (left list)
  - Export as PNG → Task 13 (stage.toDataURL) + Task 4 (DESIGN_EXPORT handler)
  - Keyboard shortcuts → Task 14 (useEffect keyboard handler)
  - Page integration → Task 6 (App.tsx + Sidebar)

- **Gap identified:** During placement, the snap-to-adjacent-panel logic is not yet implemented. The `panelGeometry.ts` utility provides `getConnectionWorldPos()` and `dist()` for snap detection, and the `findSnapTarget` helper was omitted from CanvasStage in the plan. This should be added as a refinement during implementation — the core infrastructure (geometry + connection points) is in place.

- **No placeholders found.** All code blocks contain complete implementations.
