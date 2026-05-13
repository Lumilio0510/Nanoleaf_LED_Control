import { contextBridge, ipcRenderer } from 'electron'
import { IPC, DeviceConfig, DeviceState, DiscoveredDevice, EffectInfo } from '../shared/types'

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
}

contextBridge.exposeInMainWorld('electronAPI', api)
