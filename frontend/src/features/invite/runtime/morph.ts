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
    if (error instanceof Unsafe) return false
    throw error
  }
  morphChildren(root, prev, next)
  return true
}
