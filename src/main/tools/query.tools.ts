import * as nanoleafApi from '../nanoleaf-api.service'
import type { ToolDef } from '../llm/types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

export const queryToolDefs: ToolDef[] = [
  {
    name: 'getDeviceInfo',
    description: '获取当前连接设备完整信息：名称、型号、序列号、固件版本',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getDeviceState',
    description: '获取当前设备状态：开关、亮度、色相、饱和度、色温、当前颜色模式',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getPanelLayout',
    description: '获取面板物理布局数据：面板数量、位置坐标、形状类型',
    parameters: { type: 'object', properties: {}, required: [] }
  }
]

export const queryExecutors: Record<string, ToolExecutor> = {
  getDeviceInfo: async () => { return nanoleafApi.getDeviceInfo() },
  getDeviceState: async () => {
    const info = await nanoleafApi.getDeviceInfo()
    return {
      on: info.state.on.value,
      brightness: info.state.brightness.value,
      hue: info.state.hue.value,
      saturation: info.state.sat.value,
      colorTemp: info.state.ct.value,
      colorMode: info.state.colorMode
    }
  },
  getPanelLayout: async () => { return nanoleafApi.getPanelLayout() }
}
