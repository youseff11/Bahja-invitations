import { applyNodeEdit, type NodeEdit } from './nodeEdit'
import { serializeCustom } from './serialize'

/**
 * نسخة نضيفة من القسم المستورد لما سكربتات القالب (Tilda…) تكون شغّالة جوّه المعاينة.
 *
 * القسم المستورد الـDOM بتاعه هو مصدر الحفظ (‎serializeCustom‎)، والسكربتات بتغيّر الـDOM ده وهي شغّالة
 * (كلاسات، ستايل مضمّن، عناصر مبنية). لو اتسلسل زي ما هو، حالة اللحظة بتتحفظ في القالب. فبناخد لقطة قبل
 * ما السكربتات تشتغل، وكل تعديل من المستخدم (كتابة نص، تبديل صورتين، تعديل من لوحة العنصر) بيتطبّق على
 * اللقطة كمان، والحفظ بيتسلسل منها هي. من غير سكربتات مفيش لقطة، والحفظ زي ما كان من الـDOM الحي.
 */
const twins = new WeakMap<Element, Element>()

/** لقطة الجذر (مرة واحدة لكل جذر — الرسمة الجديدة بتعمل جذر جديد). بتتاخد بعد الترقيم وقبل السكربتات. */
export function snapshot(root: Element) {
  if (!twins.has(root)) twins.set(root, root.cloneNode(true) as Element)
}

/** تعديل المستخدم على اللقطة (لو فيه). */
export function mirror(root: Element, slot: string, edit: NodeEdit) {
  const twin = twins.get(root)
  if (twin) applyNodeEdit(twin, slot, edit)
}

/** ‎props.html‎ اللي يتحفظ: من اللقطة لو السكربتات شغّالة، وإلا من الـDOM الحي. */
export function htmlOf(root: Element): string {
  return serializeCustom(twins.get(root) ?? root)
}
