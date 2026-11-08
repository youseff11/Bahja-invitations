import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigationType } from 'react-router-dom'

import { useSite } from '@/api/hooks'
import { savedScroll } from '@/lib/scrollMemory'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { FxSky } from './fx'
import { usePublicHome } from './hooks'
import { CtaSection } from './sections/CtaSection'
import { FaqSection } from './sections/FaqSection'
import { FeaturesSection } from './sections/FeaturesSection'
import { HeroSection } from './sections/HeroSection'
import { OrderSection } from './sections/OrderSection'
import { PlansSection } from './sections/PlansSection'
import { HomeFooter } from './sections/SiteFooter'
import { StepsSection } from './sections/StepsSection'
import { TemplatesSection } from './sections/TemplatesSection'
import { prefersReducedMotion } from './motion'
import { pick, useLang } from './text'
import { useReveal } from './useReveal'

/**
 * نموذج «اطلب دعوتك» في الرئيسية.
 * في الموقع القديم (templates/public/home.html) القسم متعلّق بتعليق HTML
 * («قسم الطلب القديم مستبدل بزر التواصل الموحد أسفل الصفحة») — فمابيظهرش حتى
 * لو الطلبات مفعّلة، والزوّار بيتوجّهوا لواتساب/قسم التواصل. الـAPI
 * (‎POST /api/v1/orders/‎) والنموذج جاهزين؛ اقلب القيمة دي لـ‎true‎ لو عايز
 * النموذج يرجع يظهر لما ‎ordersEnabled‎ يبقى مفعّل.
 */
const SHOW_ORDER_FORM = false

/** لما الرابط فيه ‎#plans‎ مثلاً: ننزل للقسم لما يتعرض (ولما البيانات توصل). */
function useHashScroll(ready: boolean) {
  const { hash, key } = useLocation()
  const type = useNavigationType()
  useEffect(() => {
    if (!ready || !hash) return
    // الرجوع بالسهم بيرجّع المكان المحفوظ (Layout) بدل ما ينزل للقسم من جديد
    if (type === 'POP' && savedScroll(key) !== undefined) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [ready, hash, key, type])
}

// مرة واحدة بس في كل تحميل للموقع — الرجوع للرئيسية من جوّه الموقع مابينزّلش تاني
let autoScrolled = false
/** المهلة قبل النزول: الزائر يلمح الهيرو الأول وبعدين يتنقل للقوالب */
const AUTO_SCROLL_DELAY = 900

/**
 * أول ما الزائر يدخل الرئيسية الصفحة بتنزل لوحدها لقسم القوالب.
 * مابتشتغلش لو الرابط فيه ‎#قسم‎، أو رجوع بالسهم، أو لو الصفحة مش فوق خالص
 * (تحديث رجّع مكان قديم أو الزائر بدأ ينزل بنفسه) — مانشدّهوش من مكان هو اختاره.
 */
function useAutoScrollToTemplates(ready: boolean) {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!ready || autoScrolled) return
    // العلامة بتتحط لما القرار يتاخد (مش أول ما الـeffect يشتغل): StrictMode بيشغّله
    // مرتين وبيلغي المؤقت الأول، فلو اتحطت بدري المرة التانية كانت هتتجاهل
    // الرجوع بالسهم من صفحة كاملة (معاينة قالب) بيرجّع المكان المحفوظ — مش وقت نزول.
    // مابنعتمدش على ‎POP‎ بتاع الراوتر: أول تحميل للموقع نفسه بيتسجّل POP
    const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
    if (hash || pathname.replace(/\/+$/, '') !== '' || nav?.type === 'back_forward') {
      autoScrolled = true
      return
    }

    let cancelled = false
    const cancel = () => {
      cancelled = true
      autoScrolled = true
    }
    const events = ['wheel', 'touchstart', 'keydown'] as const
    events.forEach((name) => window.addEventListener(name, cancel, { once: true, passive: true }))
    const timer = window.setTimeout(() => {
      autoScrolled = true
      if (cancelled || window.scrollY > 40) return
      document
        .getElementById('templates')
        ?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    }, AUTO_SCROLL_DELAY)
    return () => {
      window.clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, cancel))
    }
  }, [ready, pathname, hash])
}

/** الصفحة الرئيسية للموقع العام: الهيرو، القوالب، المميزات، الباقات، الخطوات، الأسئلة، التواصل. */
export function HomePage() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data: site } = useSite()
  const home = usePublicHome()

  useReveal()
  useHashScroll(!!home.data)
  useAutoScrollToTemplates(!!home.data)
  useDocumentTitle(site ? t('public.title.home', { name: pick(lang, site.name.ar, site.name.en) }) : '')

  // الإعدادات (مفاتيح الإظهار) جاية مع الصفحة نفسها فالهيكل بيتعرض قبل البيانات
  if (!site) return null

  return (
    <>
      <FxSky />
      <HeroSection hero={site.hero} />
      <TemplatesSection
        templates={home.data?.templates}
        categories={home.data?.categories}
        error={home.error}
        mobileColumns={site.templatesMobileColumns}
      />
      <FeaturesSection />
      {site.plansPublic && <PlansSection site={site} plans={home.data?.plans} />}
      <StepsSection />
      {SHOW_ORDER_FORM && site.ordersEnabled && <OrderSection site={site} />}
      <FaqSection faqs={home.data?.faqs} />
      <CtaSection site={site} />
      <HomeFooter site={site} />
    </>
  )
}
