import type { FromFrame, PreviewPayload } from '../types'
import { applyNodeEdit, keepsShape, textUnitIn, videoIn, type NodeEdit } from './nodeEdit'
import { nextSlot, numberElements } from './numbering'
import { upgradeLazyImages, savedSrc } from './lazyImages'
import { isGhost, pointTarget } from '../frame/pointTarget'
import { htmlOf, mirror, snapshot } from './pristine'
import { serializeCustom } from './serialize'
import { INTRO_ID } from './source'
import { CODE_ROOTS } from './units'

/**
 * تحرير عناصر القسم المستورد (‎.lb-custom‎) وصناديق «كود متقدّم» (‎.lb-extra-html‎ وكود الافتتاحية ‎.lb-intro-extra‎)
 * جوّه إطار المعاينة — التحديد، الترقيم، كتابة النص. ضغطة = اختيار، ضغطتين = كتابة.
 * القسم المستورد: الـDOM هو المصدر (زي ‎editor.js‎ القديم): بعد أي تعديل بنرجّع ‎props.html‎ من الـDOM الحي
 * (‎serializeCustom‎) للصفحة الأم. صندوق الكود: سكربت المصمّم بيغيّر الـDOM وهو شغال فمانحفظش لقطته أبداً —
 * الأرقام بتتكتب في النص الأصلي بالمسار، وكتابة النص بتتبعت برقم العنصر (‎innerHTML‎ بتاعه بس).
 */

const ROOT = '.lb-custom'
/** كل جذور العناصر المرقّمة: القسم المستورد وصناديق الكود */
const ROOTS = `${ROOT}, ${CODE_ROOTS}`

const rootAt = (node: Element | null) => node?.closest<HTMLElement>(ROOTS) ?? null
const isCodeRoot = (root: Element) => root.matches(CODE_ROOTS)
/** الكتابة بتتجمّع: آخر حالة كل ٢٠٠ مللي هي اللي بتتبعت (السيريالايز لقسم تقيل بياخد وقت) */
export const WRITE_WAIT = 200

type Send = (message: FromFrame) => void

const writes = new Map<Element, ReturnType<typeof setTimeout>>()

/** البلوك صاحب الجذر: القسم، أو ‎__intro‎ لكود الافتتاحية (مش جوّه قسم). */
const blockIdOf = (root: Element) =>
  root.closest('.lb-intro-extra') ? INTRO_ID : (root.closest('[data-block]')?.getAttribute('data-block') ?? null)

/** عنصر برقمه جوّه قسم (أو الافتتاحية) — ومحصور في جذور العناصر المرقّمة. */
function findNode(id: string, slot: string, root: ParentNode): HTMLElement | null {
  const scope =
    id === INTRO_ID
      ? root.querySelector('.lb-intro')
      : Array.from(root.querySelectorAll('[data-block]')).find((n) => n.getAttribute('data-block') === id)
  const hit = Array.from(scope?.querySelectorAll<HTMLElement>('[data-move]') ?? []).find(
    (n) => n.getAttribute('data-move') === slot && rootAt(n),
  )
  return hit ?? null
}

/** مسار عنصر من صندوق الكود بأرقام الأبناء (عناصر بس). */
function pathOf(node: Element, box: Element): number[] | null {
  const path: number[] = []
  for (let cur: Element | null = node; cur && cur !== box; cur = cur.parentElement) {
    const parent: Element | null = cur.parentElement
    if (!parent) return null
    path.unshift(Array.from(parent.children).indexOf(cur))
  }
  return path
}

/** كتابة وحدة نص جوّه صندوق كود: ‎innerHTML‎ بتاعها بس (بنفس رقمها)، مجمّعة كل ٢٠٠ مللي. */
function writeNode(node: Element, send: Send) {
  const timer = writes.get(node)
  if (timer) clearTimeout(timer)
  writes.delete(node)
  const root = rootAt(node)
  const id = root && blockIdOf(root)
  const slot = node.getAttribute('data-move')
  if (id && slot) send({ type: 'lb-editor:node-edits', id, edits: [{ slot, edit: { kind: 'inner', html: serializeCustom(node) } }] })
}

function scheduleNode(node: Element, send: Send) {
  const timer = writes.get(node)
  if (timer) clearTimeout(timer)
  writes.set(
    node,
    setTimeout(() => writeNode(node, send), WRITE_WAIT),
  )
}

const NOT_PICKABLE = new Set(['SCRIPT', 'STYLE', 'BR', 'HR', 'LINK', 'META'])

/**
 * أصغر عنصر باين جوّه صندوق كود تحت نقطة الضغطة (برواز، كارت، خط، شكل…) — حتى لو مالوش رقم: كود المصمّم غالباً
 * ‎pointer-events:none‎ فالضغطة بتروح للأب المرقّم، فالمحرر هو اللي بيدوّر بالمقاس. وحدات النص وجوّه الـSVG بتتخطّى
 * (النص ليه تحديده، والـSVG بيتحدّد كله).
 */
function codeElementAt(box: Element, x: number, y: number): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestArea = Infinity
  for (const n of Array.from(box.querySelectorAll<HTMLElement>('*'))) {
    if (NOT_PICKABLE.has(n.tagName.toUpperCase())) continue
    if ((n.tagName.toLowerCase() !== 'svg' && n.closest('svg')) || n.parentElement?.closest('[data-lb-text]')) continue
    const r = n.getBoundingClientRect()
    const slop = Math.max(0, 4 - Math.min(r.width, r.height)) / 2 // خط رفيع: هامش صغير عشان يتضغط
    if (r.width <= 0 || r.height <= 0 || x < r.left - slop || x > r.right + slop || y < r.top - slop || y > r.bottom + slop) continue
    const area = r.width * r.height
    if (area > bestArea || isGhost(n)) continue
    best = n
    bestArea = area
  }
  return best
}

/** تبديل صورتين جوّه صندوق كود: المصدرين الجداد (src وsrcset) بيتبعتوا بأرقام الصورتين. */
export function commitSwap(a: Element, b: Element, send: Send) {
  const root = rootAt(a)
  const id = root && blockIdOf(root)
  if (!id) return
  const edits = swapEdits(a, b)
  if (edits.length) send({ type: 'lb-editor:node-edits', id, edits })
}

/** تعديلات المصدرين بعد تبديل صورتين (‎src‎ و‎srcset‎ مع بعض). */
function swapEdits(a: Element, b: Element) {
  return [a, b].flatMap((img) => {
    const slot = img.getAttribute('data-move')
    return slot
      ? [{ slot, edit: { kind: 'attrs' as const, values: { src: savedSrc(img), srcset: img.getAttribute('srcset') } } }]
      : []
  })
}

/** كتابة وحدة نص: محتواها (‎innerHTML‎) على لقطة القسم لو السكربتات شغّالة. */
function mirrorText(root: Element, node: Element) {
  const slot = node.getAttribute('data-move')
  if (slot) mirror(root, slot, { kind: 'inner', html: serializeCustom(node) })
}

function writeNow(root: Element, send: Send, silent: boolean) {
  const timer = writes.get(root)
  if (timer) clearTimeout(timer)
  writes.delete(root)
  const id = blockIdOf(root)
  if (id) send({ type: 'lb-editor:html', id, value: htmlOf(root), silent })
}

/** يبعت ‎props.html‎ الحالي لجذر فوراً (خطوة تراجع واحدة) — بعد تبديل صورتين مثلاً. */
export function commitHtml(root: Element, send: Send, swapped?: [Element, Element]) {
  if (swapped) for (const { slot, edit } of swapEdits(...swapped)) mirror(root, slot, edit)
  writeNow(root, send, false)
}

/** يجدول كتابة راجعة لجذر (مرة واحدة لكل جذر، وآخر حالة هي اللي بتتسلسل). */
export function scheduleWrite(root: Element, send: Send, silent = false) {
  const timer = writes.get(root)
  if (timer) clearTimeout(timer)
  writes.set(
    root,
    setTimeout(() => writeNow(root, send, silent), WRITE_WAIT),
  )
}

/** سكربتات القالب شغّالة في المعاينة دي؟ (قوالب الـSPA مش بتتشغّل في المحرر) */
export const hasRuntime = (payload: PreviewPayload | null) =>
  !!payload?.stage?.runtime && (payload.runtimeScripts?.length ?? 0) > 0 && !payload.runtimeIsSpa

export const isTranslated = (payload: PreviewPayload | null) => !!payload && payload.lang !== payload.baseLang

/** يجهّز كل أقسام ‎custom_html‎ بعد كل رسمة: علامات وحدات النص + ترقيم العناصر (ويحفظه لو اتضاف رقم جديد). */
export function prepareImported(payload: PreviewPayload, send: Send, root: ParentNode = document) {
  const translated = isTranslated(payload)
  const scripted = hasRuntime(payload)
  root.querySelectorAll('[data-block-type="custom_html"]').forEach((section) => {
    const custom = section.querySelector(ROOT)
    if (!custom) return
    const { changed } = numberElements(custom)
    if (scripted) snapshot(custom) // قبل ما سكربتات القالب تشتغل — الحفظ بيتسلسل منها مش من الـDOM الحي
    // الـDOM هنا نصه مترجَم لو المعاينة مترجَمة — مانحفظش حاجة منه
    if (changed && !translated) scheduleWrite(custom, send, true)
  })
  // الصور المصغّرة (مستورد Tilda) بتتبدّل بأصولها للمعاينة بس — الحفظ بيرجّع المصغّرة (serializeCustom)
  upgradeLazyImages(root)
  // صناديق الكود: الأرقام (‎ce-N‎) بتتكتب في النص الأصلي بالمسار. الأرقام بتحط ‎data-move‎ بس فمفيش خطر على الترجمة
  root.querySelectorAll<HTMLElement>(CODE_ROOTS).forEach((box) => {
    const id = blockIdOf(box)
    if (!id) return
    const { added } = numberElements(box)
    const items = added.flatMap((node) => {
      const path = pathOf(node, box)
      const slot = node.getAttribute('data-move')
      return path && slot ? [{ path, slot, tag: node.tagName }] : []
    })
    if (items.length) send({ type: 'lb-editor:code-number', id, items })
  })
}

/** علامة العنصر المحدَّد (‎.lb-el-picked‎) — React بيكتب ‎className‎ من جديد فبنعيدها بعد كل رسمة. */
export function markPicked(picked: { id: string; slot: string } | null, root: ParentNode = document) {
  root.querySelectorAll('.lb-el-picked').forEach((n) => n.classList.remove('lb-el-picked'))
  if (!picked) return
  findNode(picked.id, picked.slot, root)?.classList.add('lb-el-picked')
}

/** تعديل من لوحة العنصر على العقدة الحية (المصدر اتحدّث في الأم بالفعل — ده بس عشان يبان قبل رد السيرفر). */
export function patchNode(id: string, slot: string, edit: NodeEdit, root: ParentNode = document) {
  const node = findNode(id, slot, root)
  const parent = rootAt(node)
  if (!node || !parent) return
  // نص بيغيّر عدد أبناء الوحدة (سطر جديد، وسم اتشال): الرسمة الجاية بتطبّقه بالفرق على العقد الحية —
  // لو غيّرناه هنا الأول هتحس إن الـDOM الحي مختلف عن المعروض وتبني القسم من جديد (إعادة تحميل)
  const unit = edit.kind === 'text' ? textUnitIn(node) : null
  if (edit.kind === 'text' && unit && !keepsShape(unit, edit.value)) {
    mirror(parent, slot, edit)
    return
  }
  if (!applyNodeEdit(parent, slot, edit)) return
  mirror(parent, slot, edit)
  // فيديو بمصدر جديد: المتصفح مابيعيدش التحميل لوحده من غير ‎load()‎
  if (edit.kind === 'video-src') {
    const video = videoIn(node)
    if (video instanceof HTMLVideoElement) video.load()
  }
}

/** العنصر المحدَّد برّه الشاشة بالكامل (اتحدّد من الطبقات مثلاً)؟ نمرّر له. اللي ظاهر مابنحرّكوش. */
export function revealPicked(root: ParentNode = document) {
  const node = root.querySelector<HTMLElement>('.lb-el-picked')
  if (!node) return
  const rect = node.getBoundingClientRect()
  if (rect.height > 0 && (rect.bottom < 0 || rect.top > window.innerHeight)) node.scrollIntoView({ block: 'center' })
}

/** يفتح وحدة نص للكتابة (ضغطتين). المعاينة المترجَمة بترفض. */
export function beginTextEdit(node: HTMLElement, send: Send, translated: boolean) {
  if (translated) {
    send({ type: 'lb-editor:refused' })
    return
  }
  node.setAttribute('contenteditable', 'plaintext-only')
  node.classList.add('lb-el-typing')
  node.focus()
  const sel = node.ownerDocument.getSelection()
  if (sel && sel.rangeCount === 0) {
    const range = node.ownerDocument.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    sel.addRange(range)
  }
}

interface Options {
  payload: () => PreviewPayload | null
  send: Send
  /** العنصر المحدَّد دلوقتي — الضغطة بتحدّثه محلياً قبل ما الصفحة الأم تردّ */
  onPick: (picked: { id: string; slot: string }) => void
}

/** يربط تحديد العناصر وكتابتها على صفحة الإطار (تفويض مرة واحدة). بيرجّع دالة الفك. */
export function installImported({ payload, send, onPick }: Options): () => void {
  /** أقرب عنصر بالمحدّد على الهدف، بشرط يكون جوّه جذر عناصر مرقّمة (القسم المستورد أو صندوق كود — بما فيه الصندوق نفسه). */
  const inRoot = (target: EventTarget | null, selector: string) => {
    const node = target instanceof Element ? target.closest<HTMLElement>(selector) : null
    return node && rootAt(node) ? node : null
  }

  // ضغطة = اختيار أقرب عنصر مرقّم (اللي جوّه وحدة نص مابيترقّمش فالنص نفسه هو اللي بيتحدّد)
  const onClick = (e: MouseEvent) => {
    const hit = pointTarget(e)
    let node = inRoot(hit, '[data-move]')
    // صندوق كود المصمّم: الحتة اللي اتضغطت بالظبط هي اللي بتتحدّد (وبتتلوّن) — مش أقرب أب مرقّم. وحدة النص لسه بتتحدّد زي ما هي
    const box = hit instanceof Element && !hit.closest('[data-lb-text]') ? hit.closest<HTMLElement>(CODE_ROOTS) : null
    if (box) node = codeElementAt(box, e.clientX, e.clientY) ?? node
    if (!node || node.classList.contains('lb-el-typing')) return
    const root = rootAt(node)
    const id = root && blockIdOf(root)
    let slot = node.getAttribute('data-move')
    if (!id || !root) return
    if (!slot) {
      // عنصر مالوش رقم: بنرقّمه دلوقتي (يتكتب في النص الأصلي بالمسار) عشان يتحدّد ويتلوّن
      const path = isCodeRoot(root) ? pathOf(node, root) : null
      if (!path) return
      slot = nextSlot(root)
      node.setAttribute('data-move', slot)
      send({ type: 'lb-editor:code-number', id, items: [{ path, slot, tag: node.tagName }] })
    }
    onPick({ id, slot })
    send({ type: 'lb-editor:element', id, slot })
  }

  // ضغطتين على نص = كتابة (الضغطة الواحدة بتفضل للتحديد عشان Delete والأسهم وCtrl+C تفضل للعنصر)
  const onDblClick = (e: MouseEvent) => {
    const node = inRoot(pointTarget(e), '[data-lb-text]')
    if (!node) return
    e.preventDefault()
    e.stopPropagation()
    const slot = node.getAttribute('data-move')
    const root = rootAt(node)
    const id = root && blockIdOf(root)
    if (id && slot) {
      onPick({ id, slot })
      send({ type: 'lb-editor:element', id, slot })
    }
    beginTextEdit(node, send, isTranslated(payload()))
  }

  const typing = (target: EventTarget | null) => {
    const node = inRoot(target, '[data-lb-text]')
    return node?.classList.contains('lb-el-typing') ? node : null
  }

  const onInput = (e: Event) => {
    const node = typing(e.target)
    const root = rootAt(node)
    if (!node || !root || isTranslated(payload())) return
    if (isCodeRoot(root)) scheduleNode(node, send)
    else {
      mirrorText(root, node)
      scheduleWrite(root, send)
    }
  }

  const onFocusOut = (e: FocusEvent) => {
    const node = typing(e.target)
    if (!node) return
    node.removeAttribute('contenteditable')
    node.classList.remove('lb-el-typing')
    const root = rootAt(node)
    if (!root || isTranslated(payload())) return
    if (isCodeRoot(root)) writeNode(node, send)
    else {
      mirrorText(root, node)
      writeNow(root, send, false)
    }
  }

  // Esc بيخرج من الكتابة بس — العنصر يفضل محدَّد
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    const node = typing(e.target)
    if (!node) return
    e.preventDefault()
    e.stopPropagation()
    node.blur()
  }

  // الافتتاحية بتفتح الدعوة بأي ضغطة جواها (لمسة في أي مكان) — ضغطة على كود الافتتاحية في المحرر معناها «اختار العنصر ده»،
  // فبنخطفها في مرحلة الالتقاط قبل ما توصل لمستمع الافتتاحية
  const onIntroCode = (e: MouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.closest('.lb-intro-extra')) return
    e.stopPropagation()
    onClick(e)
  }

  document.addEventListener('click', onIntroCode, true)
  document.addEventListener('click', onClick)
  document.addEventListener('dblclick', onDblClick, true)
  document.addEventListener('input', onInput)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('keydown', onKeyDown, true)
  return () => {
    document.removeEventListener('click', onIntroCode, true)
    document.removeEventListener('click', onClick)
    document.removeEventListener('dblclick', onDblClick, true)
    document.removeEventListener('input', onInput)
    document.removeEventListener('focusout', onFocusOut)
    document.removeEventListener('keydown', onKeyDown, true)
    writes.forEach((timer) => clearTimeout(timer))
    writes.clear()
  }
}
