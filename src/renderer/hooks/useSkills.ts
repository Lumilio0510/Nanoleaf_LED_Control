import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { Skill } from '../types'

export function useSkills() {
 const [skills, setSkills] = useState<Skill[]>([])

 const refresh = useCallback(async () => {
 setSkills(await api.getSkills())
 }, [])

 useEffect(() => { refresh() }, [refresh])

 const saveSkill = useCallback(async (skill: Skill) => {
 const updated = await api.saveSkill(skill)
 setSkills(updated)
 }, [])

 const deleteSkill = useCallback(async (id: string) => {
 const updated = await api.deleteSkill(id)
 setSkills(updated)
 }, [])

 const execute = useCallback(async (skillId: string, params: Record<string, unknown>) => {
 await api.executeSkill(skillId, params)
 }, [])

 return { skills, refresh, saveSkill, deleteSkill, execute }
}
