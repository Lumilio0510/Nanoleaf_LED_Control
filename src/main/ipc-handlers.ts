import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../shared/types'
import * as deviceService from './device.service'
import * as ledApi from './led-api.service'

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
}
