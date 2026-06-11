# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev (electron-vite dev via dev.mjs wrapper)
npm run build      # Production build
npm run preview    # Preview production build
```

No tests or linters configured.

## Architecture

This is an **Electron** desktop app for controlling **Nanoleaf** LED light panels over HTTP, with AI features for generating effects ("Skills") and designing panel layouts ("Canvas").

### Three-tier Electron structure

```
src/main/        Main process (Node.js)
src/main/preload.ts  Context bridge — exposes window.electronAPI to renderer
src/renderer/    Renderer process (React + MUI)
src/shared/      Types and IPC channel constants shared by both
```

Build tool: **electron-vite** — outputs to `out/main/`, `out/preload/`, `out/renderer/`.

### Main process

- **`main.ts`** — App entry. Creates `BrowserWindow`, calls `registerHandlers()`.
- **`ipc-handlers.ts`** — Central routing: all `ipcMain.handle`/`ipcMain.on` registrations. Each handler delegates to a service.
- **`agent.service.ts`** — LLM chat with tool-calling (Function Calling). Builds a system prompt (Nanoleaf OpenAPI doc + tool defs), runs multi-round tool loop with `MAX_TOOL_ROUNDS=5`. Supports both `chat()` (non-streaming) and `chatStream()` (streaming). Manages chat sessions with CRUD.
- **`canvas-agent.service.ts`** — Separate agent for generating panel layout designs. Two modes: **iterative** (LLM outputs JSON, validated/retried up to 3 times) and **agentic** (LLM uses `addPanel`/`removePanel`/`movePanel`/etc. tools up to 25 rounds). Extracts design knowledge from existing designs to inform new ones.
- **`tools/`** — Tool definitions for the agent's function-calling:
  - `control.tools.ts` — `setPower`, `setBrightness`, `setColor`, `setColorTemp`, `identifyDevice`, `discoverDevices`
  - `query.tools.ts` — `getDeviceInfo`, `getDeviceState`, `getPanelLayout`
  - `effect.tools.ts` — `listEffects`, `getCurrentEffect`, `selectEffect`, `deleteEffect`, `renameEffect`
  - `skill.tools.ts` — `createEffect` (saves to Skill library, doesn't write to device)
  - `index.ts` — Aggregates all tool defs and executors
- **`nanoleaf-api.service.ts`** — HTTP client for Nanoleaf REST API (`/api/v1/{token}/state`, `/api/v1/{token}/effects`, etc.). Uses `device.service` for connection state. Includes `normalizeEffectDef()` to clean up LLM-generated effect JSON.
- **`nanoleaf-auth.service.ts`** — POST `/api/v1/new` to get auth token (requires button hold on device).
- **`design.service.ts`** — CRUD for Canvas designs (stored as individual JSON in `designs/` at project root).
- **`device.service.ts`** — Device lifecycle: saved device list, connect/disconnect, status broadcasting.
- **`discovery.service.ts`** — SSDP discovery + subnet IP scan fallback to find Nanoleaf devices on LAN.
- **`color-converter.ts`** — RGB ↔ HSB ↔ HEX conversion utilities.
- **`skill-executor.ts`** — Resolves Skill params against user values, renders `{{params.xxx}}` template in `bodyTemplate`, parses `METHOD /path` endpoint, calls `sendRequest()`.
- **`skill.service.ts`** — Skill CRUD. Skills stored as individual JSON files in `userData/data/skills/`.
- **`llm/`** — `LLMAdapter` interface with `chat`, `chatStream`, `chatWithTools`, `chatWithToolsStream`. Two implementations: `openai.adapter.ts` (OpenAI-compatible API) and `ollama.adapter.ts` (Ollama local API). Selected by `getAdapter(config)`. The OpenAI adapter is the primary one with full tool-calling support; Ollama falls back to prompting.
- **`storage.ts`** — Thin JSON file persistence in `app.getPath('userData')/data/`.

### LLM adapter types (llm/types.ts)

The `LLMAdapter` interface exposes:
- `chat(messages, config)` → plain text response
- `chatStream(messages, config, onChunk)` → streaming text
- `chatWithTools(messages, tools, config)` → `ToolCallResponse` with `finishReason` and `toolCalls`
- `chatWithToolsStream(messages, tools, config, onChunk)` → streaming with tool calls

`ToolCallResponse` includes `finishReason: 'stop' | 'tool_uses'`, `toolCalls: Array<{id, name, arguments}>`, and optional `reasoningContent` for reasoning models.

### Renderer process (React)

- **`main.tsx`** — Entry, wraps App in MUI `ThemeProvider`.
- **`App.tsx`** — Root layout: sidebar + main content area + status bar. Pages: `control`, `skills`, `agent`, `settings`, `canvas` — switched via state.
- **`api.ts`** — Typed wrapper around `window.electronAPI` (the contextBridge API). Re-exports types from `shared/types.ts`.
- **`theme.ts`** — MUI v9 theme with green primary (#10B981), custom overrides for buttons, cards, inputs, etc.

### Canvas (panel layout design)

The Canvas subsystem lets users design Nanoleaf panel layouts visually:
- **`CanvasPage.tsx`** — Main canvas page with toolbar, stage, shape panel, and AI dialog
- **`CanvasStage.tsx`** — Konva.js stage for drag-and-drop panel placement, connection marks
- **`CanvasToolbar.tsx`** — Edit/sim mode toggle, tools
- **`CanvasGrid.tsx`** — Background grid
- **`CanvasShapePanel.tsx`** — Panel type selector (triangle/hexagon/mini-triangle)
- **`CanvasAIDialog.tsx`** — AI-assisted design dialog (generate layout from description)
- **`useCanvasDesign.ts`** — State management for current design, panels, undo

Canvas data stored as individual JSON files in `designs/` at project root.

### Simulation (effect preview)

Preview Nanoleaf effects in the renderer without sending to the device:
- **`SimulationEngine.ts`** — Maps effect plugin UUIDs to engine implementations, runs animation loop via `requestAnimationFrame`
- **`PanelGraph.ts`** — Builds graph structure from panel layout for simulation
- **`color-utils.ts`** — Palette upsampling for smooth gradients
- **`engines/`** — Six effect engines: `flow.engine.ts`, `wheel.engine.ts`, `explode.engine.ts`, `fade.engine.ts`, `random.engine.ts`, `highlight.engine.ts`
- **`SimEffectPanel.tsx`** — UI to browse/play effects in sim mode

### Shared modules

- **`shared/types.ts`** — All IPC channel constants, device/skill/chat/LLM config types, `ToolCallRecord` interface
- **`shared/canvas-types.ts`** — `PanelType`, `PlacedPanel`, `CanvasDesign`, `CanvasDesignMeta`
- **`shared/panelGeometry.ts`** — Panel geometry computation: vertex positions, edge detection, overlap detection, `getWorldVertices()`, `panelsOverlap()`, `panelsShareEdge()`

### IPC & data flow

- **Invoke (request-response)**: Renderer → `ipcRenderer.invoke(channel, ...args)` → `ipcMain.handle(channel, handler)` → return value.
- **Send (push)**: Used for streaming chat. Renderer sends `agent:chatStream`, main pushes chunks via `event.sender.send(agent:onStreamChunk, chunk)` with `__DONE__` sentinel. Also: `agent:onToolStatus` for tool execution progress, `design:aiGenerateProgress` for canvas generation progress.
- **Broadcast**: Device status changes pushed to ALL windows.

### Key concepts

- **Skill**: A parameterized macro mapping to a Nanoleaf API call. Has metadata, params, and mapping (HTTP method/path + body template). Created manually or generated by the AI Agent via `createEffect` tool call.
- **Agent**: AI assistant that controls Nanoleaf devices through 11 function-calling tools (control, query, effect management, skill creation). System prompt includes Nanoleaf OpenAPI docs. Supports multi-round tool use (up to 5 rounds) with reasoning models.
- **Canvas Design**: A layout of panels (triangle/hexagon/mini-triangle) positioned on a 2D plane. Can be designed manually in the Canvas page or generated by the Canvas AI Agent with tool-based iterative construction.
- **Device**: Nanoleaf light panels at `host:port` (default 16021), discovered via SSDP or subnet scan, authenticated via POST `/api/v1/new`.
