import electron from 'electron'
const { ipcMain, BrowserWindow } = electron
import { IPC } from '../shared/types'
import * as deviceService from './device.service'
import * as nanoleafApi from './nanoleaf-api.service'
import * as skillService from './skill.service'
import { executeSkill } from './skill-executor'
import * as agentService from './agent.service'
import { readJSON, writeJSON } from './storage'
import { rgbToHsb } from './color-converter'
import type { LLMConfig } from '../shared/types'

export function registerHandlers() {
  // ======== 设备 ========
  ipcMain.handle(IPC.DEVICE_SCAN, async () => {
    const raw = await deviceService.scanNetwork()
    return deviceService.crossReferenceScan(raw)
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

  ipcMain.handle(IPC.DEVICE_RENAME, async (_event, id: string, newName: string) => {
    return deviceService.renameDevice(id, newName)
  })

  ipcMain.handle(IPC.DEVICE_STATUS, async () => {
    return deviceService.getDeviceStatus()
  })

  ipcMain.handle(IPC.DEVICE_AUTHENTICATE, async (_event, deviceId: string) => {
    return deviceService.authenticateDevice(deviceId)
  })

  ipcMain.handle(IPC.DEVICE_IDENTIFY, async () => {
    await deviceService.identifyDevice()
  })

  ipcMain.handle(IPC.DEVICE_GET_LOCAL_IP, async () => {
    return deviceService.getLocalIP()
  })

  ipcMain.handle(IPC.DEVICE_PING_ALL, async () => {
    return deviceService.pingAllDevices()
  })

  ipcMain.handle(IPC.DEVICE_ONLINE_STATUS, async () => {
    return deviceService.getOnlineStatus()
  })

  // 设备状态有变化时，广播到所有窗口
  deviceService.onStatusChange((state) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send(IPC.DEVICE_ON_STATUS_CHANGE, state)
    })
  })

  // 设备在线状态变化时，广播到所有窗口
  deviceService.onOnlineChange((deviceId, online) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send(IPC.DEVICE_ON_ONLINE_CHANGE, { deviceId, online })
    })
  })

  // ======== 灯效控制 ========
  ipcMain.handle(IPC.CONTROL_SWITCH, async (_event, on: boolean) => {
    await nanoleafApi.setPower(on)
  })

  ipcMain.handle(IPC.CONTROL_BRIGHTNESS, async (_event, value: number) => {
    await nanoleafApi.setBrightness(value)
  })

  ipcMain.handle(IPC.CONTROL_COLOR, async (_event, r: number, g: number, b: number) => {
    const hsb = rgbToHsb(r, g, b)
    await nanoleafApi.setHSB(hsb.h, hsb.s, hsb.b)
  })

  ipcMain.handle(IPC.CONTROL_CT, async (_event, value: number) => {
    await nanoleafApi.setColorTemperature(value)
  })

  ipcMain.handle(IPC.CONTROL_APPLY_EFFECT, async (_event, effectId: string, _params: Record<string, unknown>) => {
    await nanoleafApi.setEffect(effectId)
  })

  ipcMain.handle(IPC.CONTROL_WRITE_EFFECT, async (_event, effectDef: Record<string, unknown>) => {
    await nanoleafApi.sendRequest('PUT', '/effects', { write: effectDef })
  })

  ipcMain.handle(IPC.CONTROL_EFFECT_LIST, async () => {
    return nanoleafApi.getEffectsList()
  })

  ipcMain.handle(IPC.CONTROL_EFFECT_DETAILS, async () => {
    return nanoleafApi.getEffectDetails()
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
      (_msg) => {
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
        (_msg) => {
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
