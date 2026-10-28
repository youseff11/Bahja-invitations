/**
 * صور القوالب المستوردة (Tilda/SiteOne): الملف المحفوظ بيكون أحياناً نسخة ٢٠px مصغّرة في ‎src‎ والأصل في
 * ‎data-original‎ — سكربت القالب (lazyload) هو اللي بيبدّلهم في صفحة العرض، لكن سكربتات القالب مابتشتغلش في
 * المحرر فالمصغّرة بتتمدّد وتبان مبكسلة.
 *
 * هنا بنبدّل ‎src‎ على الـDOM الحي بس عشان المعاينة تبان واضحة. الـDOM هو المصدر اللي بيتحفظ
 * (‎serializeCustom‎)، فالمصغّرة الأصلية بتتخزّن في ‎data-lb-thumb-src‎ وبترجع مكانها وقت الحفظ والنسخ والقراءة.
 */
export const THUMB_ATTR = 'data-lb-thumb-src'

/** أكبر عرض يتعتبر مصغّرة (اللي أكبر منه صورة حقيقية اتحمّلت وقت الاستيراد). */
const THUMB_MAX = 64

/** نفس النطاقات المسموح بها وقت الاستيراد (‎templateimport._ALLOWED_REMOTE_IMAGE_HOSTS‎). */
const HOSTS = new Set(['static.tildacdn.net', 'optim.tildacdn.net', 'thb.tildacdn.net', 'res.cloudinary.com'])

function originalOf(img: Element): string | null {
  const raw = img.getAttribute('data-original')?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw, location.href)
    return url.protocol === 'https:' && HOSTS.has(url.hostname.toLowerCase()) ? url.href : null
  } catch {
    return null
  }
}

/** ‎src‎ المحفوظ في المستند (المصغّرة لو اتبدّلت للأصل). */
export const savedSrc = (img: Element): string | null => img.getAttribute(THUMB_ATTR) ?? img.getAttribute('src')

/** يرجّع ‎src‎ المحفوظ ويشيل علامتنا (على الصورة نفسها). */
export function restoreThumb(img: Element) {
  const thumb = img.getAttribute(THUMB_ATTR)
  if (thumb === null) return
  if (thumb) img.setAttribute('src', thumb)
  else img.removeAttribute('src')
  img.removeAttribute(THUMB_ATTR)
}

/** يبدّل المصغّرات بأصولها في كل صور ‎data-original‎ تحت ‎root‎ (آمن يتنادى بعد كل رسمة). */
export function upgradeLazyImages(root: ParentNode = document) {
  root.querySelectorAll<HTMLImageElement>('img[data-original]').forEach((img) => {
    if (img.hasAttribute(THUMB_ATTR)) return
    const original = originalOf(img)
    if (!original) return

    const swap = () => {
      if (img.hasAttribute(THUMB_ATTR) || img.naturalWidth > THUMB_MAX || !img.isConnected) return
      img.setAttribute(THUMB_ATTR, img.getAttribute('src') ?? '')
      // لو الأصل ماتحمّلش (أوفلاين/اتحجب) نرجع المصغّرة بدل صورة مكسورة
      img.addEventListener('error', () => restoreThumb(img), { once: true })
      img.setAttribute('src', original)
    }
    if (img.complete && img.naturalWidth > 0) swap()
    else img.addEventListener('load', swap, { once: true })
  })
}
