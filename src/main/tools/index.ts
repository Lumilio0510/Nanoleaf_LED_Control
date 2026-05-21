import type { ToolDef } from '../llm/types'
import { controlToolDefs, controlExecutors } from './control.tools'
import { queryToolDefs, queryExecutors } from './query.tools'
import { effectToolDefs, effectExecutors } from './effect.tools'
import { skillToolDefs, skillExecutors } from './skill.tools'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

export const allToolDefs: ToolDef[] = [
  ...controlToolDefs,
  ...queryToolDefs,
  ...effectToolDefs,
  ...skillToolDefs
]

const allExecutors: Record<string, ToolExecutor> = {
  ...controlExecutors,
  ...queryExecutors,
  ...effectExecutors,
  ...skillExecutors
}

export function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const exec = allExecutors[name]
  if (!exec) throw new Error(`未知工具: ${name}`)
  return exec(args)
}
