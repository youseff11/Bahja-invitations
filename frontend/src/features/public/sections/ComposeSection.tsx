import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { ComposePart, ComposeTemplate } from '../types'

/**
 * «اعملوا دعوتكم بذوقكم»: تلفون ثابت في النص، والزائر بيختار كل جزء من الدعوة
 * (افتتاحية، آية، عدّاد…) من أي قالب — بالضغط أو بالسحب بالماوس على التلفون.
 * الحتت لقطات حقيقية من القوالب (‎template.compose_pieces‎)، والقوالب اللي بتظهر
 * بيختارها الأدمن من إعدادات الموقع. مفيش حركة مستمرة: كل حاجة بتتحرك بس لما الزائر يختار.
 */

const ORDER: ComposePart[] = ['intro', 'ayah', 'invite', 'countdown', 'calendar', 'program', 'location', 'rsvp', 'closing']
const DRAG_TYPE = 'application/x-bahja-piece'

export function ComposeSection({ templates }: { templates?: ComposeTemplate[] }) {
  const { t } = useTranslation()
  const list = useMemo(() => templates ?? [], [templates])
  const parts = useMemo(() => ORDER.filter((p) => list.some((tpl) => tpl.pieces[p])), [list])
  const [choice, setChoice] = useState<Partial<Record<ComposePart, number>>>({})
  const [active, setActive] = useState<ComposePart | null>(null)
  const [flash, setFlash] = useState<ComposePart | null>(null)
  const [dropping, setDropping] = useState(false)
  const screen = useRef<HTMLDivElement>(null)
  const slots = useRef<Partial<Record<ComposePart, HTMLDivElement | null>>>({})
  const pending = useRef<ComposePart | null>(null)

  // البداية: كل جزء من أول قالب عنده الجزء ده، وبنلفّ على القوالب عشان التركيبة تبان متنوّعة
  useEffect(() => {
    const start: Partial<Record<ComposePart, number>> = {}
    parts.forEach((p, i) => {
      const owners = list.filter((tpl) => tpl.pieces[p])
      start[p] = owners[i % owners.length]?.id
    })
    setChoice(start)
    setActive(parts[0] ?? null)
  }, [list, parts])

  if (!list.length || !parts.length) return null

  const byId = new Map(list.map((tpl) => [tpl.id, tpl]))
  const name = (part: ComposePart) => t(`public.compose.parts.${part}`)

  function pick(part: ComposePart, id: number) {
    setChoice((c) => ({ ...c, [part]: id }))
    setActive(part)
    setFlash(part)
    window.setTimeout(() => setFlash((f) => (f === part ? null : f)), 900)
    // التلفون بينزل للجزء اللي اتغيّر (ومرة كمان بعد ما صورته تتحمّل وارتفاعها يتظبط)
    pending.current = part
    window.requestAnimationFrame(() => scrollToPart(part))
    window.setTimeout(() => {
      if (pending.current === part) pending.current = null
    }, 1500)
  }

  function scrollToPart(part: ComposePart) {
    const sc = screen.current
    const slot = slots.current[part]
    if (sc && slot) sc.scrollTo({ top: Math.max(0, slot.offsetTop - 8), behavior: 'smooth' })
  }

  function shuffle() {
    const next: Partial<Record<ComposePart, number>> = {}
    parts.forEach((p) => {
      const owners = list.filter((tpl) => tpl.pieces[p])
      next[p] = owners[Math.floor(Math.random() * owners.length)]?.id
    })
    setChoice(next)
    screen.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDropping(false)
    const [part, id] = (e.dataTransfer.getData(DRAG_TYPE) || '').split(':')
    if (part && id && ORDER.includes(part as ComposePart)) pick(part as ComposePart, Number(id))
  }

  const options = active ? list.filter((tpl) => tpl.pieces[active]) : []

  return (
    <section className="section section--compose" id="compose">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('public.compose.eyebrow')}</p>
          <h2>{t('public.compose.title')}</h2>
          <p>{t('public.compose.sub')}</p>
        </div>

        <div className="cmp" data-reveal>
          {/* الأجزاء */}
          <nav className="cmp-parts" aria-label={t('public.compose.partsLabel')}>
            {parts.map((part, i) => {
              const tpl = byId.get(choice[part] ?? -1)
              return (
                <button
                  key={part}
                  type="button"
                  className={'cmp-part' + (active === part ? ' is-active' : '')}
                  onClick={() => setActive(part)}
                  aria-pressed={active === part}
                >
                  <span className="cmp-part-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="cmp-part-txt">
                    <b>{name(part)}</b>
                    <small>{tpl?.name ?? '—'}</small>
                  </span>
                </button>
              )
            })}
          </nav>

          {/* التلفون */}
          <div className="cmp-phone-wrap">
            <div
              className={'cmp-phone' + (dropping ? ' is-drop' : '')}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                  e.preventDefault()
                  setDropping(true)
                }
              }}
              onDragLeave={() => setDropping(false)}
              onDrop={onDrop}
            >
              <div className="cmp-island" aria-hidden="true" />
              <div className="cmp-screen" ref={screen}>
                {parts.map((part) => {
                  const tpl = byId.get(choice[part] ?? -1)
                  const src = tpl?.pieces[part]
                  if (!src) return null
                  return (
                    <div
                      key={part}
                      ref={(el) => {
                        slots.current[part] = el
                      }}
                      className={'cmp-slot' + (flash === part ? ' is-flash' : '') + (active === part ? ' is-active' : '')}
                      onClick={() => setActive(part)}
                    >
                      <img
                        key={src}
                        src={src}
                        alt={`${name(part)} — ${tpl.name}`}
                        decoding="async"
                        onLoad={() => {
                          if (pending.current) scrollToPart(pending.current)
                        }}
                      />
                      <span className="cmp-slot-tag">
                        {name(part)} · <i>{tpl.name}</i>
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="cmp-drop-hint" aria-hidden="true">
                {t('public.compose.drop')}
              </div>
            </div>
            <button type="button" className="cmp-shuffle" onClick={shuffle}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8C14.3 15 15.5 16 17.5 16H21M17.5 4 21 7l-3.5 3M17.5 13 21 16l-3.5 3M3 16h3.5c1.1 0 2-.3 2.7-.9" />
              </svg>
              {t('public.compose.shuffle')}
            </button>
          </div>

          {/* الاختيارات للجزء المختار */}
          <div className="cmp-options">
            <p className="cmp-options-head">
              <span>{t('public.compose.choose')}</span> <b>{active ? name(active) : ''}</b>
            </p>
            <div className="cmp-grid">
              {active &&
                options.map((tpl) => {
                  const on = choice[active] === tpl.id
                  return (
                    <button
                      key={`${active}-${tpl.id}`}
                      type="button"
                      className={'cmp-opt' + (on ? ' is-on' : '')}
                      onClick={() => pick(active, tpl.id)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, `${active}:${tpl.id}`)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onDragEnd={() => setDropping(false)}
                      aria-pressed={on}
                    >
                      <span className="cmp-opt-img">
                        <img src={tpl.pieces[active]} alt="" loading="lazy" draggable={false} />
                      </span>
                      <span className="cmp-opt-name">{tpl.name}</span>
                      {on && (
                        <svg className="cmp-opt-ok" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="11" />
                          <path d="m7.5 12.3 3 3 6-6.6" />
                        </svg>
                      )}
                    </button>
                  )
                })}
            </div>
            <p className="cmp-tip">{t('public.compose.tip')}</p>
          </div>
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
