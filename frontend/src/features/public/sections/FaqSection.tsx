import { Fragment, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { pick, useLang } from '../text'
import type { PublicFaq } from '../types'

/** نفس ‎linebreaksbr‎: كل سطر جديد بقى ‎<br>‎، والنص نفسه بيتهرّب لوحده (React). */
function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split(/\r\n|\r|\n/).map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
)

/**
 * الأسئلة الشائعة — القسم مش بيظهر لو مفيش أسئلة.
 *
 * ديسكتوب: قائمة الأسئلة على جنب، والإجابة في كارت كبير ثابت جنبها (زي كارت دعوة).
 * موبايل: نفس القائمة، والإجابة بتفتح تحت السؤال نفسه.
 *
 * مهم: حالة «مفتوح» بتتحط في ‎data-active‎ مش في ‎className‎ — الظهور بالسكرول
 * بيضيف كلاس ‎is-in‎ بالـDOM، ولو React غيّر الـclassName الكلاس ده بيتمسح
 * والعنصر بيرجع شفاف (ده اللي كان بيخفي السؤال لما تدوس عليه).
 */
export function FaqSection({ faqs }: { faqs: PublicFaq[] | undefined }) {
  const { t } = useTranslation()
  const lang = useLang()
  const uid = useId()
  const [active, setActive] = useState(0)
  // على الموبايل: الدوسة على نفس السؤال بتقفل إجابته (السؤال نفسه بيفضل ظاهر)
  const [inlineOpen, setInlineOpen] = useState(true)
  if (!faqs?.length) return null

  const index = Math.min(active, faqs.length - 1)
  const current = faqs[index]
  const select = (i: number) => {
    if (i === index) setInlineOpen((o) => !o)
    else {
      setActive(i)
      setInlineOpen(true)
    }
  }
  const go = (step: number) => {
    setActive((index + step + faqs.length) % faqs.length)
    setInlineOpen(true)
  }

  return (
    <section className="section section--faq" id="faq">
      <div className="wrap faq">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('public.faq.eyebrow')}</p>
          <h2>{t('public.faq.title')}</h2>
          <p>{t('public.faq.lead')}</p>
        </div>

        <div className="faq-grid">
          <ol className="faq-list">
            {faqs.map((faq, i) => {
              const on = i === index
              return (
                <li className="faq-item" key={faq.id} data-reveal data-reveal-stagger data-active={on || undefined} data-open={(on && inlineOpen) || undefined}>
                  <button
                    type="button"
                    className="faq-q"
                    id={`${uid}-q-${i}`}
                    aria-expanded={on && inlineOpen}
                    aria-controls={`${uid}-a-${i}`}
                    onClick={() => select(i)}
                  >
                    <span className="faq-num" aria-hidden="true">{pad(i + 1)}</span>
                    <span className="faq-q-text">{pick(lang, faq.question, faq.questionEn)}</span>
                    <span className="faq-arrow"><Chevron /></span>
                  </button>
                  {/* إجابة الموبايل — على الديسكتوب مخفية والإجابة بتظهر في الكارت */}
                  <div className="faq-inline" id={`${uid}-a-${i}`} role="region" aria-labelledby={`${uid}-q-${i}`}>
                    <div className="faq-inline-in">
                      <p className="faq-inline-text">
                        <Lines text={pick(lang, faq.answer, faq.answerEn)} />
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="faq-stage" data-reveal>
            <article className="faq-card" key={current.id} aria-live="polite">
              <div className="faq-card-top">
                <span className="faq-card-mark" aria-hidden="true">؟</span>
                <span className="faq-card-count">
                  <b>{pad(index + 1)}</b> / {pad(faqs.length)}
                </span>
              </div>
              <h3 className="faq-card-q">{pick(lang, current.question, current.questionEn)}</h3>
              <p className="faq-card-a">
                <Lines text={pick(lang, current.answer, current.answerEn)} />
              </p>
              <div className="faq-card-foot">
                <div className="faq-card-nav">
                  <button type="button" className="faq-nav faq-nav--prev" onClick={() => go(-1)} aria-label={t('public.faq.prev')}>
                    <Chevron />
                  </button>
                  <button type="button" className="faq-nav" onClick={() => go(1)} aria-label={t('public.faq.next')}>
                    <Chevron />
                  </button>
                </div>
                <a className="faq-card-contact" href="#contact">
                  {t('public.faq.moreQuestions')} <b>{t('public.faq.contact')}</b>
                </a>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
