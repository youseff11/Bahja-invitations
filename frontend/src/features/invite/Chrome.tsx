import { useEffect, useRef, useState } from 'react'

import { useInvite } from './context'
import { SocialLink } from './svg'
import type { InviteLang, PreviewCta } from './types'

/**
 * زرار اللغة — بيظهر بس لو المصمّم كتب نسخة تانية فعلاً. الرابط (‎?lang=‎) يفضل
 * موجود عشان المشاركة والفتح المباشر يشتغلوا بنفس اللغة؛ والضغطة بتبدّل المحتوى
 * في الصفحة من غير إعادة تحميل.
 */
export function LangToggle({
  altLang,
  onSwitch,
  busy,
}: {
  altLang: InviteLang
  onSwitch: (lang: InviteLang) => void
  busy: boolean
}) {
  const { lang, t } = useInvite()
  return (
    <a
      className="lb-lang"
      data-lang-toggle
      href={`?lang=${altLang}`}
      hrefLang={altLang}
      aria-label={lang === 'en' ? t('lang.toAr') : t('lang.toEn')}
      aria-busy={busy || undefined}
      onClick={(e) => {
        e.preventDefault()
        if (!busy) onSwitch(altLang)
      }}
    >
      {lang === 'en' ? 'ع' : 'EN'}
    </a>
  )
}

/**
 * زرار «عودة للموقع» — بيظهر في معاينة القالب بس، فوق الافتتاحية كمان عشان الزائر
 * اللي فتح المعاينة من تبويب جديد يلاقي طريق الرجوع من أول شاشة.
 */
export function BackToSite({ siteUrl }: { siteUrl: string }) {
  const { t } = useInvite()
  // الرابط المطلق جاي من السيرفر؛ لو فاضي نرجع للجذر
  const home = `${siteUrl.replace(/#.*$/, '') || '/'}#templates`
  return (
    <a className="lb-back" data-back-to-site href={home}>
      <svg className="lb-back-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
      <span className="lb-back-label">{t('back.toSite')}</span>
    </a>
  )
}

/**
 * زرار «نسخ رابط الدعوة» في معاينة القالب — فوق على الناحية المقابلة لزرار الرجوع.
 * بينسخ الرابط بس (من غير قائمة مشاركة الجهاز) ويقلب لعلامة صح لحظة.
 */
export function ShareTemplate() {
  const { t } = useInvite()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onShare = () => {
    const url = location.href.replace(/#.*$/, '')
    const write = navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard'))
    write
      .then(() => {
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        window.prompt(t('share.prompt'), url)
      })
  }

  return (
    <button type="button" className="lb-share-fab" data-share-template onClick={onShare} aria-label={copied ? t('share.copied') : t('share.copyLink')} title={t('share.copyLink')}>
      {copied ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
    </button>
  )
}

/** شريط «عجبك القالب؟» — بيظهر في معاينة القالب بس. */
export function PreviewCtaBar({ cta }: { cta: PreviewCta }) {
  const { t } = useInvite()
  return (
    <div className="lb-cta" data-preview-cta>
      <div className="lb-cta-inner">
        <p className="lb-cta-text">
          {cta.text}
          {cta.template_name && (
            <>
              {' '}
              <strong className="lb-cta-name">{cta.template_name}</strong>
            </>
          )}
        </p>
        <div className="lb-cta-links">
          {cta.whatsapp && (
            <SocialLink name="whatsapp" href={cta.whatsapp} color="#25D366" size={30} label={t('cta.whatsapp')} />
          )}
          {cta.facebook && (
            <SocialLink name="facebook" href={cta.facebook} color="#1877F2" size={30} label={t('cta.facebook')} />
          )}
        </div>
      </div>
    </div>
  )
}
