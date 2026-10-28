import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useLang } from '../text'

/** عدّاد حيّ بيعدّ تنازلياً من رقم ثابت: نفس شكل اللي هيشوفه الضيف في الدعوة. */
const COUNTDOWN_START = 126 * 86400 + 7 * 3600 + 42 * 60 + 18

function CountdownArt() {
  const { t } = useTranslation()
  const lang = useLang()
  const [left, setLeft] = useState(COUNTDOWN_START)
  useEffect(() => {
    const end = Date.now() + COUNTDOWN_START * 1000
    const id = window.setInterval(() => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000))), 1000)
    return () => window.clearInterval(id)
  }, [])
  const two = (n: number) =>
    n.toLocaleString(lang === 'en' ? 'en-US' : 'ar-EG', { minimumIntegerDigits: 2, useGrouping: false })
  const parts = [
    ['days', Math.floor(left / 86400)],
    ['hours', Math.floor((left % 86400) / 3600)],
    ['minutes', Math.floor((left % 3600) / 60)],
    ['seconds', left % 60],
  ] as const
  return (
    <div className="art-count">
      {parts.map(([unit, value]) => (
        <div className="art-count-unit" key={unit}>
          <b>{two(value)}</b>
          <small>{t(`public.features.units.${unit}`)}</small>
        </div>
      ))}
    </div>
  )
}

/** QR مرسوم بالخلايا (شكل بس): ‎1‎ = خلية مليانة. */
const QR_ROWS = ['1110111', '1010101', '1110110', '0001011', '1101101', '0111001', '1010111']
function Qr({ scan }: { scan?: boolean }) {
  return (
    <div className="art-qr">
      {QR_ROWS.flatMap((row, y) =>
        [...row].map((cell, x) => <i key={`${y}-${x}`} className={cell === '1' ? 'on' : undefined} />),
      )}
      {scan && <span className="art-qr-scan" />}
    </div>
  )
}

function CalendarArt() {
  const lang = useLang()
  const day = (n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'ar-EG', { minimumIntegerDigits: 2, useGrouping: false })
  return (
    <div className="art-cal">
      <div className="art-cal-top">
        <i />
        <i />
      </div>
      <div className="art-cal-num">
        <b>{day(7)}</b>
        <b>{day(8)}</b>
      </div>
      <div className="art-cal-dots">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} className={i === 8 ? 'on' : undefined} />
        ))}
      </div>
    </div>
  )
}

const ART: Record<string, () => ReactNode> = {
  countdown: () => <CountdownArt />,
  rsvp: () => (
    <div className="art-rsvp">
      {[0, 1, 2].map((i) => (
        <div className="art-rsvp-row" key={i} style={{ ['--i' as string]: i }}>
          <i />
          <span />
        </div>
      ))}
    </div>
  ),
  whatsapp: () => (
    <div className="art-chat">
      <span className="art-bubble art-bubble--in" />
      <span className="art-bubble art-bubble--out" />
      <svg className="art-plane" viewBox="0 0 24 24">
        <path d="M20 4 4.5 10.2c-.8.3-.8 1.4 0 1.7l5.1 1.9 1.9 5.1c.3.8 1.4.8 1.7 0L20 4Z" />
      </svg>
    </div>
  ),
  music: () => (
    <div className="art-eq">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <i key={i} style={{ ['--i' as string]: i }} />
      ))}
    </div>
  ),
  gallery: () => (
    <div className="art-photos">
      <span className="ph ph--1" />
      <span className="ph ph--2" />
      <span className="ph ph--3" />
    </div>
  ),
  maps: () => (
    <div className="art-map">
      <span className="art-map-road" />
      <span className="art-map-ring" />
      <svg className="art-map-pin" viewBox="0 0 24 24">
        <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.4" />
      </svg>
    </div>
  ),
  qr: () => <Qr scan />,
  calendar: () => <CalendarArt />,
  venueQr: () => (
    <div className="art-ticket">
      <Qr />
      <div className="art-ticket-lines">
        <span />
        <span />
        <span />
      </div>
      <svg className="art-ticket-ok" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="m7.5 12.3 3 3 6-6.6" />
      </svg>
    </div>
  ),
}

/** الترتيب والمقاس على الشبكة (٤ أعمدة): العريض بياخد عمودين. */
const TILES: { key: string; wide?: boolean; tone?: 'accent' | 'dark' }[] = [
  { key: 'countdown', wide: true, tone: 'accent' },
  { key: 'rsvp' },
  { key: 'whatsapp' },
  { key: 'music' },
  { key: 'gallery', wide: true },
  { key: 'maps' },
  { key: 'qr' },
  { key: 'calendar' },
  { key: 'venueQr', wide: true, tone: 'dark' },
]

export function FeaturesSection() {
  const { t } = useTranslation()
  return (
    <section className="section section--features" id="features">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('public.features.eyebrow')}</p>
          <h2>{t('public.features.title')}</h2>
          <p>{t('public.features.sub')}</p>
        </div>
        <div className="bento">
          {TILES.map(({ key, wide, tone }) => (
            <article
              key={key}
              className={['bento-tile', `bento-${key}`, wide && 'bento-wide', tone && `bento-${tone}`]
                .filter(Boolean)
                .join(' ')}
              data-reveal
              data-reveal-stagger
            >
              <div className="bento-art" aria-hidden="true">
                {ART[key]()}
              </div>
              <div className="bento-copy">
                <h3>{t(`public.features.${key}.title`)}</h3>
                <p>{t(`public.features.${key}.text`)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
