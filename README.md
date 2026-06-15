# Softwaves LED Control

一款跨平台的桌面应用程序，用于控制 **Nanoleaf** 智能 LED 灯板。支持设备发现、灯光控制、特效管理、AI 对话生成灯效，以及可视化面板布局设计（Canvas）。

![Electron](https://img.shields.io/badge/Electron-30.x-47848F) ![React](https://img.shields.io/badge/React-19.x-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6) ![MUI](https://img.shields.io/badge/MUI-9.x-007FFF)

---

## 功能概览

### 🎮 设备控制
- **自动发现** — 通过 SSDP 和子网 IP 扫描自动发现局域网内的 Nanoleaf 设备
- **设备认证** — 支持 Nanoleaf 认证流程（按压设备按钮获取 Token）
- **实时控制** — 开关、亮度调节、颜色设置（RGB/HSB）、色温调节
- **设备识别** — 远程闪烁设备以便定位
- **多设备管理** — 添加、重命名、删除设备，设备在线状态实时监控

### ✨ 灯效管理
- **特效列表** — 浏览设备上的所有特效
- **特效切换** — 即时切换当前特效
- **特效编辑** — 重命名、删除设备特效
- **Skill 系统** — 可参数化的灯效模板，支持自定义参数和 HTTP 请求映射

### 🤖 AI 助手（Agent）
- **自然语言控制** — 通过对话控制灯光（"把灯调成蓝色"、"亮度调到 50%"）
- **智能工具调用** — 内置 11 个工具函数（控制、查询、特效管理、Skill 创建）
- **多轮对话** — 支持最多 5 轮工具调用循环
- **流式输出** — 实时流式响应，支持推理模型
- **会话管理** — 多会话保存、历史记录回溯
- **快捷指令** — 可定制的快捷命令模板

### 🎨 画板设计（Canvas）
- **可视化布局** — 使用 Konva.js 拖拽式设计面板布局
- **多种面板类型** — 支持三角形（△）、六边形（⬡）、迷你三角形（▽）
- **智能吸附** — 拖拽面板时边缘自动吸附对齐，吸附连接处以白色标记线指示
- **AI 生成布局** — 通过文字描述或参考图片让 AI 自动生成面板布局
- **布局管理** — 左侧方案列表，支持新建、保存、重命名（双击重命名）、删除
- **撤销/重做** — 支持 Ctrl+Z 撤销操作
- **导出图片** — 将当前布局导出为 PNG 图片
- **灯效模拟** — 在布局上实时预览 Skill 灯效，无需真实设备

### 📡 灯效模拟（Simulation）
- **离屏预览** — 在应用中预览灯效效果，无需发送到真实设备
- **多种引擎** — 流（Flow）、色轮（Wheel）、爆炸（Explode）、渐变（Fade）、随机闪烁（Random）、高亮（Highlight）
- **面板图结构** — 基于布局构建面板邻接图，实现颜色传播模拟

### ⚙️ LLM 集成
- **多供应商支持** — 兼容 OpenAI 兼容 API 和 Ollama 本地模型
- **灵活配置** — 自定义 API 地址、模型、密钥
- **工具调用** — 完整支持 Function Calling 协议

---

## 技术架构

```
src/
├── main/                    # Electron 主进程 (Node.js)
│   ├── main.ts              # 应用入口，创建 BrowserWindow
│   ├── ipc-handlers.ts      # IPC 路由注册中心
│   ├── agent.service.ts     # AI Agent 服务（对话 + 工具调用）
│   ├── canvas-agent.service.ts  # Canvas AI 布局生成服务
│   ├── nanoleaf-api.service.ts  # Nanoleaf REST API 客户端
│   ├── nanoleaf-auth.service.ts # Nanoleaf 认证服务
│   ├── device.service.ts    # 设备生命周期管理
│   ├── discovery.service.ts # SSDP + IP 扫描发现服务
│   ├── design.service.ts    # Canvas 布局 CRUD
│   ├── skill.service.ts     # Skill CRUD
│   ├── skill-executor.ts    # Skill 执行引擎
│   ├── color-converter.ts   # RGB/HSB/HEX 色彩转换
│   ├── storage.ts           # JSON 文件持久化存储
│   ├── preload.ts           # contextBridge 预加载脚本
│   ├── llm/                 # LLM 适配器层
│   │   ├── types.ts         # LLMAdapter 接口定义
│   │   ├── openai.adapter.ts    # OpenAI 兼容 API 适配器
│   │   └── ollama.adapter.ts    # Ollama 本地模型适配器
│   └── tools/               # Agent 工具定义
│       ├── control.tools.ts # 控制类工具
│       ├── query.tools.ts   # 查询类工具
│       ├── effect.tools.ts  # 特效管理工具
│       ├── skill.tools.ts   # Skill 创建工具
│       └── index.ts         # 工具聚合导出
├── renderer/                # Electron 渲染进程 (React + MUI)
│   ├── main.tsx             # React 入口
│   ├── App.tsx              # 根布局（侧边栏 + 内容区 + 状态栏）
│   ├── theme.ts             # MUI 主题配置
│   ├── api.ts               # IPC 调用封装层
│   ├── components/          # UI 组件
│   │   ├── ControlPanel.tsx       # 设备控制面板
│   │   ├── DeviceConnector.tsx    # 设备连接管理
│   │   ├── DeviceSettings.tsx     # 设备设置
│   │   ├── BasicControls.tsx      # 基础控制组件
│   │   ├── ColorPanel.tsx         # 颜色选择器
│   │   ├── ColorBar.tsx           # 颜色条
│   │   ├── EffectList.tsx         # 特效列表
│   │   ├── EffectCard.tsx         # 特效卡片
│   │   ├── SkillLibrary.tsx       # Skill 库
│   │   ├── SkillEditor.tsx        # Skill 编辑器
│   │   ├── SkillCard.tsx          # Skill 卡片
│   │   ├── AgentChat.tsx          # AI 对话界面
│   │   ├── ChatWindow.tsx         # 聊天窗口
│   │   ├── ChatInput.tsx          # 聊天输入
│   │   ├── SessionManager.tsx     # 会话管理器
│   │   ├── QuickCommands.tsx      # 快捷指令
│   │   ├── MarkdownContent.tsx    # Markdown 渲染
│   │   ├── AuthDialog.tsx         # 认证对话框
│   │   ├── SettingsPage.tsx       # 设置页面
│   │   ├── LLMSettings.tsx        # LLM 配置
│   │   ├── Sidebar.tsx            # 侧边导航
│   │   ├── StatusBar.tsx          # 底部状态栏
│   │   ├── CanvasPage.tsx         # 画板页面
│   │   ├── CanvasStage.tsx        # Konva 画布舞台
│   │   ├── CanvasGrid.tsx         # 背景网格
│   │   ├── CanvasToolbar.tsx      # 画板工具栏
│   │   ├── CanvasShapePanel.tsx   # 面板类型选择
│   │   ├── CanvasAIDialog.tsx     # AI 生成布局对话框
│   │   └── SimEffectPanel.tsx     # 特效模拟面板
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useCanvasDesign.ts     # Canvas 状态管理
│   │   ├── useChat.ts             # 对话状态管理
│   │   ├── useDevices.ts          # 设备状态管理
│   │   └── useSkills.ts           # Skill 状态管理
│   └── simulation/          # 灯效模拟引擎
│       ├── SimulationEngine.ts    # 模拟引擎核心
│       ├── PanelGraph.ts          # 面板邻接图
│       ├── color-utils.ts         # 颜色工具函数
│       ├── types.ts               # 类型定义
│       └── engines/               # 六种特效引擎实现
│           ├── flow.engine.ts
│           ├── wheel.engine.ts
│           ├── explode.engine.ts
│           ├── fade.engine.ts
│           ├── random.engine.ts
│           └── highlight.engine.ts
└── shared/                  # 主进程和渲染进程共享
    ├── types.ts             # IPC 通道名、类型定义
    └── canvas-types.ts      # Canvas 布局类型定义
    └── panelGeometry.ts     # 面板几何计算工具
```

---

## 快速开始

### 前置条件

- Node.js >= 18
- npm >= 9

### 安装

```bash
git clone <repository-url>
cd LED_Control
npm install
```

### 开发

```bash
npm run dev
```

启动 Electron 开发模式，渲染进程由 Vite 热更新。

### 构建

```bash
npm run build
```

### 预览

```bash
npm run preview
```

---

## 使用指南

### 连接设备

1. 应用启动后，点击侧边栏的 **控制** 页面
2. 点击 **发现设备** 自动扫描局域网 Nanoleaf 设备
3. 选择设备，按下 Nanoleaf 面板上的电源按钮（5-10秒）进行认证
4. 认证成功后即可控制设备

### 使用 AI 助手

1. 进入 **Agent** 页面
2. 首先在 **设置** 页面配置 LLM API（支持 OpenAI 或 Ollama）
3. 输入自然语言指令，例如：
   - "把客厅的灯调成暖黄色"
   - "创建一个彩虹渐变的特效"
   - "帮我设计一个五角星形状的面板布局"

### 设计面板布局

1. 进入 **画板** 页面，默认处于编辑模式
2. 从左侧方案列表点击 **+** 创建新方案，或点击已有方案加载
3. 使用工具栏操作：

#### 🔧 编辑模式操作

| 操作 | 方式 |
|------|------|
| **切换工具** | 工具栏选择模式：选择（🖱）、六边形（⬡）、三角形（△）、迷你三角形（▽） |
| **放置面板** | 选中面板类型后，在画布空白处点击即可放置，放置后自动切回选择模式 |
| **拖拽移动** | 选中面板后拖拽移动，靠近其他面板时自动吸附对齐 |
| **选择面板** | 点击选择单个面板，Shift+点击多选，Ctrl+A 全选 |
| **修改颜色** | 选中面板后，右下角颜色选择器修改当前选中面板颜色 |
| **旋转面板** | 选中面板后，点击面板中心的绿色圆形旋转手柄（每次旋转 30°） |
| **删除面板** | 选中后按 Delete/Backspace，或点击工具栏删除按钮 |
| **撤销操作** | Ctrl+Z 撤销上一步操作 |
| **保存方案** | Ctrl+S 保存当前方案，或点击工具栏保存按钮 |
| **缩放画布** | 鼠标滚轮缩放画布 |
| **平移画布** | 按住空格键 + 鼠标拖拽，或鼠标中键拖拽平移画布 |
| **重置视图** | 按 `G` 键重置画布缩放和位置 |
| **重命名方案** | 在左侧方案列表中双击方案名称 |
| **AI 生成** | 点击工具栏 AI 按钮（✨），输入描述或上传参考图，自动生成面板布局 |
| **导出图片** | 点击工具栏导出按钮，将当前布局导出为 PNG |

#### ⌨️ 快捷键汇总

| 快捷键 | 功能 |
|--------|------|
| `1` | 切换至六边形工具 |
| `2` | 切换至三角形工具 |
| `3` | 切换至迷你三角形工具 |
| `V` | 切换至选择工具 |
| `Delete` / `Backspace` | 删除选中面板 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+A` | 全选 |
| `Ctrl+S` | 保存方案 |
| `G` | 重置画布视图 |
| `Tab` | 切换编辑/模拟模式 |
| `Space` + 拖拽 | 平移画布 |

### 使用灯效模拟

1. 在画板页面点击工具栏 **仿真模式** 按钮（▶）切换到模拟模式
2. 右侧面板显示已保存的 Skill 灯效列表
3. 点击灯效卡片上的 **播放** 按钮，在布局上实时预览灯效动画
4. 支持多种特效引擎：流动（Flow）、色轮（Wheel）、爆炸（Explode）、渐变（Fade）、随机闪烁（Random）、高亮（Highlight），每种引擎展现不同的颜色传播和动画效果
5. 模拟模式下面板显示发光效果（阴影光晕），更接近真实灯效
6. 点击 **停止** 结束预览，切换回编辑模式自动停止模拟

---

## 配置

### LLM 配置

在 **设置 → LLM 配置** 中：

| 参数 | 说明 |
|------|------|
| 供应商 | OpenAI / Ollama |
| API 地址 | 兼容 OpenAI 的 API 端点 |
| API 密钥 | API 认证密钥 |
| 模型 | 使用的模型名称 |

### 数据存储

- **设备配置** — `{userData}/data/devices.json`
- **Skills** — `{userData}/data/skills/*.json`
- **Canvas 设计** — `{projectRoot}/designs/*.json`
- **聊天历史** — `{userData}/data/sessions.json`
- **LLM 配置** — `{userData}/data/llm-config.json`
- **应用设置** — `{userData}/data/settings.json`

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Electron 30, React 19 |
| UI | MUI 9 (Material-UI), Emotion |
| 画布 | Konva.js, react-konva |
| 构建 | electron-vite, Vite, TypeScript 6 |
| LLM | OpenAI API, Ollama |
| 设备通信 | Nanoleaf REST API (HTTP), SSDP (UDP) |

---

## 软件许可

ISC License
