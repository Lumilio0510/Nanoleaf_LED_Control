import type { DeviceConfig, DeviceState, DiscoveredDevice, EffectInfo, Skill, ChatSession, ChatMessage, QuickCommand, LLMConfig } from './types'

declare global {
  interface Window {
    electronAPI: {
      scanNetwork: () => Promise<DiscoveredDevice[]>
      connect: (deviceId: string) => Promise<DeviceState>
      disconnect: () => Promise<DeviceState>
      getDevices: () => Promise<DeviceConfig[]>
      addDevice: (config: DeviceConfig) => Promise<DeviceConfig[]>
      removeDevice: (id: string) => Promise<DeviceConfig[]>
      getDeviceStatus: () => Promise<DeviceState>
      onDeviceStatusChange: (cb: (state: DeviceState) => void) => () => void
      switchLight: (on: boolean) => Promise<void>
      setBrightness: (value: number) => Promise<void>
      setColor: (r: number, g: number, b: number) => Promise<void>
      applyEffect: (effectId: string, params: Record<string, unknown>) => Promise<void>
      getEffectList: () => Promise<EffectInfo[]>
      getSkills: () => Promise<Skill[]>
      getSkill: (id: string) => Promise<Skill | null>
      saveSkill: (skill: Skill) => Promise<Skill[]>
      deleteSkill: (id: string) => Promise<Skill[]>
      executeSkill: (skillId: string, params: Record<string, unknown>) => Promise<void>
      chat: (sessionId: string, message: string) => Promise<ChatMessage>
      chatStream: (sessionId: string, message: string) => void
      onStreamChunk: (cb: (chunk: string) => void) => () => void
      quickCommand: (commandId: string) => void
      listCommands: () => Promise<QuickCommand[]>
      getSessions: () => Promise<ChatSession[]>
      getSession: (id: string) => Promise<ChatSession | null>
      createSession: () => Promise<ChatSession>
      deleteSession: (id: string) => Promise<void>
      getSettings: () => Promise<Record<string, unknown>>
      saveSettings: (settings: Record<string, unknown>) => Promise<void>
      getLlmConfig: () => Promise<LLMConfig>
      saveLlmConfig: (config: LLMConfig) => Promise<void>
    }
  }
}

export const api = {
  scanNetwork: () => window.electronAPI.scanNetwork(),
  connect: (deviceId: string) => window.electronAPI.connect(deviceId),
  disconnect: () => window.electronAPI.disconnect(),
  getDevices: () => window.electronAPI.getDevices(),
  addDevice: (config: DeviceConfig) => window.electronAPI.addDevice(config),
  removeDevice: (id: string) => window.electronAPI.removeDevice(id),
  getDeviceStatus: () => window.electronAPI.getDeviceStatus(),
  onDeviceStatusChange: (cb: (state: DeviceState) => void) => window.electronAPI.onDeviceStatusChange(cb),
  switchLight: (on: boolean) => window.electronAPI.switchLight(on),
  setBrightness: (value: number) => window.electronAPI.setBrightness(value),
  setColor: (r: number, g: number, b: number) => window.electronAPI.setColor(r, g, b),
  applyEffect: (effectId: string, params: Record<string, unknown>) => window.electronAPI.applyEffect(effectId, params),
  getEffectList: () => window.electronAPI.getEffectList(),
  getSkills: () => window.electronAPI.getSkills(),
  saveSkill: (skill: Skill) => window.electronAPI.saveSkill(skill),
  deleteSkill: (id: string) => window.electronAPI.deleteSkill(id),
  executeSkill: (skillId: string, params: Record<string, unknown>) => window.electronAPI.executeSkill(skillId, params),
  chat: (sessionId: string, message: string) => window.electronAPI.chat(sessionId, message),
  chatStream: (sessionId: string, message: string) => window.electronAPI.chatStream(sessionId, message),
  onStreamChunk: (cb: (chunk: string) => void) => window.electronAPI.onStreamChunk(cb),
  quickCommand: (commandId: string) => window.electronAPI.quickCommand(commandId),
  listCommands: () => window.electronAPI.listCommands(),
  getSessions: () => window.electronAPI.getSessions(),
  getSession: (id: string) => window.electronAPI.getSession(id),
  createSession: () => window.electronAPI.createSession(),
  deleteSession: (id: string) => window.electronAPI.deleteSession(id),
  getSettings: () => window.electronAPI.getSettings(),
  saveSettings: (settings: Record<string, unknown>) => window.electronAPI.saveSettings(settings),
  getLlmConfig: () => window.electronAPI.getLlmConfig(),
  saveLlmConfig: (config: LLMConfig) => window.electronAPI.saveLlmConfig(config),
}
