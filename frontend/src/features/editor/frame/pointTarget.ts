/**
 * هدف الضغطة بعد «النظر من تحت» الصور: لو الماوس على صورة/شكل (سحابة مثلاً) وتحتها في نفس القسم نص،
 * النص هو الهدف — الصورة الشفافة أو الأكبر من الرسم الفعلي ماتخطفش الضغطة من الكلام اللي باين.
 * الصورة نفسها بتتختار من الضغط على جزء مفيهوش نص تحته، أو من طبقات القسم.
 */
const KEEP = 'a, button, input, textarea, canvas, [contenteditable], [data-lb-text], [data-no-drag], [data-section-text]'

/** جذور العناصر المرقّمة: القسم المستورد وصناديق الكود */
const ROOTS = '.lb-custom, .lb-extra-html, .lb-intro-extra'

/**
 * مش باين للمصمّم: هو أو أي أب جوّه جذره شفاف تماماً (‎opacity: 0‎) أو مخفي (‎visibility: hidden‎).
 * المحرر بيفرض ‎pointer-events: auto‎ على كل عنصر مرقّم، فشرائح كاروسيل مخفية (شريحة نشطة واحدة والباقي
 * ‎opacity: 0‎ فوق بعض) كانت بتاخد الضغطة بدل الشريحة اللي باينة.
 */
function isGhost(el: Element): boolean {
  const root = el.closest(ROOTS)
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const style = getComputedStyle(cur)
    if (style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return true
    if (cur === root) break
  }
  return false
}

/** أعلى عنصر مرقّم باين تحت الماوس في نفس القسم؛ لو مفيش فالهدف الأصلي (أحسن من ضغطة تضيع). */
function visibleTarget(target: Element, e: MouseEvent | PointerEvent): Element {
  const root = target.closest(ROOTS)
  if (!root || !isGhost(target)) return target
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    if (el.closest(ROOTS) === root && el.closest('[data-move]') && !isGhost(el)) return el
  }
  return target
}

export function pointTarget(e: MouseEvent | PointerEvent): EventTarget | null {
  const first = e.target
  if (!(first instanceof Element) || typeof document.elementsFromPoint !== 'function') return first
  const target = visibleTarget(first, e)
  if (target.closest(KEEP) || !target.closest('[data-move]')) return target
  const section = target.closest('[data-block]')
  if (!section) return target
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    if (el === target) continue
    const text = el.closest<HTMLElement>('[data-lb-text]')
    if (text && text.closest('[data-block]') === section && !text.closest('.lb-intro') && !isGhost(text)) return text
  }
  return target
}
