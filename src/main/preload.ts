import { contextBridge, ipcRenderer } from 'electron'
import { IPC, DeviceConfig, DeviceState, DiscoveredDevice, EffectInfo, Skill, ChatMessage, ChatSession, QuickCommand, LLMConfig } from '../shared/types'

const api = {
  // ======== 设备 ========
  scanNetwork: (): Promise<DiscoveredDevice[]> => ipcRenderer.invoke(IPC.DEVICE_SCAN),
  connect: (deviceId: string): Promise<DeviceState> => ipcRenderer.invoke(IPC.DEVICE_CONNECT, deviceId),
  disconnect: (): Promise<DeviceState> => ipcRenderer.invoke(IPC.DEVICE_DISCONNECT),
  getDevices: (): Promise<DeviceConfig[]> => ipcRenderer.invoke(IPC.DEVICE_LIST),
  addDevice: (config: DeviceConfig): Promise<DeviceConfig[]> => ipcRenderer.invoke(IPC.DEVICE_ADD, config),
  removeDevice: (id: string): Promise<DeviceConfig[]> => ipcRenderer.invoke(IPC.DEVICE_REMOVE, id),
  getDeviceStatus: (): Promise<DeviceState> => ipcRenderer.invoke(IPC.DEVICE_STATUS),
  onDeviceStatusChange: (cb: (state: DeviceState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: DeviceState) => cb(state)
    ipcRenderer.on(IPC.DEVICE_ON_STATUS_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC.DEVICE_ON_STATUS_CHANGE, handler)
  },

  // ======== 灯效控制 ========
  switchLight: (on: boolean): Promise<void> => ipcRenderer.invoke(IPC.CONTROL_SWITCH, on),
  setBrightness: (value: number): Promise<void> => ipcRenderer.invoke(IPC.CONTROL_BRIGHTNESS, value),
  setColor: (r: number, g: number, b: number): Promise<void> => ipcRenderer.invoke(IPC.CONTROL_COLOR, r, g, b),
  applyEffect: (effectId: string, params: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke(IPC.CONTROL_APPLY_EFFECT, effectId, params),
  getEffectList: (): Promise<EffectInfo[]> => ipcRenderer.invoke(IPC.CONTROL_EFFECT_LIST),

  // ======== Skill ========
  getSkills: (): Promise<Skill[]> => ipcRenderer.invoke(IPC.SKILL_LIST),
  getSkill: (id: string): Promise<Skill | null> => ipcRenderer.invoke(IPC.SKILL_GET, id),
  saveSkill: (skill: Skill): Promise<Skill[]> => ipcRenderer.invoke(IPC.SKILL_SAVE, skill),
  deleteSkill: (id: string): Promise<Skill[]> => ipcRenderer.invoke(IPC.SKILL_DELETE, id),
  executeSkill: (skillId: string, params: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke(IPC.SKILL_EXECUTE, skillId, params),

  // ======== Agent ========
  chat: (sessionId: string, message: string): Promise<ChatMessage> =>
    ipcRenderer.invoke(IPC.AGENT_CHAT, sessionId, message),
  chatStream: (sessionId: string, message: string) => {
    ipcRenderer.send(IPC.AGENT_CHAT_STREAM, sessionId, message)
  },
  onStreamChunk: (cb: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => cb(chunk)
    ipcRenderer.on(IPC.AGENT_ON_STREAM_CHUNK, handler)
    return () => ipcRenderer.removeListener(IPC.AGENT_ON_STREAM_CHUNK, handler)
  },
  quickCommand: (commandId: string) => {
    ipcRenderer.send(IPC.AGENT_QUICK_COMMAND, commandId)
  },
  listCommands: (): Promise<QuickCommand[]> => ipcRenderer.invoke(IPC.AGENT_LIST_COMMANDS),

  // ======== 聊天历史 ========
  getSessions: (): Promise<ChatSession[]> => ipcRenderer.invoke(IPC.CHAT_SESSION_LIST),
  getSession: (id: string): Promise<ChatSession | null> => ipcRenderer.invoke(IPC.CHAT_SESSION_GET, id),
  createSession: (): Promise<ChatSession> => ipcRenderer.invoke(IPC.CHAT_SESSION_CREATE),
  deleteSession: (id: string): Promise<void> => ipcRenderer.invoke(IPC.CHAT_SESSION_DELETE, id),

  // ======== 设置 ========
  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  saveSettings: (settings: Record<string, unknown>): Promise<void> => ipcRenderer.invoke(IPC.SETTINGS_SAVE, settings),
  getLlmConfig: (): Promise<LLMConfig> => ipcRenderer.invoke(IPC.SETTINGS_GET_LLM),
  saveLlmConfig: (config: LLMConfig): Promise<void> => ipcRenderer.invoke(IPC.SETTINGS_SAVE_LLM, config),
}

contextBridge.exposeInMainWorld('electronAPI', api)
