import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { prefersReducedMotion } from '../motion'

/**
 * «اعملوا دعوتكم بذوقكم»: مشهد سينمائي — حوالين موبايل في النص كروت قوالب حقيقية،
 * وكل شوية حتة من قالب (افتتاحية، آية، عدّاد…) بتطير من الكارت بتاعها وتقعد في الموبايل،
 * لحد ما دعوة جديدة تتجمّع من كذا قالب. الصور لقطات حقيقية من القوالب المنشورة.
 * الحركة بتشتغل بس والقسم ظاهر، ومع ‎prefers-reduced-motion‎ بيظهر الشكل النهائي من غير طيران.
 */

const IMG = (name: string) => `/static/images/home/${name}.webp`

type Source = { key: string; name: string }
const SOURCES: Source[] = [
  { key: 'velvet', name: 'Velvet Curtain' },
  { key: 'andalus', name: 'Andalusian Door' },
  { key: 'lantern', name: 'Lantern Nights' },
  { key: 'palacerose', name: 'Palace Rose' },
  { key: 'rosegarden', name: 'Rose Garden' },
  { key: 'shore', name: 'Turquoise Shore' },
]

type Piece = { part: string; src: string; img: string }
const COMBOS: Piece[][] = [
  [
    { part: 'intro', src: 'velvet', img: 'pc-intro-velvet' },
    { part: 'ayah', src: 'andalus', img: 'pc-ayah-andalus' },
    { part: 'countdown', src: 'lantern', img: 'pc-count-lantern' },
    { part: 'calendar', src: 'palacerose', img: 'pc-cal-palacerose' },
    { part: 'rsvp', src: 'rosegarden', img: 'pc-rsvp-rosegarden' },
    { part: 'closing', src: 'shore', img: 'pc-close-shore' },
  ],
  [
    { part: 'intro', src: 'rosegarden', img: 'pc-intro-rosegarden' },
    { part: 'ayah', src: 'palacerose', img: 'pc-ayah-palacerose' },
    { part: 'countdown', src: 'velvet', img: 'pc-count-velvet' },
    { part: 'location', src: 'shore', img: 'pc-loc-shore' },
    { part: 'closing', src: 'andalus', img: 'pc-close-andalus' },
  ],
]

const STEP = 1900 // كل حتة
const HOLD = 2600 // بعد ما الدعوة تكمل

export function ComposeSection() {
  const { t } = useTranslation()
  const stage = useRef<HTMLDivElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const feed = useRef<HTMLDivElement>(null)
  const cards = useRef<Record<string, HTMLDivElement | null>>({})
  const [combo, setCombo] = useState(0)
  const [count, setCount] = useState(0)
  const [active, setActive] = useState<string | null>(null)
  const [fading, setFading] = useState(false)
  const [visible, setVisible] = useState(false)
  const still = useRef(prefersReducedMotion())

  // بيشتغل بس والقسم في الشاشة
  useEffect(() => {
    const el = stage.current
    if (!el || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const pieces = COMBOS[combo]

  // الموبايل بينزل لوحده عشان آخر حتة تبان
  useEffect(() => {
    const sc = screen.current
    const fd = feed.current
    if (!sc || !fd) return
    const last = fd.children[count - 1] as HTMLElement | undefined
    let y = 0
    if (last) y = Math.max(0, Math.min(last.offsetTop, last.offsetTop + last.offsetHeight - sc.clientHeight))
    fd.style.transform = `translateY(${-y}px)`
  }, [count, combo])

  // الخطوات: كل خطوة حتة بتطير من كارتها للموبايل
  useEffect(() => {
    if (still.current) {
      setCount(pieces.length)
      return
    }
    if (!visible) return
    let timer = 0
    if (count < pieces.length) {
      timer = window.setTimeout(() => fly(pieces[count]), count === 0 ? 500 : STEP)
    } else {
      timer = window.setTimeout(() => {
        setFading(true)
        window.setTimeout(() => {
          setActive(null)
          setCount(0)
          setCombo((c) => (c + 1) % COMBOS.length)
          setFading(false)
        }, 700)
      }, HOLD)
    }
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, count, combo])

  function fly(p: Piece) {
    const st = stage.current
    const sc = screen.current
    const fd = feed.current
    const card = cards.current[p.src]
    setActive(p.src)
    if (!st || !sc || !fd || !card || !st.animate) {
      setCount((c) => c + 1)
      return
    }
    const s = st.getBoundingClientRect()
    const from = card.getBoundingClientRect()
    const to = sc.getBoundingClientRect()
    const ghost = document.createElement('img')
    ghost.src = IMG(p.img)
    ghost.alt = ''
    ghost.className = 'cmp-ghost'
    // مكان الوصول: عرض شاشة الموبايل، لازق في تحتها
    const w = to.width
    const slot = fd.children[pieces.indexOf(p)] as HTMLImageElement | undefined
    const ratio = slot && slot.naturalWidth ? slot.naturalHeight / slot.naturalWidth : from.height / from.width
    const h = Math.min(to.height, w * ratio)
    Object.assign(ghost.style, { left: `${to.left - s.left}px`, top: `${to.bottom - s.top - h}px`, width: `${w}px`, height: `${h}px` })
    st.appendChild(ghost)
    const sx = from.width / w
    const sy = from.height / h
    const dx = from.left - to.left
    const dy = from.top - (to.bottom - h)
    const a = ghost.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.2, offset: 0 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 40}px) scale(${(sx + 1) / 2}) rotate(-4deg)`, opacity: 1, offset: 0.45 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 1 },
      ],
      { duration: 1150, easing: 'cubic-bezier(.45,.05,.2,1)' },
    )
    a.onfinish = () => {
      setCount((c) => c + 1)
      window.setTimeout(() => ghost.remove(), 120)
    }
  }

  const left = SOURCES.slice(0, 3)
  const right = SOURCES.slice(3)
  const current = count > 0 ? pieces[Math.min(count, pieces.length) - 1] : null
  const sourceCard = (src: Source) => (
    <div
      key={src.key}
      ref={(el) => {
        cards.current[src.key] = el
      }}
      className={'cmp-src' + (active === src.key ? ' is-active' : '')}
    >
      <img src={IMG(`src-${src.key}`)} alt={src.name} loading="lazy" />
      <span>{src.name}</span>
    </div>
  )

  return (
    <section className="section section--compose" id="compose">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('public.compose.eyebrow')}</p>
          <h2>{t('public.compose.title')}</h2>
          <p>{t('public.compose.sub')}</p>
        </div>
        <div className="cmp-stage" ref={stage} data-reveal>
          <div className="cmp-col">{left.map(sourceCard)}</div>
          <div className="cmp-phone">
            <div className="cmp-notch" />
            <div className="cmp-screen" ref={screen}>
              <div className={'cmp-feed' + (fading ? ' is-fading' : '')} ref={feed}>
                {pieces.map((p, i) => (
                  <img
                    key={`${combo}-${p.img}`}
                    src={IMG(p.img)}
                    alt=""
                    loading="lazy"
                    className={i < count ? 'is-in' : undefined}
                  />
                ))}
              </div>
            </div>
            <div className={'cmp-tag' + (current && !fading ? ' is-on' : '')} aria-live="polite">
              {current && (
                <>
                  <b>{t(`public.compose.parts.${current.part}`)}</b>
                  <span>
                    {t('public.compose.from')} {SOURCES.find((s) => s.key === current.src)?.name}
                  </span>
                </>
              )}
            </div>
            <p className="cmp-yours">{t('public.compose.yours')}</p>
          </div>
          <div className="cmp-col">{right.map(sourceCard)}</div>
        </div>
        <div className="cmp-cta" data-reveal>
          <a className="btn btn--ghost" href="#templates">
            {t('public.compose.cta')}
          </a>
        </div>
      </div>
    </section>
  )
}
