import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ComposeTemplate, PublicTemplate } from '../types'

/**
 * «جرّبوا القالب قبل ما تختاروه»: تلفون في النص بيشغّل القالب الحقيقي نفسه (معاينته الحية
 * بالافتتاحية والحركة والتمرير)، والزائر بيختار القالب من الكروت اللي حواليه.
 * القوالب اللي بتظهر بيختارها الأدمن من إعدادات الموقع (‎compose_template_ids‎).
 * المعاينة مابتتحمّلش غير لما القسم يقرب من الشاشة، والأزرار اللي بتخرّج من المعاينة
 * (رجوع للموقع، نسخ الرابط، شريط التواصل) بتستخبى جوه التلفون بس.
 */

const PHONE_W = 390 // عرض الشاشة اللي القالب بيترسم عليه جوه التلفون (زي الموبايل بالظبط)
const PHONE_H = 844
const HIDE_IN_PHONE = '.lb-back,.lb-share-fab,.lb-cta,.lb-autoscroll{display:none!important}'

const previewUrl = (slug: string) => `/templates/${slug}/preview/`

export function ComposeSection({ templates, gallery }: { templates?: ComposeTemplate[]; gallery?: PublicTemplate[] }) {
  const { t } = useTranslation()
  const list = templates ?? []
  const [active, setActive] = useState<string | null>(null)
  const [near, setNear] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(0.7)
  const section = useRef<HTMLElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!active && list.length) setActive(list[0].slug)
  }, [list, active])

  // المعاينة تتحمّل بس لما القسم يقرب (عشان ماتتقّلش الصفحة الرئيسية)
  useEffect(() => {
    const el = section.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
    // القسم بيترسم بس بعد ما البيانات توصل، فبنبدأ المراقبة ساعتها
  }, [list.length])

  // القالب بيترسم على ٣٩٠×٨٤٤ وبيتصغّر على مقاس شاشة التلفون
  useEffect(() => {
    const el = screen.current
    if (!el) return
    const fit = () => el.clientWidth && setScale(el.clientWidth / PHONE_W)
    fit()
    const ro = 'ResizeObserver' in window ? new ResizeObserver(fit) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [list.length])

  if (!list.length) return null

  const cover = (tpl: ComposeTemplate) =>
    gallery?.find((g) => g.slug === tpl.slug)?.cover || tpl.pieces.intro?.src || ''
  const current = list.find((tpl) => tpl.slug === active)

  function choose(slug: string) {
    if (slug === active) return
    setLoading(true)
    setActive(slug)
  }

  function onFrameLoad() {
    setLoading(false)
    try {
      const doc = frame.current?.contentDocument
      if (doc && !doc.getElementById('bahja-phone-hide')) {
        const style = doc.createElement('style')
        style.id = 'bahja-phone-hide'
        style.textContent = HIDE_IN_PHONE
        doc.head.appendChild(style)
      }
    } catch {
      /* نفس الموقع دايمًا — لو حصل أي حاجة المعاينة بتفضل شغّالة بأزرارها */
    }
  }

  const half = Math.ceil(list.length / 2)
  const card = (tpl: ComposeTemplate) => (
    <button
      key={tpl.slug}
      type="button"
      className={'cmp-src' + (tpl.slug === active ? ' is-active' : '')}
      onClick={() => choose(tpl.slug)}
      aria-pressed={tpl.slug === active}
    >
      <span className="cmp-src-img">{cover(tpl) && <img src={cover(tpl)} alt="" loading="lazy" />}</span>
      <span className="cmp-src-name">{tpl.name}</span>
    </button>
  )

  return (
    <section className="section section--compose" id="compose" ref={section}>
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('public.compose.eyebrow')}</p>
          <h2>{t('public.compose.title')}</h2>
          <p>{t('public.compose.sub')}</p>
        </div>

        <div className="cmp" data-reveal>
          <div className="cmp-side">{list.slice(0, half).map(card)}</div>

          <div className="cmp-phone-wrap">
            <div className="cmp-phone">
              <div className="cmp-island" aria-hidden="true" />
              <div className="cmp-screen" ref={screen}>
                {near && current && (
                  <iframe
                    key={current.slug}
                    ref={frame}
                    className="cmp-frame"
                    src={previewUrl(current.slug)}
                    title={current.name}
                    loading="lazy"
                    onLoad={onFrameLoad}
                    style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}
                  />
                )}
                <div className={'cmp-loading' + (loading ? ' is-on' : '')} aria-hidden="true">
                  {current && cover(current) && <img src={cover(current)} alt="" />}
                  <span className="cmp-spin" />
                </div>
              </div>
            </div>
            {current && (
              <div className="cmp-now">
                <span>{t('public.compose.now')}</span> <b>{current.name}</b>
              </div>
            )}
            {current && (
              <a className="btn btn--gold btn--sm cmp-open" href={previewUrl(current.slug)} target="_blank" rel="noopener">
                {t('public.compose.open')}
              </a>
            )}
          </div>

          <div className="cmp-side">{list.slice(half).map(card)}</div>
        </div>
        <p className="cmp-tip" data-reveal>
          {t('public.compose.tip')}
        </p>
      </div>
    </section>
  )
}
