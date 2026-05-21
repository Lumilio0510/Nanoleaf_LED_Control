import * as nanoleafApi from '../nanoleaf-api.service'
import { discoverDevices } from '../discovery.service'
import type { ToolDef } from '../llm/types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

export const controlToolDefs: ToolDef[] = [
  {
    name: 'setPower',
    description: '开关 Nanoleaf 设备灯光',
    parameters: {
      type: 'object',
      properties: {
        on: { type: 'boolean', description: 'true 为开灯，false 为关灯' }
      },
      required: ['on']
    }
  },
  {
    name: 'setBrightness',
    description: '调节亮度，可指定渐变秒数实现平滑过渡',
    parameters: {
      type: 'object',
      properties: {
        value: { type: 'number', description: '亮度值 0-100', minimum: 0, maximum: 100 },
        duration: { type: 'number', description: '渐变持续的秒数，0 为立即切换' }
      },
      required: ['value']
    }
  },
  {
    name: 'setColor',
    description: '设置 HSB 颜色（色相/饱和度/亮度）。饱和度为 0 时显示白色',
    parameters: {
      type: 'object',
      properties: {
        hue: { type: 'number', description: '色相 0-360', minimum: 0, maximum: 360 },
        saturation: { type: 'number', description: '饱和度 0-100', minimum: 0, maximum: 100 },
        brightness: { type: 'number', description: '亮度 0-100，可选', minimum: 0, maximum: 100 }
      },
      required: ['hue', 'saturation']
    }
  },
  {
    name: 'setColorTemp',
    description: '设置色温（Kelvin 白平衡）。低值为暖光，高值为冷光',
    parameters: {
      type: 'object',
      properties: {
        value: { type: 'number', description: '色温值 1200-6500K', minimum: 1200, maximum: 6500 }
      },
      required: ['value']
    }
  },
  {
    name: 'identifyDevice',
    description: '使当前连接的设备闪烁，用于在多个设备中识别',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'discoverDevices',
    description: '扫描局域网发现新的 Nanoleaf 设备',
    parameters: { type: 'object', properties: {}, required: [] }
  }
]

export const controlExecutors: Record<string, ToolExecutor> = {
  setPower: async (args) => { await nanoleafApi.setPower(args.on as boolean); return { success: true } },
  setBrightness: async (args) => {
    await nanoleafApi.setBrightness(args.value as number, args.duration as number | undefined)
    return { success: true }
  },
  setColor: async (args) => {
    await nanoleafApi.setHSB(args.hue as number, args.saturation as number, (args.brightness ?? 100) as number)
    return { success: true }
  },
  setColorTemp: async (args) => {
    await nanoleafApi.setColorTemperature(args.value as number)
    return { success: true }
  },
  identifyDevice: async () => { await nanoleafApi.identify(); return { success: true } },
  discoverDevices: async () => { return discoverDevices() }
}
