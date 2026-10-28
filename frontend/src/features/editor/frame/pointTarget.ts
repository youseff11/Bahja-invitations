/**
 * هدف الضغطة بعد «النظر من تحت» الصور: لو الماوس على صورة/شكل (سحابة مثلاً) وتحتها في نفس القسم نص،
 * النص هو الهدف — الصورة الشفافة أو الأكبر من الرسم الفعلي ماتخطفش الضغطة من الكلام اللي باين.
 * الصورة نفسها بتتختار من الضغط على جزء مفيهوش نص تحته، أو من طبقات القسم.
 */
const KEEP = 'a, button, input, textarea, canvas, [contenteditable], [data-lb-text], [data-no-drag], [data-section-text]'

export function pointTarget(e: MouseEvent | PointerEvent): EventTarget | null {
  const target = e.target
  if (!(target instanceof Element) || typeof document.elementsFromPoint !== 'function') return target
  if (target.closest(KEEP) || !target.closest('[data-move]')) return target
  const section = target.closest('[data-block]')
  if (!section) return target
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    if (el === target) continue
    const text = el.closest<HTMLElement>('[data-lb-text]')
    if (text && text.closest('[data-block]') === section && !text.closest('.lb-intro')) return text
  }
  return target
}
