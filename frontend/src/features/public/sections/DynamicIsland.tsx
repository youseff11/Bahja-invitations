import { useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * الـ Dynamic Island بتاع تلفون عرض القوالب بيبقى مشغّل مزيكا القالب (زي الآيفون):
 * - القالب مالوش مزيكا: حبة سودا ساكتة زي ما هي.
 * - فيه مزيكا وواقفة: بتعرض صورة صغيرة وزرار تشغيل.
 * - شغّالة: بتتمد وعليها الغلاف وموجات صوت بتتحرك.
 * - ضغطة وهي شغّالة: بتتفتح كبيرة بحركة سوستة (الاسم، شريط التقدّم، إيقاف/تشغيل) وبتقفل لوحدها.
 * المشغّل نفسه جوه المعاينة (‎window.__lbMusic‎ في ‎Music.tsx‎) — نفس الموقع فبنكلّمه مباشرة،
 * وزراره الأصلي جوه التلفون مستخبي.
 */

type Player = NonNullable<Window['__lbMusic']>

interface Props {
  frame: RefObject<HTMLIFrameElement | null>
  /** بيزيد مع كل تحميل للمعاينة: إشارة إن فيه مشغّل جديد ندوّر عليه */
  loaded: number
  cover: string | null
  name: string
}

const OPEN_FOR = 5000

export function DynamicIsland({ frame, loaded, cover, name }: Props) {
  const { t } = useTranslation()
  const [has, setHas] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const player = useRef<Player | null>(null)
  const openRef = useRef(false)
  useEffect(() => {
    openRef.current = open
  }, [open])

  // بندوّر على المشغّل بعد كل تحميل (React جوه المعاينة بيعمله بعد ما الصفحة تخلص)
  useEffect(() => {
    setHas(false)
    setPlaying(false)
    setOpen(false)
    setProgress(0)
    player.current = null
    if (!loaded) return
    let timer = 0
    let tries = 0
    let detach = () => {}
    const attach = () => {
      let found: Player | null | undefined
      try {
        found = (frame.current?.contentWindow as Window | null)?.__lbMusic
      } catch {
        return
      }
      if (!found) {
        if (++tries < 40) timer = window.setTimeout(attach, 300)
        return
      }
      const m = found
      player.current = m
      const sync = () => {
        setPlaying(!m.audio.paused)
        if (openRef.current && m.audio.duration) setProgress(m.audio.currentTime / m.audio.duration)
      }
      const events = ['play', 'playing', 'pause', 'ended', 'timeupdate'] as const
      events.forEach((e) => m.audio.addEventListener(e, sync))
      detach = () => events.forEach((e) => m.audio.removeEventListener(e, sync))
      setHas(true)
      sync()
    }
    attach()
    return () => {
      window.clearTimeout(timer)
      detach()
    }
  }, [loaded, frame])

  // المفتوحة بتقفل لوحدها بعد شوية
  useEffect(() => {
    if (!open) return
    const m = player.current
    if (m?.audio.duration) setProgress(m.audio.currentTime / m.audio.duration)
    const timer = window.setTimeout(() => setOpen(false), OPEN_FOR)
    return () => window.clearTimeout(timer)
  }, [open, playing])

  const toggle = () => {
    const m = player.current
    if (!m) return
    if (m.audio.paused) m.play()
    else m.pause()
  }

  function onIsland() {
    if (!has) return
    if (!playing && !open) toggle()
    else setOpen((v) => !v)
  }

  const state = !has ? '' : open ? ' is-open' : playing ? ' is-playing' : ' is-music'
  return (
    <div
      className={'sc-island' + state}
      onClick={onIsland}
      role={has ? 'button' : undefined}
      tabIndex={has ? 0 : undefined}
      aria-label={has ? (playing ? t('public.showcase.musicPause') : t('public.showcase.musicPlay')) : undefined}
      aria-hidden={has ? undefined : true}
      onKeyDown={(e) => {
        if (has && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onIsland()
        }
      }}
    >
      {has && (
        <>
          <span className="sc-island-art">{cover && <img src={cover} alt="" />}</span>
          <span className="sc-island-text">
            <b>{name}</b>
            <small>{t('public.showcase.music')}</small>
          </span>
          <span className={'sc-island-wave' + (playing ? ' is-on' : '')} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="sc-island-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(progress * 1000) / 10}%` }} />
          </span>
          <button
            type="button"
            className="sc-island-toggle"
            tabIndex={-1}
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation()
              toggle()
            }}
          >
            {playing ? (
              <svg viewBox="0 0 24 24">
                <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
                <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M7.5 4.8v14.4a1 1 0 0 0 1.5.86l11.4-7.2a1 1 0 0 0 0-1.72L9 3.94a1 1 0 0 0-1.5.86Z" />
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  )
}
