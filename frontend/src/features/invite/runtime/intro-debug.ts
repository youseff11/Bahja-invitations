/**
 * لوحة تشخيص للافتتاحية على الموبايل (‎?debug=1‎ في الرابط بس) — للآيفون اللي
 * مفيش عليه أدوات مطوّر: بتعرض نبض الـJS، حالة فيديو الافتتاحية والموسيقى،
 * أحداث ‎lb:*‎ والأخطاء، عشان تسجيل شاشة واحد يوضّح الافتتاحية واقفة ليه.
 */
const t0 = performance.now()
const stamp = () => ((performance.now() - t0) / 1000).toFixed(1)
const lines: string[] = []
const log = (msg: string) => {
  lines.push(`${stamp()} ${msg}`)
  if (lines.length > 14) lines.shift()
}

const box = document.createElement('pre')
box.setAttribute(
  'style',
  'position:fixed;left:4px;bottom:4px;z-index:2147483647;margin:0;padding:6px 8px;max-width:calc(100vw - 8px);' +
    'background:rgba(0,0,0,.78);color:#0f0;font:10px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;' +
    'pointer-events:none;direction:ltr;text-align:left;border-radius:6px',
)
const mount = () => document.body.appendChild(box)
if (document.body) mount()
else document.addEventListener('DOMContentLoaded', mount)

let ticks = 0
let frames = 0
const countFrame = () => {
  frames++
  requestAnimationFrame(countFrame)
}
requestAnimationFrame(countFrame)

window.addEventListener('error', (e) => log(`ERR ${e.message} @${String(e.filename).split('/').pop()}:${e.lineno}`))
window.addEventListener('unhandledrejection', (e) => log(`REJ ${String((e.reason as Error)?.message ?? e.reason)}`))
document.addEventListener('visibilitychange', () => log(`visibility ${document.visibilityState}`))
;['lb:intro-start', 'lb:intro-play', 'lb:intro-open'].forEach((name) =>
  document.addEventListener(name, () => log(name)),
)
// أحداث الفيديو/الصوت مابتطلعش (no bubble) — الالتقاط على document بيمسكها كلها
;['play', 'playing', 'pause', 'waiting', 'stalled', 'ended', 'error', 'emptied', 'abort', 'seeking', 'seeked'].forEach(
  (name) =>
    document.addEventListener(
      name,
      (e) => {
        const el = e.target as HTMLMediaElement
        if (!(el instanceof HTMLMediaElement)) return
        const who = el.closest?.('.lb-intro') ? 'vid' : el.tagName.toLowerCase()
        log(`${who} ${name} t=${el.currentTime.toFixed(2)}`)
      },
      true,
    ),
)

const media = (el: HTMLMediaElement | null | undefined) => {
  if (!el) return '-'
  const end = el.buffered.length ? el.buffered.end(el.buffered.length - 1).toFixed(1) : '0'
  return (
    `t=${el.currentTime.toFixed(2)}/${Number.isFinite(el.duration) ? el.duration.toFixed(2) : el.duration} ` +
    `paused=${+el.paused} ended=${+el.ended} rs=${el.readyState} ns=${el.networkState} buf=${end}` +
    (el.error ? ` err=${el.error.code}` : '')
  )
}

window.setInterval(() => {
  ticks++
  const intro = document.querySelector('.lb-intro')
  const vid = intro?.querySelector('video')
  const state = (window as unknown as { __lbIntroState?: () => Record<string, unknown> }).__lbIntroState?.()
  const music = (window as unknown as { __lbMusic?: { audio: HTMLAudioElement } | null }).__lbMusic
  box.textContent = [
    `js ${stamp()}s tick=${ticks} raf=${frames} hidden=${+document.hidden}`,
    `intro ${intro ? intro.className.replace(/\blb-intro\b ?/, '') || '(on)' : 'GONE'}`,
    `state ${state ? JSON.stringify(state) : '-'}`,
    `vid ${media(vid)}`,
    `mus ${media(music?.audio)}`,
    ...lines,
  ].join('\n')
}, 250)
