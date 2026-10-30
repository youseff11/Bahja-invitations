import { fetchRender } from './api'
import type { InviteLang, RenderPayload } from './types'

/**
 * تسخين معاينة القالب قبل الضغطة: الـchunk بتاع الصفحة والحمولة نفسها بيتجابوا أول ما
 * الزائر يقرّب من الزرار (hover / لمس / تركيز)، فالضغطة بتفتح المعاينة في نفس اللحظة.
 * الحمولة بتتاخد مرة واحدة وبتفوت بعد ‎TTL_MS‎ عشان تعديل المصمّم مايتأخرش عن الزائر.
 */
const TTL_MS = 30_000

const pending = new Map<string, { at: number; promise: Promise<RenderPayload> }>()

const keyOf = (slug: string, lang: InviteLang | '') => `${slug}|${lang}`

export function loadPreviewPage() {
  return import('./SpaTemplatePreview')
}

/** بيجيب الحمولة (أو بيرجّع اللي اتسخّن) — الفشل مابيتخزّنش. */
export function takePreview(slug: string, lang: InviteLang | ''): Promise<RenderPayload> {
  const key = keyOf(slug, lang)
  const hit = pending.get(key)
  pending.delete(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
  return fetchRender({ kind: 'template', slug }, lang)
}

export function warmPreview(slug: string) {
  void loadPreviewPage()
  const key = keyOf(slug, '')
  const hit = pending.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return
  const promise = fetchRender({ kind: 'template', slug }, '')
  promise.catch(() => pending.delete(key))
  pending.set(key, { at: Date.now(), promise })
}
