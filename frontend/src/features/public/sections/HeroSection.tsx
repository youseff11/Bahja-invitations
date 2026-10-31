import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import type { HeroInfo } from '@/api/types'

import { ShootingStars, StarField } from '../fx'
import { useLang } from '../text'
import { useHeroIdle } from '../useHeroIdle'
import { registerHeroImages } from '../warm'

// السيرفر بيرجّع الرابط متشفّر أصلاً (أسماء الملفات العربي: %D8%A7…)، فنفك ثم نشفّر مرة واحدة
// بدل ما ‎encodeURI‎ يشفّر الـ‎%‎ نفسها ويخلّي الرابط ٤٠٤.
const once = (url: string) => {
  if (!url) return url
  try {
    return encodeURI(decodeURI(url))
  } catch {
    return encodeURI(url)
  }
}

/** خلفيات الهيرو المخصّصة: نفس تدرّج الـselectors في public.css (والأحدث في الترتيب بيكسب) */
function heroImagesCss(images: HeroInfo['images'] | undefined): string {
  if (!images) return ''
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
  const imagesCss = heroImagesCss(hero?.images)
  const ref = useRef<HTMLElement>(null)
  const idle = useHeroIdle(ref)
  const images = hero?.images
  // الصور المخصّصة بتتسخّن في الكاش عشان تبديل المظهر مايستناش تنزيلها
  useEffect(() => {
    if (!images) return
    registerHeroImages({
      lightAr: once(images.lightAr),
      lightEn: once(images.lightEn),
      darkAr: once(images.darkAr),
      darkEn: once(images.darkEn),
    })
    return () => registerHeroImages(null)
  }, [images])

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
        {/* جملة واحدة في نص الصورة + زرار واحد. السطر الصغير والوصف وأرقام الثقة
            اتشالوا عن قصد: الصورة بتتكلم، والكلام الكتير كان بيزحمها. */}
        <div className="hero-copy-in" data-reveal>
          <h1>{text(custom?.main, 'main')}</h1>
          <div className="hero-actions">
            <Link className="btn btn--gold btn--lg btn--shine" to={{ pathname: '/', hash: '#templates' }}>
              <span>{text(custom?.cta, 'templates')}</span>
              <svg className="btn-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 12h13m0 0-5-5m5 5-5 5" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
