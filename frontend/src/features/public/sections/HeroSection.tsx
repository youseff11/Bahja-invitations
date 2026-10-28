import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import type { HeroInfo } from '@/api/types'

import { ShootingStars, StarField } from '../fx'
import { useLang } from '../text'
import { useHeroIdle } from '../useHeroIdle'

/** خلفيات الهيرو المخصّصة: نفس تدرّج الـselectors في public.css (والأحدث في الترتيب بيكسب) */
function heroImagesCss(images: HeroInfo['images'] | undefined): string {
  if (!images) return ''
  // السيرفر بيرجّع الرابط متشفّر أصلاً (أسماء الملفات العربي: %D8%A7…)، فنفك ثم نشفّر مرة واحدة
  // بدل ما ‎encodeURI‎ يشفّر الـ‎%‎ نفسها ويخلّي الرابط ٤٠٤.
  const once = (url: string) => {
    try {
      return encodeURI(decodeURI(url))
    } catch {
      return encodeURI(url)
    }
  }
  const rule = (selector: string, url: string) => (url ? `${selector}{--hero-img:url("${once(url)}")}` : '')
  // صورة الإنجليزي اختيارية: لو فاضية بتاخد صورة العربي (لايت لوحده ودارك لوحده)،
  // فصورتين بس (لايت + دارك) كفاية لكل اللغات.
  return [
    rule('.hero-art', images.lightAr),
    rule('html[lang="en"] .hero-art', images.lightEn || images.lightAr),
    rule('[data-theme="dark"] .hero-art', images.darkAr),
    rule('html[lang="en"][data-theme="dark"] .hero-art', images.darkEn || images.darkAr),
  ].join('')
}

export function HeroSection({ hero }: { hero?: HeroInfo }) {
  const { t } = useTranslation()
  const lang = useLang()
  // أي حقل فاضي في اللوحة بيرجع للنص الافتراضي المترجم
  const custom = hero?.text[lang]
  const text = (value: string | undefined, key: string) => value?.trim() || t(`public.hero.${key}`)
  const trust = ['templates', 'delivery', 'editable'].map((name, index) => ({
    value: custom?.trust[index]?.value?.trim() || t(`public.hero.trust.${name}Value`),
    label: custom?.trust[index]?.label?.trim() || t(`public.hero.trust.${name}Label`),
  }))
  const imagesCss = heroImagesCss(hero?.images)
  const ref = useRef<HTMLElement>(null)
  const idle = useHeroIdle(ref)

  return (
    <section className="hero" ref={ref}>
      {imagesCss && <style>{imagesCss}</style>}
      <div className="hero-art">
        <span className="sr-only">{t('public.hero.alt')}</span>
        {/* نجوم بتقع فوق صورة الهيرو + شهاب بيعدّي كل شوية. جوّه ‎.hero-art‎ عن
            قصد: على التليفون الكلام بينزل تحت الصورة، فكده المؤثرات تفضل على
            الصورة بس ومتعديش على النص. */}
        <StarField className="hero-sparks" count={30} idle={idle} />
        <ShootingStars idle={idle} />
      </div>
      <div className="hero-copy">
        <div className="hero-copy-in" data-reveal>
          <h1>
            <span className="h1-top">{text(custom?.top, 'top')}</span>
            <span className="h1-main">{text(custom?.main, 'main')}</span>
          </h1>
          <p className="hero-sub">{text(custom?.sub, 'sub')}</p>
          <div className="hero-actions">
            <Link className="btn btn--gold btn--lg btn--shine" to="/templates">
              <span>{text(custom?.cta, 'templates')}</span>
              <svg className="btn-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 12h13m0 0-5-5m5 5-5 5" />
              </svg>
            </Link>
          </div>
          {/* القيمة جوّه ‎<span>‎ جوّه ‎<b>‎ زي الموقع القديم (وسم ‎bi‎ بيطبع span) — قاعدة
              ‎.hero-trust span‎ بتصغّرها وتخليها رمادي، ودي الصورة الفعلية في القديم. */}
          <ul className="hero-trust" aria-hidden="true">
            {trust.map((item, index) => (
              <li key={index}>
                <b>
                  <span>{item.value}</span>
                </b>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
