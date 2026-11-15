import { useTranslation } from 'react-i18next'

const STEPS = ['pick', 'send', 'design', 'link'] as const

export function StepsSection() {
  const { t } = useTranslation()
  return (
    <section className="section section--alt" id="how">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('public.steps.eyebrow')}</p>
          <h2>{t('public.steps.title')}</h2>
        </div>
        {/* ‎data-reveal‎ على الشبكة كلها: أول ما تدخل الشاشة القطع بتتركّب مع بعض */}
        <div className="grid grid--4 steps" data-reveal>
          {STEPS.map((step, i) => (
            <div className="step" key={step}>
              <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t(`public.steps.${step}.title`)}</h3>
              <p className="muted">{t(`public.steps.${step}.text`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
