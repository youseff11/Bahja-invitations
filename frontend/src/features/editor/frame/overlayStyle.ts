/**
 * عناصر «فوق القسم» (نص/صورة/زرار): تطبيق تعديل اللوحة على العقدة الحية في نفس اللحظة، من غير ما نستنى رد السيرفر
 * (رندر المستند كله). الحساب نسخة من فلتر ‎video_text_style‎ في ‎templatetags/invite.py‎ بنفس التحققات
 * (لون/خط/أرقام داخل حدودها) — ورد السيرفر اللي بييجي بعده بيأكّده بنفس القيم.
 */

type Item = Record<string, unknown>

const COLOR = /^(?:#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|transparent)$/
const FONT = /^[A-Za-z0-9_\s,'-]+$/
/** عرض المسرح المرجعي اللي المقاس اتظبط عليه (‎FLUID_REF‎ في السيرفر) */
const FLUID_REF = 760

/** ‎{:g}‎ بتاعة بايثون: ٦ أرقام معنوية من غير أصفار زيادة */
const g = (value: number) => String(Number(value.toPrecision(6)))
const round = (value: number, digits: number) => {
  const k = 10 ** digits
  return Math.round(value * k) / k
}

function num(item: Item, key: string, low: number, high: number, fallback = 0): number {
  const raw = item[key]
  const value = Number(raw === undefined || raw === null || raw === '' || raw === false ? 0 : raw)
  return Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback
}

function color(item: Item, key: string, fallback: string): string {
  const value = String(item[key] ?? '').trim()
  return COLOR.test(value) ? value : fallback
}

function font(item: Item, key: string): string {
  const value = String(item[key] ?? '').trim()
  return value && value.length <= 120 && FONT.test(value) ? value : 'inherit'
}

/** ‎_fluid‎: حجم بيصغّر مع عرض المسرح (‎cqw‎) بحد أدنى ‎٥٢٪‎ */
function fluid(size: number): string {
  if (!(size > 0)) return '0px'
  const low = Math.min(size * 0.52, size)
  return `clamp(${g(round(low, 1))}px, ${g(round((size / FLUID_REF) * 100, 3))}cqw, ${g(round(size, 1))}px)`
}

/** قيمة سمة ‎style‎ للعنصر — نفس اللي بيطلّعه ‎video_text_style‎. */
export function overlayStyle(item: Item): string {
  const kind = String(item.kind ?? 'text')
  let style =
    `--video-text-x:${g(num(item, 'x', -1000, 1000))}%;--video-text-y:${g(num(item, 'y', -1000, 1000))}%;` +
    `--video-text-color:${color(item, 'color', '#ffffff')};--video-text-font:${font(item, 'font')}`
  const width = num(item, 'width', 0, 100)
  if (width > 0) style += `;--section-text-w:${g(width)}%`
  const size = num(item, 'size', 0, 160)
  if (size > 0) style += `;--section-text-size:${fluid(size)}`

  const z = Math.trunc(num(item, 'z', 0, 60))
  if (item.behind === true) style += `;--ovl-z:${-100 + z}`
  else if (z) style += `;--ovl-z:${4 + z}`

  if (kind === 'text' && item.shadow) style += ';--ovl-text-shadow:0 1px 5px rgba(0,0,0,.5)'
  if (kind === 'image') {
    style += `;--ovl-radius:${g(num(item, 'radius', 0, 200))}px`
    const opacity = 'opacity' in item ? num(item, 'opacity', 0, 100, 100) : 100
    if (opacity < 100) style += `;--ovl-opacity:${g(opacity / 100)}`
  } else if (kind === 'button') {
    style +=
      `;--ovl-btn-bg:${color(item, 'btn_bg', '#b8914f')};--ovl-btn-color:${color(item, 'btn_color', '#ffffff')}` +
      `;--ovl-btn-font:${font(item, 'btn_font')};--ovl-btn-radius:${g(num(item, 'btn_radius', 0, 999, 999))}px`
    const btnSize = num(item, 'btn_size', 0, 120)
    if (btnSize > 0) style += `;--ovl-btn-size:${fluid(btnSize)}`
  }
  return style
}

/** نص بسيط (من غير HTML ولا كيانات) يتكتب مباشرة في عقدة النص */
const PLAIN = /^[^<>&]*$/

/**
 * يطبّق قايمة عناصر القسم على عقده الحية. بنطبّق بس لو العقد موجودة بنفس العدد والترتيب؛
 * غير كده (إضافة/حذف/عنصر فاضي بيظهر كصندوق) رد السيرفر هو اللي بيبني.
 * بيرجّع ‎true‎ لو لمس حاجة.
 */
export function patchOverlays(id: string, items: unknown[], root: ParentNode = document): boolean {
  const section = Array.from(root.querySelectorAll('[data-block]')).find((n) => n.getAttribute('data-block') === id)
  if (!section) return false
  const nodes = Array.from(section.querySelectorAll<HTMLElement>('[data-section-text][data-section-text-index]')).filter(
    (n) => n.closest('[data-block]') === section && !n.hasAttribute('data-video-text'),
  )
  if (!nodes.length) return false
  let touched = false
  for (const node of nodes) {
    const index = Number(node.getAttribute('data-section-text-index'))
    const item = items[index]
    if (!item || typeof item !== 'object') continue
    const next = overlayStyle(item as Item)
    if (node.getAttribute('style') !== next) {
      node.setAttribute('style', next)
      touched = true
    }
    const text = (item as Item).text
    const first = node.firstChild
    if (
      (item as Item).kind !== 'image' &&
      (item as Item).kind !== 'button' &&
      typeof text === 'string' &&
      text.trim() &&
      PLAIN.test(text) &&
      first?.nodeType === Node.TEXT_NODE &&
      first.nodeValue !== text &&
      node !== document.activeElement
    ) {
      first.nodeValue = text
      touched = true
    }
  }
  return touched
}
