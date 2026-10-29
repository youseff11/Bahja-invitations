import type { ImageRow } from '../types'

/**
 * النسخ الزيادة القابلة للمسح اليدوي: من كل مجموعة متطابقة نسيب صورة واحدة — المستخدمة لو فيه
 * (وكل المستخدمة بتفضل)، وإلا الأقدم — ونحدّد الباقي. المستخدمة مابتتحدّدش أبداً.
 */
export function extraCopies(rows: ImageRow[]): number[] {
  const groups = new Map<string, ImageRow[]>()
  for (const row of rows) {
    if (row.dupGroup) groups.set(row.dupGroup, [...(groups.get(row.dupGroup) ?? []), row])
  }
  const picked: number[] = []
  for (const members of groups.values()) {
    const anyUsed = members.some((m) => m.used)
    const keep = anyUsed ? null : members.reduce((a, b) => (a.id < b.id ? a : b)).id
    for (const member of members) if (!member.used && member.id !== keep) picked.push(member.id)
  }
  return picked
}
