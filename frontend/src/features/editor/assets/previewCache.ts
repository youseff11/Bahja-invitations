import type { DocBlock, PreviewPayload } from '../types'
import { fetchFavoritePreview } from './api'

/**
 * كاش لحمولات معاينة المفضلة: المعاينة كانت بتتجاب من السيرفر في كل مرة الصف يتفتح،
 * فالصفحة كانت بتفضل «بتحمّل» في كل دخول. دلوقتي اللي اتجاب مرة بيظهر في نفس اللحظة.
 */
const MAX_ENTRIES = 80
const cache = new Map<string, PreviewPayload>()
const inflight = new Map<string, Promise<PreviewPayload>>()

export const standaloneKey = (block: DocBlock) => `standalone|${JSON.stringify(block)}`

export function cachedPreview(key: string): PreviewPayload | undefined {
  const hit = cache.get(key)
  if (hit) {
    // LRU: آخر مستخدم يروح في الآخر
    cache.delete(key)
    cache.set(key, hit)
  }
  return hit
}

export function rememberPreview(key: string, payload: PreviewPayload) {
  cache.delete(key)
  cache.set(key, payload)
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
}

/** معاينة قسم لوحده (صفحة المكتبة): من الكاش لو موجودة، وإلا بتتجاب مرة واحدة حتى لو اتطلبت من أكتر من مكان. */
export function loadStandalonePreview(block: DocBlock, signal?: AbortSignal): Promise<PreviewPayload> {
  const key = standaloneKey(block)
  const hit = cachedPreview(key)
  if (hit) return Promise.resolve(hit)
  let pending = inflight.get(key)
  if (!pending) {
    // من غير signal: الطلب مشترك، فإلغاء صف واحد ما يبوّظش الباقي
    pending = fetchFavoritePreview(block, '')
      .then((payload) => {
        rememberPreview(key, payload)
        return payload
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, pending)
  }
  if (!signal) return pending
  return new Promise<PreviewPayload>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'))
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    pending.then(resolve, reject)
  })
}

/** يسخّن معاينات أول عناصر المكتبة في الخلفية (٣ طلبات في نفس الوقت) قبل ما المستخدم يفتح الصفحة. */
export function warmFavoritePreviews(blocks: DocBlock[], limit = 12) {
  const queue = blocks.filter((b) => b && !cache.has(standaloneKey(b))).slice(0, limit)
  const worker = async () => {
    for (let block = queue.shift(); block; block = queue.shift()) {
      await loadStandalonePreview(block).catch(() => undefined)
    }
  }
  for (let i = 0; i < 3; i++) void worker()
}
