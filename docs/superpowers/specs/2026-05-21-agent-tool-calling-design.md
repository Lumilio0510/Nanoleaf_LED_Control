# Agent Tool Calling 重构设计

**日期**: 2026-05-21
**版本**: V1
**依赖**: 2026-05-13-led-control-design.md

---

## 概述

将 Agent 从单一的 Skill 生成器升级为完整的 Nanoleaf 设备管理助手，支持 Tool Calling 驱动的多意图处理：直接控制设备、查询状态、管理特效、生成复杂灯效方案。

- **LLM 支持**: OpenAI 兼容 API（Function Calling）
- **Ollama**: 暂不支持，后续可加 JSON mode 降级

---

## System Prompt 结构

System Prompt 从静态内嵌字符串改为动态组装，包含 5 个部分：

| 部分 | 内容 | 来源 |
|---|---|---|
| 角色定义 | "你是 Nanoleaf LED 控制助手..." | 硬编码 2-3 句 |
| 设备上下文 | 当前连接设备名、IP、状态、当前特效、亮度 | `device.service` 实时注入 |
| 工具使用规则 | 根据用户意图选择合适工具，不确定时先查询 | 硬编码 |
| Skill 生成规则 | Skill JSON schema、复杂特效示例、常见错误提示 | 硬编码 |
| API 参考 | 完整的 Nanoleaf OpenAPI 文档 | `userData/data/api-doc.md` 动态加载 |

### 设备上下文注入示例

```
当前连接: 客厅LED | 192.168.1.100 | 在线
当前特效: Flames | 亮度: 80% | 开关: 开
设备型号: NL22 | 固件: 1.5.0
```

每次构建 messages 时从 `device.service` 读取最新状态，让 LLM 无需额外工具调用即可回答基本状态问题。

---

## Tool 定义

共 16 个工具，分为 5 个类别。通过 OpenAI `tools` 参数传递，每个工具有完整的 `description` 和 `parameters` JSON Schema。

### 控制类

| 工具 | 参数 | 说明 |
|---|---|---|
| `setPower` | `on: boolean` | 开关灯 |
| `setBrightness` | `value: number (0-100)`, `duration?: number (秒)` | 调节亮度 |
| `setColor` | `hue: number (0-360)`, `saturation: number (0-100)`, `brightness?: number (0-100)` | 设置 HSB 颜色 |
| `setColorTemp` | `value: number (1200-6500)` | 设置色温(Kelvin) |

### 查询类

| 工具 | 参数 | 说明 |
|---|---|---|
| `getDeviceInfo` | 无 | 获取设备完整信息 |
| `getDeviceState` | 无 | 获取开关/亮度/颜色/色温/颜色模式 |
| `getPanelLayout` | 无 | 获取面板布局位置数据 |

### 特效管理类

| 工具 | 参数 | 说明 |
|---|---|---|
| `listEffects` | 无 | 列出设备上所有已保存特效 |
| `getCurrentEffect` | 无 | 查看当前运行的特效名 |
| `selectEffect` | `name: string` | 切换到指定特效 |
| `deleteEffect` | `name: string` | 删除设备上的特效 |
| `renameEffect` | `name: string`, `newName: string` | 重命名特效 |

### Skill 类

| 工具 | 参数 | 说明 |
|---|---|---|
| `createEffect` | `effectDefinition: object` (完整 Nanoleaf effect JSON) | 创建/更新特效，同时自动保存为 Skill |
| `previewEffect` | `effectDefinition: object`, `duration?: number` | 临时预览特效不保存 |

### 设备类

| 工具 | 参数 | 说明 |
|---|---|---|
| `identifyDevice` | 无 | 闪烁面板以识别 |
| `discoverDevices` | 无 | 扫描局域网发现设备 |

### 工具参数约束

- `pluginUuid` 用 `enum` 列出 6 个已知 UUID：Flow/Wheel/Explode/Fade/Random/Highlight
- `pluginType` 用 `enum`: `"color"` | `"rhythm"`
- `linDirection` 用 `enum`: `"left"` | `"right"` | `"up"` | `"down"`
- `pluginOptions[].name` 枚举所有合法选项名，`value` 用 `minimum`/`maximum` 约束范围
- `palette` 数组限制 1-20 个颜色
- HSB 值范围：`hue: 0-360`, `saturation: 0-100`, `brightness: 0-100`

---

## Agent 编排流程

```
用户消息
    │
    ▼
┌─ 构建 messages ──────────────────────────────────────────┐
│  [system prompt(动态)] + [历史消息] + [当前用户消息]        │
│  + [tools: 16个工具定义]                                   │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ LLM 响应 ────────────────────────────────────────────────┐
│  finish_reason: "tool_calls"                              │
│    → 解析 tool_calls，逐个执行                             │
│    → 结果追加到 messages: { role: "tool", ... }            │
│    → 再次调用 LLM（最多 5 轮）                              │
│                                                           │
│  finish_reason: "stop"                                    │
│    → 提取最终文本回复                                      │
│    → 如果调用了 createEffect，附带 Skill 信息               │
└──────────────────────────────────────────────────────────┘
```

### 设计要点

1. **最大轮数**: 5 轮，防止无限循环和 token 消耗失控
2. **错误反馈**: 工具执行失败返回 `{ error: "message" }`，LLM 可据此调整重试
3. **createEffect 的 Skill 关联**: 执行 `createEffect` 时自动从返回的 effect JSON 提取为 Skill 保存到本地 Skill 库，返回结果包含 `skillId`
4. **Streaming 适配**: 工具调用阶段前端显示状态提示（"正在操作设备..."），最终文本回复正常 streaming

---

## 复杂灯效 Schema（createEffect 的 effectDefinition）

支持三种类型，通过 `animType` 字段区分：

### Plugin 型（动态特效）

使用内置插件，`animType: "plugin"`：

```json
{
  "command": "add",
  "animName": "我的特效",
  "animType": "plugin",
  "colorType": "HSB",
  "pluginUuid": "027842e4-e1d6-4a4c-a731-be74a1ebd4cf",
  "pluginType": "color",
  "pluginOptions": [
    { "name": "transTime", "value": 4 },
    { "name": "linDirection", "value": "right" },
    { "name": "loop", "value": true }
  ],
  "palette": [
    { "hue": 0, "saturation": 100, "brightness": 100 }
  ]
}
```

### Static 型（静态自定义布局）

每面板独立颜色，`animType: "static"`，需提供 `animData`：

```json
{
  "command": "add",
  "animName": "静态布局",
  "animType": "static",
  "colorType": "HSB",
  "animData": "3 82 1 255 0 255 0 20 60 1 0 255 255 0 20 118 1 0 0 0 0 20",
  "loop": false
}
```

### Solid 型（纯色）

最简单的统一颜色，`animType: "solid"`：

```json
{
  "command": "add",
  "animName": "纯红",
  "animType": "solid",
  "colorType": "HSB",
  "palette": [
    { "hue": 0, "saturation": 100, "brightness": 100 }
  ]
}
```

---

## LLM 适配器变更

### 新增接口

当前 `LLMAdapter` 接口需扩展 `chatWithTools` 方法：

```ts
interface LLMAdapter {
  chat(messages: ChatMessage[], config: LLMConfig): Promise<string>
  chatStream(messages: ChatMessage[], config: LLMConfig, onChunk: (s: string) => void): Promise<string>
  chatWithTools(messages: ChatMessage[], tools: ToolDef[], config: LLMConfig): Promise<ToolCallResponse>
}
```

### ToolCallResponse

```ts
interface ToolCallResponse {
  finishReason: 'stop' | 'tool_calls'
  content: string | null          // finishReason='stop' 时的文本
  toolCalls: ToolCall[]           // finishReason='tool_calls' 时的工具调用
}

interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}
```

### 实现范围

- OpenAIA 适配器实现完整 `chatWithTools`（使用 `tools` + `tool_choice` API 参数）
- Ollama 适配器暂不实现，调用时抛出 `'Tool calling not supported'` 错误

---

## 文件变更范围

| 文件 | 变更 |
|---|---|
| `src/main/agent.service.ts` | 重写：System Prompt 动态组装 + Tool Calling 循环 |
| `src/main/llm/types.ts` | 新增 `ToolDef`, `ToolCall`, `ToolCallResponse` 类型 |
| `src/main/llm/openai.adapter.ts` | 新增 `chatWithTools` 方法 |
| `src/main/llm/ollama.adapter.ts` | 新增 `chatWithTools` 桩方法（抛错） |
| `src/main/ipc-handlers.ts` | 更新 `agent:chatStream` handler 适配新流程 |
| `src/renderer/components/AgentChat.tsx` | 展示工具调用状态、Skill 结果卡片 |
| `src/renderer/hooks/useChat.ts` | 处理 tool_calls 状态变更 |

### 新增文件

| 文件 | 职责 |
|---|---|
| `src/main/tools/` | 工具执行器目录 |
| `src/main/tools/index.ts` | 工具注册表：名称 → 执行函数 + JSON Schema 定义 |
| `src/main/tools/control.tools.ts` | 控制类工具实现 |
| `src/main/tools/query.tools.ts` | 查询类工具实现 |
| `src/main/tools/effect.tools.ts` | 特效管理类工具实现 |
| `src/main/tools/skill.tools.ts` | Skill 类工具实现 |

---

## 与现有系统的关系

- **Skill 系统保持不变**: Skill 仍然是核心概念，`createEffect` 自动生成 Skill 存入 Skill 库
- **device.service / nanoleaf-api.service**: 工具执行直接调用现有服务，不重复实现
- **会话管理**: 沿用现有 `chat_sessions.json` 存储，消息中增加 `toolCalls` 字段记录工具调用历史
- **前端**: ChatMessage 类型扩展 `toolCalls?: ToolCallRecord[]` 字段，AgentChat 组件新增工具调用状态的 inline 展示
