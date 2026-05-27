import * as nanoleafApi from '../nanoleaf-api.service'
import { normalizeEffectDef } from '../nanoleaf-api.service'
import * as skillService from '../skill.service'
import { randomUUID } from 'crypto'
import type { ToolDef } from '../llm/types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

const PLUGIN_UUIDS: Record<string, string> = {
  flow: '027842e4-e1d6-4a4c-a731-be74a1ebd4cf',
  wheel: '6970681a-20b5-4c5e-8813-bdaebc4ee4fa',
  explode: '713518c1-d560-47db-8991-de780af71d1e',
  fade: 'b3fd723a-aae8-4c99-bf2b-087159e0ef53',
  random: 'ba632d3e-9c2b-4413-a965-510c839b3f71',
  highlight: '70b7c636-6bf8-491f-89c1-f4103508d642'
}

const pluginUuidDesc = Object.entries(PLUGIN_UUIDS).map(([k, v]) => `${k}: ${v}`).join(', ')

export const skillToolDefs: ToolDef[] = [
  {
    name: 'createEffect',
    description: `创建/更新一个 Nanoleaf 灯效并保存到 Skill 库。支持三种类型：
1. plugin（动态特效）：使用内置插件如 Flow/Wheel/Random 等，需提供 pluginUuid、pluginType、pluginOptions、palette
2. static（静态布局）：每面板独立颜色，需提供 animData 字符串
3. solid（纯色）：最简单的统一纯色，只需一个 palette 颜色
已知 pluginUuid 和对应名称：${pluginUuidDesc}`,
    parameters: {
      type: 'object',
      properties: {
        effectDefinition: {
          type: 'object',
          description: '完整的 Nanoleaf effect JSON，command 固定为 "add"，version 固定为 "2.0"',
          properties: {
            command: { type: 'string', enum: ['add'] },
            animName: { type: 'string', description: '特效名称' },
            version: { type: 'string', enum: ['2.0'] },
            animType: { type: 'string', enum: ['plugin', 'static', 'solid'] },
            colorType: { type: 'string', enum: ['HSB'] }
          },
          required: ['command', 'animName', 'animType', 'colorType']
        }
      },
      required: ['effectDefinition']
    }
  },
  {
    name: 'previewEffect',
    description: '临时预览灯效，不保存到设备上。duration 秒后自动恢复到之前状态',
    parameters: {
      type: 'object',
      properties: {
        effectDefinition: {
          type: 'object',
          description: '完整的 Nanoleaf effect JSON，不含 command 字段（自动使用 display）'
        },
        duration: { type: 'number', description: '预览持续秒数，默认 10', minimum: 1, maximum: 300 }
      },
      required: ['effectDefinition']
    }
  }
]

export const skillExecutors: Record<string, ToolExecutor> = {
  createEffect: async (args) => {
    const def = normalizeEffectDef(args.effectDefinition as Record<string, unknown>)
    const writePayload: Record<string, unknown> = { command: 'add', ...def }
    await nanoleafApi.sendRequest('PUT', '/effects', { write: writePayload })

    const skillId = randomUUID()
    const pluginName = typeof def.pluginUuid === 'string' ? PLUGIN_UUIDS[def.pluginUuid] : undefined
    const skill = {
      meta: {
        id: skillId,
        name: def.animName as string,
        description: `由 AI 生成的 ${def.animType} 灯效${pluginName ? ` (${pluginName})` : ''}`,
        tags: ['AI生成'],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      params: [] as { key: string; label: string; type: string; default: unknown }[],
      mapping: {
        endpoint: 'PUT /effects',
        bodyTemplate: { write: writePayload }
      }
    }
    skillService.saveSkill(skill)
    return { skillId: skill.meta.id, skillName: skill.meta.name, effectDef: def, pluginName: pluginName || null }
  },
  previewEffect: async (args) => {
    const def = normalizeEffectDef(args.effectDefinition as Record<string, unknown>)
    const duration = (args.duration as number) || 10
    const displayPayload: Record<string, unknown> = { command: 'display', duration, version: '2.0', ...def }
    await nanoleafApi.sendRequest('PUT', '/effects', { write: displayPayload })
    return { success: true, duration }
  }
}
