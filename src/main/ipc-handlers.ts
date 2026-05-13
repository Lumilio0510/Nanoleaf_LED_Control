import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../shared/types'
import * as deviceService from './device.service'
import * as ledApi from './led-api.service'
import * as skillService from './skill.service'
import { executeSkill } from './skill-executor'
import * as agentService from './agent.service'
import { readJSON, writeJSON } from './storage'
import type { LLMConfig } from '../shared/types'

export function registerHandlers() {
  // ======== 设备 ========
  ipcMain.handle(IPC.DEVICE_SCAN, async () => {
    return deviceService.scanNetwork()
  })

  ipcMain.handle(IPC.DEVICE_CONNECT, async (_event, deviceId: string) => {
    return deviceService.connect(deviceId)
  })

  ipcMain.handle(IPC.DEVICE_DISCONNECT, async () => {
    return deviceService.disconnect()
  })

  ipcMain.handle(IPC.DEVICE_LIST, async () => {
    return deviceService.getDevices()
  })

  ipcMain.handle(IPC.DEVICE_ADD, async (_event, config) => {
    return deviceService.addDevice(config)
  })

  ipcMain.handle(IPC.DEVICE_REMOVE, async (_event, id: string) => {
    return deviceService.removeDevice(id)
  })

  ipcMain.handle(IPC.DEVICE_STATUS, async () => {
    return deviceService.getDeviceStatus()
  })

  // 设备状态有变化时，广播到所有窗口
  deviceService.onStatusChange((state) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send(IPC.DEVICE_ON_STATUS_CHANGE, state)
    })
  })

  // ======== 灯效控制 ========
  ipcMain.handle(IPC.CONTROL_SWITCH, async (_event, on: boolean) => {
    await ledApi.switchLight(on)
  })

  ipcMain.handle(IPC.CONTROL_BRIGHTNESS, async (_event, value: number) => {
    await ledApi.setBrightness(value)
  })

  ipcMain.handle(IPC.CONTROL_COLOR, async (_event, r: number, g: number, b: number) => {
    await ledApi.setColor(r, g, b)
  })

  ipcMain.handle(IPC.CONTROL_APPLY_EFFECT, async (_event, effectId: string, params: Record<string, unknown>) => {
    await ledApi.applyEffect(effectId, params)
  })

  ipcMain.handle(IPC.CONTROL_EFFECT_LIST, async () => {
    return ledApi.getEffectList()
  })

  // ======== Skill ========
  ipcMain.handle(IPC.SKILL_LIST, async () => {
    return skillService.getSkills()
  })

  ipcMain.handle(IPC.SKILL_GET, async (_event, id: string) => {
    return skillService.getSkill(id)
  })

  ipcMain.handle(IPC.SKILL_SAVE, async (_event, skill: any) => {
    skillService.saveSkill(skill)
    return skillService.getSkills()
  })

  ipcMain.handle(IPC.SKILL_DELETE, async (_event, id: string) => {
    skillService.deleteSkill(id)
    return skillService.getSkills()
  })

  ipcMain.handle(IPC.SKILL_EXECUTE, async (_event, skillId: string, params: Record<string, unknown>) => {
    await executeSkill(skillId, skillService.getSkill, params)
  })

  ipcMain.handle(IPC.SKILL_EXPORT, async (_event, id: string) => {
    return skillService.exportSkill(id)
  })

  // ======== Agent ========
  ipcMain.handle(IPC.AGENT_CHAT, async (_event, sessionId: string, message: string) => {
    return agentService.chat(sessionId, message)
  })

  ipcMain.on(IPC.AGENT_CHAT_STREAM, (event, sessionId: string, message: string) => {
    agentService.chatStream(
      sessionId,
      message,
      (chunk) => event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, chunk),
      (msg) => {
        if (msg.skill) {
          skillService.saveSkill(msg.skill)
        }
        event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, '__DONE__')
      }
    )
  })

  ipcMain.handle(IPC.AGENT_LIST_COMMANDS, async () => {
    return agentService.getQuickCommands()
  })

  ipcMain.on(IPC.AGENT_QUICK_COMMAND, (event, commandId: string) => {
    const commands = agentService.getQuickCommands()
    const cmd = commands.find(c => c.id === commandId)
    if (cmd) {
      agentService.chatStream(
        'default',
        cmd.prompt,
        (chunk) => event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, chunk),
        (msg) => {
          if (msg.skill) skillService.saveSkill(msg.skill)
          event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, '__DONE__')
        }
      )
    }
  })

  // ======== 聊天历史 ========
  ipcMain.handle(IPC.CHAT_SESSION_LIST, async () => {
    return agentService.getSessions()
  })

  ipcMain.handle(IPC.CHAT_SESSION_GET, async (_event, id: string) => {
    return agentService.getSession(id)
  })

  ipcMain.handle(IPC.CHAT_SESSION_CREATE, async () => {
    return agentService.createSession()
  })

  ipcMain.handle(IPC.CHAT_SESSION_DELETE, async (_event, id: string) => {
    agentService.deleteSession(id)
  })

  // ======== 设置 ========
  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    return readJSON<Record<string, unknown>>('config.json', {})
  })

  ipcMain.handle(IPC.SETTINGS_SAVE, async (_event, settings: Record<string, unknown>) => {
    writeJSON('config.json', settings)
  })

  ipcMain.handle(IPC.SETTINGS_GET_LLM, async () => {
    return readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
  })

  ipcMain.handle(IPC.SETTINGS_SAVE_LLM, async (_event, config: LLMConfig) => {
    writeJSON('llm.json', config)
  })
}
