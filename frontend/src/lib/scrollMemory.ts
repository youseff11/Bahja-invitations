/**
 * ذاكرة مكان التمرير لكل خانة في تاريخ المتصفح (‎history.state.key‎ اللي React Router بيحطه):
 * لما الزائر يفتح معاينة قالب ويرجع بالسهم يلاقي الصفحة واقفة على نفس المكان.
 * التمرير بيتسجّل وقت الحدث نفسه (مش وقت الخروج) عشان أول ما الصفحة الجديدة تتعرض
 * وتتمرّر لفوق مايبوّظش المكان المحفوظ.
 */
const STORAGE_KEY = 'bahga:scroll'
const MAX_ENTRIES = 60
/** أقصى وقت ننتظر فيه المحتوى (البيانات بتيجي متأخرة) لحد ما الصفحة تطول كفاية */
const MAX_WAIT_MS = 4000
const USER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

function loadPersisted(): [string, number][] {
  try {
    // الرجوع بالسهم من صفحة بتتحمّل كاملة (قوالب بسكربتات) بيفتح الرئيسية من جديد؛
    // التحديث والرجوع بس، فتح الرابط جديد في نفس التبويب مايرثش مكان قديم
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav && nav.type !== 'reload' && nav.type !== 'back_forward') return []
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    return Object.entries(raw).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  } catch {
    return []
  }
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries([...positions].slice(-MAX_ENTRIES))))
  } catch {
    // التخزين ممنوع (تصفح خاص): الذاكرة جوّه الصفحة كفاية
  }
}

const positions = new Map<string, number>(typeof window === 'undefined' ? [] : loadPersisted())
let installed = false
let restoring = false

const entryKey = () => (window.history.state as { key?: string } | null)?.key ?? 'default'

/** بيشتغل مرة واحدة: بيسجّل التمرير تحت خانة التاريخ الحالية. */
export function installScrollMemory() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener(
    'scroll',
    () => {
      if (!restoring) positions.set(entryKey(), window.scrollY)
    },
    { passive: true },
  )
  window.addEventListener('pagehide', persist)
}

export const savedScroll = (key: string): number | undefined => positions.get(key)

/**
 * بينزل لـ‎y‎ ويفضل يحاول كل فريم لحد ما الصفحة تطول كفاية (البيانات لسه جاية)،
 * ويبطل لو الزائر لمس الصفحة أو عدّى الوقت. بيرجّع دالة الإيقاف.
 */
export function restoreScroll(y: number): () => void {
  const started = performance.now()
  let frame = 0
  const stop = () => {
    cancelAnimationFrame(frame)
    for (const type of USER_INPUT) window.removeEventListener(type, stop)
    restoring = false
  }
  const tick = () => {
    window.scrollTo({ top: y, behavior: 'instant' })
    if (Math.abs(window.scrollY - y) <= 1 || performance.now() - started > MAX_WAIT_MS) return stop()
    frame = requestAnimationFrame(tick)
  }
  restoring = true
  for (const type of USER_INPUT) window.addEventListener(type, stop, { passive: true, once: true })
  tick()
  return stop
}
