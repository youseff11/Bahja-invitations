/**
 * حركات الظهور (‎.lb-anim‎) في المحرر: القسم بيظهر بحركته أول ما يقرّب من الشاشة (نفس عارض الدعوة).
 * بس مابتتعادش مع كل رسمة: React بيكتب ‎className‎ من جديد فبيمسح ‎is-in‎، فاللي ظهر قبل كده
 * بنرجّعه فوراً (قبل ما المتصفح يرسم) من غير حركة، واللي لسه ماظهرش بيستنى دوره.
 */
const PENDING = '.lb-anim:not(.is-in)'

const shown = new WeakSet<Element>()

/** يرجّع ‎is-in‎ لكل قسم ظهر قبل كده — بيتنادى في ‎useLayoutEffect‎ بعد كل رسمة. */
export function keepRevealed(root: ParentNode = document) {
  root.querySelectorAll('.lb-anim').forEach((node) => {
    if (shown.has(node)) node.classList.add('is-in')
  })
}

/** يراقب الأقسام اللي لسه ماظهرتش (وأي قسم يتضاف بعدين). بيرجّع دالة الفك. */
export function installReveal(doc: Document = document): () => void {
  const show = (node: Element) => {
    shown.add(node)
    node.classList.add('is-in')
  }
  if (!('IntersectionObserver' in window)) {
    doc.querySelectorAll(PENDING).forEach(show)
    return () => {}
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        show(entry.target)
        io.unobserve(entry.target)
      }
    },
    // threshold:0 = أول ما أي جزء يلمس صندوق القياس؛ ٤٥٪ بتمدّه تحت الشاشة عشان الانتقال يخلص
    { threshold: 0, rootMargin: '0px 0px 45% 0px' },
  )
  const scan = () => doc.querySelectorAll(PENDING).forEach((node) => io.observe(node))
  scan()
  // الأقسام اللي بتتحمّل متأخر بتحلّ محل مكانها الفاضي بعنصر جديد مالوش مراقب، والرسمة الجديدة بتمسح ‎is-in‎
  const mo = new MutationObserver((records) => {
    const added = records.some((r) =>
      Array.from(r.addedNodes).some((n) => n instanceof Element && (n.matches(PENDING) || n.querySelector(PENDING))),
    )
    if (added) scan()
  })
  mo.observe(doc.body, { childList: true, subtree: true })
  return () => {
    io.disconnect()
    mo.disconnect()
  }
}
