# Canvas AI Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "创造性 AI" button to the canvas toolbar that takes a natural language description and generates a panel layout using the three existing panel types.

**Architecture:** Single-round prompt→JSON approach. A new `canvas-agent.service.ts` builds a geometry-aware system prompt, calls the existing LLM adapter (non-streaming), parses and validates the JSON output. The renderer receives the panels, clears the canvas, places them with snap detection, and saves.

**Tech Stack:** Electron IPC, MUI Dialog, existing LLM adapter (OpenAI/Ollama), Konva canvas

---

## File Structure

```
Create:
  src/main/canvas-agent.service.ts    — System prompt builder, LLM call, JSON parse & validate
  src/renderer/components/CanvasAIDialog.tsx — Input dialog component

Modify:
  src/shared/types.ts                 — Add IPC.DESIGN_AI_GENERATE constant
  src/main/ipc-handlers.ts            — Register design:aiGenerate handler
  src/main/preload.ts                 — Expose aiGeneratePanels bridge API
  src/renderer/api.ts                 — Add renderer-side API + type declaration
  src/renderer/hooks/useCanvasDesign.ts — Add replaceAllPanels function
  src/renderer/components/CanvasToolbar.tsx — Add "创造性AI" button
  src/renderer/components/CanvasPage.tsx — Wire dialog + generation logic
```

---

### Task 1: Add IPC channel constant

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add `DESIGN_AI_GENERATE` to the IPC object**

Locate the `DESIGN_EXPORT` line (around line 52) in the `IPC` object and add the new constant after it:

```typescript
  DESIGN_EXPORT: 'design:export',
  DESIGN_AI_GENERATE: 'design:aiGenerate',  // <-- add this line
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(canvas-ai): add DESIGN_AI_GENERATE IPC channel constant"
```

---

### Task 2: Create canvas-agent.service.ts

**Files:**
- Create: `src/main/canvas-agent.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
import { readJSON } from './storage'
import type { LLMConfig } from '../shared/types'
import type { PanelType } from '../shared/canvas-types'
import { getAdapter, type ChatMessage } from './llm'

const SYSTEM_PROMPT = `你是 Nanoleaf Shape 灯板布局设计师。
根据用户的描述，用三种灯板拼出大致形状。

## 可用灯板

1. 六边形 (hexagon):
   - 中心到顶点距离: 67px
   - 6条边，形似正六边形
   - 有6个连接点（每条边中点）

2. 三角形 (triangle):
   - 边长: 134px，中心到顶点约77px
   - 等边三角形，尖角默认朝上(rotation=0)
   - 有6个连接点（每条边2个三等分点）

3. 迷你三角形 (mini-triangle):
   - 边长: 67px，中心到顶点约39px
   - 等边三角形，面积约为三角形的1/4
   - 有3个连接点（每条边中点）

## 几何约束

- 迷你三角形边长 = 六边形边长 = 67px
- 三角形边长 = 2 × 迷你三角形边长 = 134px
- 两个迷你三角形并排 = 一个三角形

## 坐标规则

- 画布以(0,0)为中心，x轴向右，y轴向下
- 相邻六边形中心间距约116px（水平方向约100px，交错排列约58px垂直偏移）
- 相邻三角形中心间距约77px
- 相邻迷你三角形中心间距约39px
- 控制总量在8-30块板子之间
- rotation为角度制: 0保持三角形尖角朝上，30为六边形一个顶点朝上

## 配色规则

- 根据形状语义自动选择颜色方案
- 爱心→红/粉红系，星星→金黄系，树/植物→绿色系，海洋/水→蓝色系，太阳→橙黄系
- 不同区域可用不同深浅的同色系颜色增强层次感
- 辅助/背景板用浅灰(#cccccc)或白色(#ffffff)
- 颜色格式: hex字符串 "#rrggbb"

## 输出格式

严格只输出一个 JSON 数组，不要任何额外文字:

[
  {"type":"hexagon","x":0,"y":0,"rotation":0,"color":"#ff4444"},
  ...
]`

const VALID_TYPES: PanelType[] = ['hexagon', 'triangle', 'mini-triangle']
const MAX_PANELS = 50

function buildMessages(description: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: description },
  ]
}

function extractJson(text: string): string {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('AI 返回格式异常，未找到 JSON 数组，请重试')
  return match[0]
}

interface ValidatedPanel {
  type: PanelType
  x: number
  y: number
  rotation: number
  color: string
}

function validatePanels(raw: unknown[]): ValidatedPanel[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('AI 未生成任何灯板，请尝试更详细的描述')
  }
  if (raw.length > MAX_PANELS) {
    throw new Error(`AI 生成了 ${raw.length} 块灯板，超过上限 ${MAX_PANELS}，请尝试简化描述`)
  }

  return raw.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`第 ${i + 1} 块灯板数据格式错误`)
    }
    const obj = item as Record<string, unknown>

    const type = obj.type
    if (!VALID_TYPES.includes(type as PanelType)) {
      throw new Error(`第 ${i + 1} 块灯板类型 "${type}" 不合法，仅支持 hexagon / triangle / mini-triangle`)
    }

    if (typeof obj.x !== 'number' || isNaN(obj.x)) {
      throw new Error(`第 ${i + 1} 块灯板 x 坐标无效`)
    }
    if (typeof obj.y !== 'number' || isNaN(obj.y)) {
      throw new Error(`第 ${i + 1} 块灯板 y 坐标无效`)
    }
    if (typeof obj.rotation !== 'number' || isNaN(obj.rotation)) {
      throw new Error(`第 ${i + 1} 块灯板 rotation 无效`)
    }
    if (typeof obj.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(obj.color)) {
      throw new Error(`第 ${i + 1} 块灯板颜色 "${obj.color}" 不合法，需为 #rrggbb 格式`)
    }

    return {
      type: type as PanelType,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation,
      color: obj.color,
    }
  })
}

export interface GenerateResult {
  panels: ValidatedPanel[]
}

export async function generatePanels(description: string): Promise<GenerateResult> {
  const config = readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
  if (!config.apiKey && config.provider === 'openai') {
    throw new Error('请先在设置中配置 LLM')
  }

  const adapter = getAdapter(config)
  const messages = buildMessages(description)

  const text = await adapter.chat(messages, config)

  const jsonStr = extractJson(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('AI 返回的 JSON 解析失败，请重试')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI 返回的不是数组格式，请重试')
  }

  const panels = validatePanels(parsed)
  return { panels }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/canvas-agent.service.ts
git commit -m "feat(canvas-ai): add canvas-agent service with prompt and validation"
```

---

### Task 3: Register IPC handler

**Files:**
- Modify: `src/main/ipc-handlers.ts`

- [ ] **Step 1: Import canvas-agent.service**

Add the import line after the existing `designService` import (around line 10):

```typescript
import * as designService from './design.service'
import * as canvasAgentService from './canvas-agent.service'  // <-- add this line
```

- [ ] **Step 2: Add handler in the Canvas section**

After the `DESIGN_EXPORT` handler (around line 226), add:

```typescript
  ipcMain.handle(IPC.DESIGN_AI_GENERATE, async (_event, description: string) => {
    return canvasAgentService.generatePanels(description)
  })
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat(canvas-ai): register design:aiGenerate IPC handler"
```

---

### Task 4: Expose API in preload

**Files:**
- Modify: `src/main/preload.ts`

- [ ] **Step 1: Add bridge API**

After the `renameDesign` line (around line 78), add:

```typescript
  renameDesign: (id: string, newName: string): Promise<{ id: string; name: string; updatedAt: string }> => ipcRenderer.invoke(IPC.DESIGN_RENAME, id, newName),
  aiGeneratePanels: (description: string): Promise<{ panels: Array<{ type: string; x: number; y: number; rotation: number; color: string }> }> =>
    ipcRenderer.invoke(IPC.DESIGN_AI_GENERATE, description),
```

- [ ] **Step 2: Commit**

```bash
git add src/main/preload.ts
git commit -m "feat(canvas-ai): expose aiGeneratePanels via preload bridge"
```

---

### Task 5: Add renderer API wrapper

**Files:**
- Modify: `src/renderer/api.ts`

- [ ] **Step 1: Add type declaration in the Window interface**

After the `renameDesign` type declaration (around line 54), add:

```typescript
      renameDesign: (id: string, newName: string) => Promise<{ id: string; name: string; updatedAt: string }>
      aiGeneratePanels: (description: string) => Promise<{ panels: Array<{ type: string; x: number; y: number; rotation: number; color: string }> }>
```

- [ ] **Step 2: Add API export**

After the `renameDesign` line in the `api` object (around line 106), add:

```typescript
  renameDesign: (id: string, newName: string) => window.electronAPI.renameDesign(id, newName),
  aiGeneratePanels: (description: string) => window.electronAPI.aiGeneratePanels(description),
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/api.ts
git commit -m "feat(canvas-ai): add aiGeneratePanels to renderer API"
```

---

### Task 6: Add replaceAllPanels to useCanvasDesign hook

**Files:**
- Modify: `src/renderer/hooks/useCanvasDesign.ts`

- [ ] **Step 1: Add replaceAllPanels function**

Add this function before the `return` statement (before line 174):

```typescript
  const replaceAllPanels = useCallback((panels: PlacedPanel[]) => {
    if (!design) return
    pushUndo()
    setDesign({
      ...design,
      panels,
      updatedAt: new Date().toISOString(),
    })
    setSelectedIds(new Set())
  }, [design, pushUndo])
```

- [ ] **Step 2: Export replaceAllPanels in the return object**

Add to the return statement:

```typescript
  return {
    design, designs, toolMode, selectedIds, setDesign, setToolMode, setSelectedIds,
    refreshDesigns, newDesign, loadDesign, saveDesign, deleteDesign, renameDesign,
    addPanel, movePanel, movePanelEnd, batchUpdatePanels, updatePanelColor,
    deleteSelected, rotatePanel, selectAll, undo, replaceAllPanels,
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useCanvasDesign.ts
git commit -m "feat(canvas-ai): add replaceAllPanels to useCanvasDesign hook"
```

---

### Task 7: Create CanvasAIDialog component

**Files:**
- Create: `src/renderer/components/CanvasAIDialog.tsx`

- [ ] **Step 1: Create the dialog component**

```typescript
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

interface Props {
  open: boolean
  onClose: () => void
  onGenerate: (description: string) => Promise<void>
}

export default function CanvasAIDialog({ open, onClose, onGenerate }: Props) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    const trimmed = description.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      await onGenerate(trimmed)
      setDescription('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setDescription('')
      setError('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>创造性 AI</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          multiline
          minRows={3}
          maxRows={6}
          fullWidth
          placeholder="描述你想要的形状，例如：一个爱心 / 一颗五角星 / 一棵圣诞树"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
          sx={{ mt: 1 }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleGenerate()
            }
          }}
        />
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>取消</Button>
        <Button
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {loading ? '生成中...' : '生成'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasAIDialog.tsx
git commit -m "feat(canvas-ai): add CanvasAIDialog component"
```

---

### Task 8: Add AI button to CanvasToolbar

**Files:**
- Modify: `src/renderer/components/CanvasToolbar.tsx`

- [ ] **Step 1: Add the AI button and onGenerateAI prop**

Add AutoAwesome icon import:

```typescript
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
```

Add `onGenerateAI` prop to the Props interface:

```typescript
interface Props {
  toolMode: ToolMode
  onToolChange: (m: ToolMode) => void
  onDelete: () => void
  onUndo: () => void
  onExport: () => void
  onGenerateAI: () => void
}
```

Add the button to the JSX, with a Box spacer to push it to the right. Replace the return value entirely:

```typescript
export default function CanvasToolbar({ toolMode, onToolChange, onDelete, onUndo, onExport, onGenerateAI }: Props) {
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
      <Box sx={{ flex: 1 }} />
      <Tooltip title="创造性 AI">
        <Button size="small" variant="outlined" startIcon={<AutoAwesomeIcon fontSize="small" />} onClick={onGenerateAI}>
          创造性 AI
        </Button>
      </Tooltip>
    </Paper>
  )
}
```

Also add the missing imports at the top:

```typescript
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasToolbar.tsx
git commit -m "feat(canvas-ai): add 创造性AI button to CanvasToolbar"
```

---

### Task 9: Wire dialog and generation in CanvasPage

**Files:**
- Modify: `src/renderer/components/CanvasPage.tsx`

- [ ] **Step 1: Add imports and state**

Add import for `CanvasAIDialog` and `PanelsOverlap`:

```typescript
import CanvasAIDialog from './CanvasAIDialog'
import { panelsOverlap } from '../utils/panelGeometry'
import type { PlacedPanel } from '../../shared/canvas-types'
```

Add dialog state in the component. Add after the `renamingId`/`editName` state:

```typescript
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
```

Destructure `replaceAllPanels` from the hook:

```typescript
    addPanel, movePanelEnd, batchUpdatePanels, updatePanelColor,
    deleteSelected, rotatePanel, selectAll, undo, replaceAllPanels,
  } = useCanvasDesign()
```

- [ ] **Step 2: Add generate handler**

Add the handler function before the `return`:

```typescript
  const handleAIGenerate = useCallback(async (description: string) => {
    const result = await api.aiGeneratePanels(description)
    const newPanels: PlacedPanel[] = result.panels.map(p => ({
      id: crypto.randomUUID(),
      type: p.type,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      color: p.color,
      snappedTo: null,
    }))

    // Overlap check
    for (let i = 0; i < newPanels.length; i++) {
      for (let j = i + 1; j < newPanels.length; j++) {
        if (panelsOverlap(newPanels[i], newPanels[j])) {
          throw new Error(`AI 生成的第 ${i + 1} 和第 ${j + 1} 块灯板重叠，请重试`)
        }
      }
    }

    replaceAllPanels(newPanels)
    await api.saveDesign({
      id: design?.id ?? crypto.randomUUID(),
      name: design?.name ?? 'AI Generated',
      panels: newPanels,
      createdAt: design?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await refreshDesigns()
  }, [design, replaceAllPanels, refreshDesigns])
```

- [ ] **Step 3: Wire the toolbar and dialog**

In the JSX, add `onGenerateAI` prop to `CanvasToolbar`:

```typescript
        <CanvasToolbar
          toolMode={toolMode}
          onToolChange={setToolMode}
          onDelete={deleteSelected}
          onUndo={undo}
          onExport={handleExport}
          onGenerateAI={() => setAiDialogOpen(true)}
        />
```

Add the dialog component before the closing `</Box>` of the outer container:

```typescript
      <CanvasAIDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        onGenerate={handleAIGenerate}
      />
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/CanvasPage.tsx
git commit -m "feat(canvas-ai): wire CanvasAIDialog and generation logic in CanvasPage"
```

---

### Task 10: Build and verify

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 2: Start dev and smoke test**

```bash
npm run dev
```

Manual tests:
1. Open the canvas page
2. Verify the "创造性 AI" button is visible on the right side of the toolbar
3. Click the button → dialog opens
4. Enter a description like "一个爱心" and click Generate
5. Verify panels appear on the canvas
6. Verify the generated panels don't overlap
7. Test error case: enter gibberish and verify error message shows
8. Test with LLM unconfigured → verify error about settings

- [ ] **Step 3: Commit any fixes if needed**
