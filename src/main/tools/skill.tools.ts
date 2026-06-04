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
    description: `创建灯效方案并保存到 Skill 库（不会写入设备）。支持三种类型：
1. plugin（动态特效）：使用内置插件如 Flow/Wheel/Random 等，需提供 pluginUuid、pluginType、pluginOptions（只放插件参数，包括 transTime、delayTime、direction、loop 等）、palette
2. static（静态布局）：每面板独立颜色，需提供 animData 字符串
3. solid（纯色）：最简单的统一纯色，只需一个 palette 颜色
已知 pluginUuid 和对应名称：${pluginUuidDesc}`,
    parameters: {
      type: 'object',
      properties: {
        effectDefinition: {
          type: 'object',
          description: '完整的 Nanoleaf effect JSON，command 固定为 "add"，version 固定为 "2.0"，loop 如需循环请在 pluginOptions 中设置',
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
  }
]

export const skillExecutors: Record<string, ToolExecutor> = {
  createEffect: async (args) => {
    const effectDef = args.effectDefinition as Record<string, unknown> | undefined
    if (!effectDef || typeof effectDef !== 'object' || !effectDef.animName) {
      throw new Error('createEffect 缺少有效的 effectDefinition 参数，请重新生成')
    }
    const def = normalizeEffectDef(effectDef)

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
        bodyTemplate: { write: { command: 'add', ...def } }
      }
    }
    skillService.saveSkill(skill)
    return { skillId: skill.meta.id, skillName: skill.meta.name, effectDef: def, pluginName: pluginName || null }
  }
}
