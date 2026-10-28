/**
 * تسخين الصور اللي بتتبدّل مع المظهر واللغة (اللوجو وصورة الهيرو) في الكاش وقت
 * الفراغ — زي ‎site.js‎ القديم: من غيره المكان بيفضل فاضي لحد ما النسخة التانية
 * تنزل من الشبكة (قياس القديم ~٤٧٠ms) فتبديل المظهر مايبقاش فوري.
 */
const BRAND = { light: '/site-logo/light.png', dark: '/site-logo/dark.png' }
const HERO = {
  ar: { light: '/static/images/home-arabic-light.webp', dark: '/static/images/home-arabic-dark.webp' },
  en: { light: '/static/images/home-english-light.webp', dark: '/static/images/home-english-dark.webp' },
}

const warmed = new Set<string>()

function warm(url: string) {
  if (warmed.has(url)) return
  warmed.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  // decode() بيجهّز الصورة للرسم؛ من غيره أول ظهور بعد التبديل بيتأخر لحد الفك
  img.decode?.().catch(() => {})
}

type HeroUrls = { lightAr?: string; lightEn?: string; darkAr?: string; darkEn?: string }

// صور الهيرو المرفوعة من لوحة التحكم (/media/…) بتغلب الافتراضية في CSS، فلازم
// تتسخّن هي — تسخين الافتراضية لوحده بيسيب أول تبديل مظهر على صورة لسه بتنزل.
let customHero: HeroUrls | null = null

/** HeroSection بيسجّل الروابط اللي هتتعرض فعلاً (بنفس تشفير الـCSS). */
export function registerHeroImages(urls: HeroUrls | null) {
  customHero = urls
  warmOtherVariants()
}

function heroUrl(lang: 'ar' | 'en', theme: 'light' | 'dark'): string {
  const c = customHero
  if (c) {
    const url =
      theme === 'light' ? (lang === 'en' ? c.lightEn || c.lightAr : c.lightAr) : lang === 'en' ? c.darkEn || c.darkAr : c.darkAr
    if (url) return url
  }
  return HERO[lang][theme]
}

/** النسخة التانية من المظهر (للّوجو والهيرو) والنسخة التانية من اللغة (للهيرو). */
export function warmOtherVariants() {
  const root = document.documentElement
  const theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  const lang = root.lang === 'en' ? 'en' : 'ar'
  const otherTheme = theme === 'dark' ? 'light' : 'dark'
  // اللوجو ممكن يكون مرفوع من اللوحة — الـCSS بيقراه من ‎--site-logo-*‎
  const logoVar = getComputedStyle(root).getPropertyValue(`--site-logo-${otherTheme}`).match(/url\(["']?([^"')]+)/)
  warm(logoVar ? logoVar[1] : BRAND[otherTheme])
  // الهيرو في الرئيسية بس
  if (document.querySelector('.hero-art')) {
    warm(heroUrl(lang, otherTheme))
    warm(heroUrl(lang === 'ar' ? 'en' : 'ar', theme))
  }
}

/** بعد ما الصفحة تخلص تحميل عشان مانزاحمش موارد أول رسم. */
export function scheduleWarm(): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(warmOtherVariants, { timeout: 3000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(warmOtherVariants, 1200)
  return () => window.clearTimeout(id)
}
