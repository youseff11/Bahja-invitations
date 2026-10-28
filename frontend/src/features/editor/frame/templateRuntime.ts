/**
 * سكربتات القالب المستورد (Tilda…) جوّه إطار المعاينة — نسخة من ‎restartTemplateRuntime‎ في المحرر القديم.
 *
 * المعاينة بتتبني من جديد مع كل تعديل في قسم مستورد، فالسكربتات لازم تتعاد على الـDOM الجديد:
 * القديمة بتتشال، ومؤقتاتها (‎setInterval‎) بتقف قبل التشغيلة الجديدة، وإلا عدّاد بالموعد القديم
 * يفضل يكتب فوق الجديد. ملف خارجي واحد مابيعلّقش التحديث أكتر من ٤ ثواني.
 */
export interface RuntimeItem {
  src?: string
  code?: string
  type?: string
}

declare global {
  interface Window {
    __lbRuntimeTimers?: number[]
    __lbTimersTracked?: boolean
  }
}

const SCRIPT = 'script[data-lb-template-runtime]'
const SCRIPT_TIMEOUT = 4000
/** ‎const‎/‎let‎/‎class‎ على مستوى الملف بترمي «already declared» في التشغيلة التانية — اللف بيدّي كل تشغيلة نطاقها */
const TOP_LEVEL_DECL = /(^|\n)\s*(const|let|class)\s/

let generation = 0
let runs = 0

function trackTimers() {
  if (window.__lbTimersTracked) return
  window.__lbTimersTracked = true
  const native = window.setInterval.bind(window)
  window.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const id = native(...args) as unknown as number
    window.__lbRuntimeTimers?.push(id)
    return id
  }) as typeof window.setInterval
}

/** يوقف التشغيلة الحالية: يشيل السكربتات ويوقف المؤقتات. */
export function stopTemplateRuntime() {
  generation++
  document.querySelectorAll(SCRIPT).forEach((node) => node.remove())
  for (const id of window.__lbRuntimeTimers ?? []) window.clearInterval(id)
  window.__lbRuntimeTimers = []
}

function run(item: RuntimeItem, again: boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    const script = document.createElement('script')
    script.setAttribute('data-lb-template-runtime', '')
    if (item.type) script.type = item.type
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    if (item.src) {
      // الموديول بيتنفّذ مرة واحدة لكل رابط — الاستعلام بيخلّيه يتنفّذ على الـDOM الجديد
      script.src = again && item.type === 'module' ? `${item.src}${item.src.includes('?') ? '&' : '?'}lbr=${runs}` : item.src
      script.onload = finish
      script.onerror = finish
      window.setTimeout(finish, SCRIPT_TIMEOUT)
    } else {
      const code = item.code || ''
      script.text = again && item.type !== 'module' && TOP_LEVEL_DECL.test(code) ? `(function(){\n${code}\n})();` : code
    }
    ;(document.body || document.documentElement).appendChild(script)
    if (!item.src) finish()
  })
}

/** يشغّل السكربتات بالترتيب من جديد. تشغيلة أحدث بتلغي اللي لسه ماخلصتش. */
export async function restartTemplateRuntime(items: RuntimeItem[]): Promise<void> {
  const again = runs > 0
  trackTimers()
  stopTemplateRuntime()
  const mine = generation
  runs++
  for (const item of items) {
    if (mine !== generation) return
    await run(item, again)
  }
}
