import * as nanoleafApi from '../nanoleaf-api.service'
import type { ToolDef } from '../llm/types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

export const effectToolDefs: ToolDef[] = [
  {
    name: 'listEffects',
    description: '列出设备上所有已保存的特效',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getCurrentEffect',
    description: '查看设备当前正在运行的特效名称',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'selectEffect',
    description: '切换到指定名称的已保存特效',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '特效名称，必须与设备上的名称完全匹配' }
      },
      required: ['name']
    }
  },
  {
    name: 'deleteEffect',
    description: '从设备上删除指定特效',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '要删除的特效名称' }
      },
      required: ['name']
    }
  },
  {
    name: 'renameEffect',
    description: '重命名设备上的特效',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '当前特效名称' },
        newName: { type: 'string', description: '新名称' }
      },
      required: ['name', 'newName']
    }
  }
]

export const effectExecutors: Record<string, ToolExecutor> = {
  listEffects: async () => { return nanoleafApi.getEffectsList() },
  getCurrentEffect: async () => {
    const info = await nanoleafApi.getDeviceInfo()
    return { currentEffect: info.state.colorMode === 'effect' ? '（请从特效列表查看当前运行的特效名）' : '非特效模式' }
  },
  selectEffect: async (args) => { await nanoleafApi.setEffect(args.name as string); return { success: true } },
  deleteEffect: async (args) => { await nanoleafApi.deleteEffect(args.name as string); return { success: true } },
  renameEffect: async (args) => {
    await nanoleafApi.sendRequest('PUT', '/effects', {
      write: { command: 'rename', animName: args.name as string, newName: args.newName as string }
    })
    return { success: true }
  }
}
