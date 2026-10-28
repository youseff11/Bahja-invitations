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
