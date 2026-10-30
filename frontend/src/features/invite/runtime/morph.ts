/**
 * تحديث HTML القسم في مكانه بدل ما نبنيه من جديد.
 *
 * ‎innerHTML = …‎ بيمسح كل العقد ويشغّل السكربتات تاني، فأي تعديل صغير (خط، لون، نص) كان بيعيد الأنيميشن
 * والعدّادات من الأول. هنا بنقارن النسخة اللي اتعرضت (‎prev‎) بالجديدة (‎next‎) ونطبّق الفرق بس على
 * العقد الحية: اللي ماتغيّرش ماتتلمسش (فحالته اللي السكربت غيّرها وأنيميشنه الشغّال يكملوا).
 *
 * بيرجّع ‎false‎ ومايلمسش حاجة لو التحديث الموضعي مش آمن (سكربتات اتغيّرت، أو الـDOM الحي ماعادش
 * بيطابق ‎prev‎ لأن سكربت عدّله) — والمنادي ساعتها بيبني من جديد زي زمان.
 */

const SCRIPT = 'script[data-lb-section-script]'

const isScript = (node: Node) => node instanceof Element && node.matches(SCRIPT)
/** عقدة فيها سكربت: ماينفعش نحرّكها أو نشيلها في المكان (سكربت اتحقن بـ‎innerHTML‎ مابيتنفّذش) */
const hasScript = (node: Node) => node instanceof Element && (node.matches(SCRIPT) || node.querySelector(SCRIPT) !== null)
/** عقد بيضيفها المحرر على الـDOM الحي (مقابض عرض النص) ومش في HTML السيرفر: مابتتحسبش ولا بتتلمس */
const INJECTED = '.lb-section-text__grip'
const isInjected = (node: Node) => node instanceof Element && node.matches(INJECTED)
const kids = (parent: Node, live = false) =>
  Array.from(parent.childNodes).filter((n) => !isScript(n) && !(live && isInjected(n)))

/** السكربتات (بالترتيب ونصوصها) — لو اتغيّرت لازم تتشغّل من جديد */
const scriptsOf = (root: ParentNode) =>
  Array.from(root.querySelectorAll(SCRIPT)).map((s) => `${s.getAttribute('data-event-date') ?? ''}\u0000${s.textContent ?? ''}`)

class Unsafe extends Error {}

function syncAttributes(live: Element, prev: Element, next: Element) {
  for (const { name } of Array.from(prev.attributes)) {
    if (!next.hasAttribute(name)) live.removeAttribute(name)
  }
  for (const { name, value } of Array.from(next.attributes)) {
    if (prev.getAttribute(name) !== value) live.setAttribute(name, value)
  }
}

function morphNode(live: Node, prev: Node, next: Node) {
  if (prev.isEqualNode(next)) return
  const sameKind = prev.nodeType === next.nodeType && prev.nodeName === next.nodeName
  if (!sameKind) {
    if (hasScript(prev) || hasScript(next)) throw new Unsafe()
    live.parentNode?.replaceChild(document.importNode(next, true), live)
    return
  }
  if (next.nodeType !== Node.ELEMENT_NODE) {
    // نص/تعليق
    if (live.nodeValue !== next.nodeValue) live.nodeValue = next.nodeValue
    return
  }
  syncAttributes(live as Element, prev as Element, next as Element)
  morphChildren(live, prev, next)
}

function morphChildren(live: Node, prev: Node, next: Node) {
  const liveKids = kids(live, true)
  const prevKids = kids(prev)
  const nextKids = kids(next)
  // الـDOM الحي ماعادش على شكل النسخة اللي عرضناها (سكربت زوّد/شال عقد): مانخمّنش
  if (liveKids.length !== prevKids.length) throw new Unsafe()
  const common = Math.min(prevKids.length, nextKids.length)
  for (let i = 0; i < common; i++) morphNode(liveKids[i], prevKids[i], nextKids[i])
  for (let i = common; i < prevKids.length; i++) {
    if (hasScript(prevKids[i])) throw new Unsafe()
    live.removeChild(liveKids[i])
  }
  for (let i = common; i < nextKids.length; i++) {
    if (hasScript(nextKids[i])) throw new Unsafe()
    live.appendChild(document.importNode(nextKids[i], true))
  }
}

const parse = (html: string) => {
  const holder = document.createElement('div')
  holder.innerHTML = html
  return holder
}

/** يحدّث ‎root‎ من ‎prevHtml‎ (اللي معروض) لـ‎nextHtml‎. ‎true‎ = اتطبّق في مكانه. */
export function morphInto(root: Element, prevHtml: string, nextHtml: string): boolean {
  const prev = parse(prevHtml)
  const next = parse(nextHtml)
  const before = scriptsOf(prev)
  const after = scriptsOf(next)
  if (before.length !== after.length || before.some((s, i) => s !== after[i])) return false
  // نجرّب على نسخة قبل ما نلمس الحي: لو شكله مش مطابق نكتشف ده من غير أضرار
  try {
    const probe = root.cloneNode(true) as Element
    morphChildren(probe, prev, next)
  } catch (error) {
    if (error instanceof Unsafe) return patchBySlot(root, prev, next)
    throw error
  }
  morphChildren(root, prev, next)
  return true
}

const SLOT = 'data-move'
/** نص حقيقي مباشر (مش مسافات التنسيق بين الوسوم) */
const hasText = (node: Node) => Array.from(node.childNodes).some((c) => c.nodeType === Node.TEXT_NODE && (c.nodeValue ?? '').trim() !== '')
/** العنصر الحي برقمه (‎data-move‎) جوّه ‎scope‎ — الأرقام ثابتة حتى لو سكربت المصمّم لفّ حروف أو زوّد عقد. */
function liveBySlot(scope: Element, slot: string): Element | null {
  return Array.from(scope.querySelectorAll(`[${SLOT}]`)).find((n) => n.getAttribute(SLOT) === slot) ?? null
}

/**
 * الدالة التقليدية (‎morphChildren‎) بتفترض إن الـDOM الحي لسه على شكل النسخة المعروضة. لو سكربت المصمّم غيّره
 * (لفّ حروف الاسم في ‎<span>‎ لأنيميشن مثلاً) ماينفعش، وكنا نبني الكود كله من جديد فالأنيميشن يتعاد مع كل حرف.
 * هنا بنقارن النسختين (المعروضة والجديدة) وبنطبّق الفرق على العناصر الحية برقمها: اللي ماتغيّرش ماتتلمسش، ووحدة النص
 * اللي اتغيّرت بس بيتبدّل محتواها. بترجّع ‎false‎ ومايتلمسش حاجة لو ماقدرناش نحدّد العناصر.
 */
function patchBySlot(root: Element, prev: ParentNode, next: ParentNode): boolean {
  const ops: (() => void)[] = []

  function plan(live: Element, p: Node, n: Node): boolean {
    if (p.isEqualNode(n)) return true
    if (p.nodeType !== n.nodeType || p.nodeName !== n.nodeName) return false
    if (!(p instanceof Element) || !(n instanceof Element)) return false
    if (hasScript(p) || hasScript(n)) return false
    ops.push(() => syncAttributes(live, p, n))
    const pe = Array.from(p.children)
    const ne = Array.from(n.children)
    const container =
      pe.length === ne.length &&
      !hasText(p) &&
      !hasText(n) &&
      pe.every((e, i) => e.nodeName === ne[i].nodeName)
    if (container) {
      const mark = ops.length
      const liveKidsHere = Array.from(live.children)
      const samePlace = liveKidsHere.length === pe.length && liveKidsHere.every((c, i) => c.nodeName === pe[i].nodeName)
      const done = pe.every((e, i) => {
        // برقمه (لو لسه موجود)، وإلا بمكانه لما أبناء العنصر الحي لسه بنفس العدد والوسوم (الترقيم الحي ممكن يتأخر عن اللي في النص)
        const slot = ne[i].getAttribute(SLOT) ?? e.getAttribute(SLOT)
        const bySlot = slot ? liveBySlot(live, slot) : null
        const child = (bySlot?.nodeName === e.nodeName ? bySlot : null) ?? (samePlace ? liveKidsHere[i] : null)
        return child !== null && plan(child, e, ne[i])
      })
      if (done) return true
      ops.length = mark
    }
    // وحدة نص (أو بنية اتغيّرت): بنبدّل محتواها هي بس
    if (p.innerHTML !== n.innerHTML) {
      ops.push(() => live.replaceChildren(...Array.from(n.childNodes).map((c) => document.importNode(c, true))))
    }
    return true
  }

  const liveKids = kids(root, true)
  const prevKids = kids(prev)
  const nextKids = kids(next)
  if (liveKids.length !== prevKids.length || prevKids.length !== nextKids.length) return false
  for (let i = 0; i < prevKids.length; i++) {
    const [live, p, n] = [liveKids[i], prevKids[i], nextKids[i]]
    if (p.isEqualNode(n)) continue
    if (!(live instanceof Element) || !plan(live, p, n)) return false
  }
  ops.forEach((op) => op())
  return true
}
