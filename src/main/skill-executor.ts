import { Skill } from '../shared/types'
import { sendRequest } from './nanoleaf-api.service'

export function resolveParams(skill: Skill, values: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const param of skill.params) {
    result[param.key] = values[param.key] ?? param.default
  }
  return result
}

export function buildRequestBody(mapping: Skill['mapping'], resolvedParams: Record<string, unknown>): Record<string, unknown> {
  const template = JSON.stringify(mapping.bodyTemplate)
  const rendered = template.replace(/\{\{params\.(\w+)\}\}/g, (_, key: string) => {
    const val = resolvedParams[key]
    return val !== undefined ? JSON.stringify(val).replace(/^"|"$/g, '') : ''
  })
  return JSON.parse(rendered) as Record<string, unknown>
}

export function parseEndpoint(mapping: Skill['mapping']): { method: string; path: string } {
  const parts = mapping.endpoint.split(' ')
  return { method: parts[0], path: parts[1] }
}

export async function executeSkill(skillId: string, getSkillFn: (id: string) => Skill | null, values: Record<string, unknown>): Promise<void> {
  const skill = getSkillFn(skillId)
  if (!skill) throw new Error(`Skill 不存在: ${skillId}`)
  const resolved = resolveParams(skill, values)
  const body = buildRequestBody(skill.mapping, resolved)
  const { method, path } = parseEndpoint(skill.mapping)
  await sendRequest(method, path, body)
}
