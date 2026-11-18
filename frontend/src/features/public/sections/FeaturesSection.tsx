import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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

/** لقطة حقيقية من قالب منشور (مقصوصة على الجزء المهم)، بتقرّب بالراحة لما الكارت يظهر. */
function RealArt({ img, from, pos = '50% 50%' }: { img: string; from: string; pos?: string }) {
  return (
    <div className="art-real">
      <img src={`/static/images/home/${img}.webp`} alt="" loading="lazy" style={{ objectPosition: pos }} />
      <span className="art-real-from">{from}</span>
    </div>
  )
}

const ART: Record<string, () => ReactNode> = {
  countdown: () => <RealArt img="ft-countdown" from="Lantern Nights" pos="50% 88%" />,
  rsvp: () => <RealArt img="ft-rsvp" from="Rose Garden" pos="50% 20%" />,
  whatsapp: () => (
    <div className="art-wa">
      <div className="art-wa-bubble">
        <img src="/static/images/home/ft-chat.webp" alt="" loading="lazy" />
        <div className="art-wa-meta">
          <b>Omar &amp; Nour</b>
          <span>bahja-invitations.com</span>
        </div>
        <i className="art-wa-time">
          9:41
          <svg viewBox="0 0 18 12" aria-hidden="true">
            <path d="M1 6.5 4.5 10 11 2.5M7 9.5l.6.5L14 2.5" />
          </svg>
        </i>
      </div>
    </div>
  ),
  music: () => (
    <div className="art-eq">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <i key={i} style={{ ['--i' as string]: i }} />
      ))}
    </div>
  ),
  gallery: () => <RealArt img="ft-gallery" from="Lantern Nights" pos="50% 55%" />,
  maps: () => <RealArt img="ft-map" from="Rose Garden" pos="50% 40%" />,
  qr: () => <Qr scan />,
  calendar: () => <RealArt img="ft-calendar" from="Palace Rose" pos="50% 30%" />,
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

/** الترتيب والمقاس على الشبكة (٤ أعمدة): العريض بياخد عمودين.
    الترتيب ماشي مع رحلة الضيف: توصله الدعوة ← يأكد ← يتفرّج ← يوصل القاعة ← يدخل. */
const TILES: { key: string; wide?: boolean; tone?: 'accent' | 'dark' }[] = [
  { key: 'whatsapp' },
  { key: 'countdown', wide: true, tone: 'accent' },
  { key: 'rsvp' },
  { key: 'gallery', wide: true },
  { key: 'music' },
  { key: 'calendar' },
  { key: 'maps' },
  { key: 'qr' },
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
          {TILES.map(({ key, wide, tone }, index) => (
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
              <span className="bento-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
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
