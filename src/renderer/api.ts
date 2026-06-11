import type { DeviceConfig, DeviceState, DiscoveredDevice, EffectInfo, EffectDetail, Skill, ChatSession, ChatMessage, QuickCommand, LLMConfig, ToolCallRecord } from './types'
import type { CanvasDesign } from '../shared/canvas-types'

declare global {
  interface Window {
    electronAPI: {
      scanNetwork: () => Promise<DiscoveredDevice[]>
      connect: (deviceId: string) => Promise<DeviceState>
      disconnect: () => Promise<DeviceState>
      getDevices: () => Promise<DeviceConfig[]>
      addDevice: (config: DeviceConfig) => Promise<DeviceConfig[]>
      removeDevice: (id: string) => Promise<DeviceConfig[]>
      renameDevice: (id: string, newName: string) => Promise<DeviceConfig[]>
      getDeviceStatus: () => Promise<DeviceState>
      onDeviceStatusChange: (cb: (state: DeviceState) => void) => () => void
      authenticate: (deviceId: string) => Promise<string>
      identify: () => Promise<void>
      getLocalIP: () => Promise<string>
      pingAllDevices: () => Promise<Record<string, boolean>>
      getOnlineStatus: () => Promise<Record<string, boolean>>
      onOnlineChange: (cb: (data: { deviceId: string; online: boolean }) => void) => () => void
      switchLight: (on: boolean) => Promise<void>
      setBrightness: (value: number) => Promise<void>
      setColor: (r: number, g: number, b: number) => Promise<void>
      setColorTemperature: (value: number) => Promise<void>
      applyEffect: (effectId: string, params: Record<string, unknown>) => Promise<void>
      writeEffect: (effectDef: Record<string, unknown>) => Promise<void>
      getEffectList: () => Promise<EffectInfo[]>
      getEffectDetails: () => Promise<EffectDetail[]>
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
      // Canvas
      listDesigns: () => Promise<Array<{ id: string; name: string; updatedAt: string }>>
      loadDesign: (id: string) => Promise<CanvasDesign | null>
      saveDesign: (design: CanvasDesign) => Promise<{ id: string; name: string; updatedAt: string }>
      deleteDesign: (id: string) => Promise<void>
      exportDesignImage: (dataUrl: string) => Promise<string | null>
      renameDesign: (id: string, newName: string) => Promise<{ id: string; name: string; updatedAt: string }>
      aiGenerateDesign: (description: string, imageBase64?: string) => Promise<CanvasDesign>
      onAiGenerateProgress: (cb: (progress: unknown) => void) => () => void
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
  renameDevice: (id: string, newName: string) => window.electronAPI.renameDevice(id, newName),
  getDeviceStatus: () => window.electronAPI.getDeviceStatus(),
  onDeviceStatusChange: (cb: (state: DeviceState) => void) => window.electronAPI.onDeviceStatusChange(cb),
  authenticate: (deviceId: string) => window.electronAPI.authenticate(deviceId),
  identify: () => window.electronAPI.identify(),
  getLocalIP: () => window.electronAPI.getLocalIP(),
  pingAllDevices: () => window.electronAPI.pingAllDevices(),
  getOnlineStatus: () => window.electronAPI.getOnlineStatus(),
  onOnlineChange: (cb: (data: { deviceId: string; online: boolean }) => void) =>
    window.electronAPI.onOnlineChange(cb),
  switchLight: (on: boolean) => window.electronAPI.switchLight(on),
  setBrightness: (value: number) => window.electronAPI.setBrightness(value),
  setColor: (r: number, g: number, b: number) => window.electronAPI.setColor(r, g, b),
  setColorTemperature: (value: number) => window.electronAPI.setColorTemperature(value),
  applyEffect: (effectId: string, params: Record<string, unknown>) => window.electronAPI.applyEffect(effectId, params),
  writeEffect: (effectDef: Record<string, unknown>) => window.electronAPI.writeEffect(effectDef),
  getEffectList: () => window.electronAPI.getEffectList(),
  getEffectDetails: () => window.electronAPI.getEffectDetails(),
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
  listDesigns: () => window.electronAPI.listDesigns(),
  loadDesign: (id: string) => window.electronAPI.loadDesign(id),
  saveDesign: (design: CanvasDesign) => window.electronAPI.saveDesign(design),
  deleteDesign: (id: string) => window.electronAPI.deleteDesign(id),
  exportDesignImage: (dataUrl: string) => window.electronAPI.exportDesignImage(dataUrl),
  renameDesign: (id: string, newName: string) => window.electronAPI.renameDesign(id, newName),
  aiGenerateDesign: (description: string, imageBase64?: string) => window.electronAPI.aiGenerateDesign(description, imageBase64) as Promise<CanvasDesign>,
  onAiGenerateProgress: (cb: (progress: unknown) => void) => window.electronAPI.onAiGenerateProgress(cb),
}
