import { useEffect, useRef } from 'react'

import { useInvite } from './context'
import type { MusicConfig } from './types'

declare global {
  interface Window {
    __lbMusic?: {
      play: () => void
      pause: () => void
      audio: HTMLAudioElement
      button: HTMLButtonElement | null
      destroy: () => void
    } | null
  }
}

/**
 * مشغّل الموسيقى — نفس ‎initMusic‎. مع شاشة افتتاحية: الأغنية **مابتبدأش** غير
 * لما الضيف يفتح الدعوة (أو يدوس تشغيل على فيديو الافتتاحية الصامت)، إلا لو
 * فعّل صاحب الدعوة ‎duringIntro‎ فتبدأ مع الافتتاحية نفسها. الزر
 * مستقل عن التمرير التلقائي: الضغطة عليه ماتطلعش للـwindow.
 */
export function Music({ config }: { config: MusicConfig }) {
  const { t } = useInvite()
  // الترجمة بتتغيّر مع اللغة، بس المشغّل مايتعاد تشغيله بسبب كده
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])
  const btn = useRef<HTMLButtonElement>(null)
  const hidden = config.player === 'hidden'

  useEffect(() => {
    const button = btn.current
    if (!config.url || hidden || !button) return
    const audio = new Audio(config.url)
    audio.loop = config.loop !== false
    audio.preload = 'none'
    let autoplayOnce: (() => void) | null = null
    let introOpenStart: (() => void) | null = null

    const setPlaying = (on: boolean) => {
      button.classList.toggle('is-playing', on)
      button.setAttribute('aria-label', on ? tRef.current('music.pause') : tRef.current('music.play'))
    }
    const play = () => {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          /* المتصفح منع التشغيل — ينتظر ضغطة المستخدم */
        })
    }
    const pause = () => {
      audio.pause()
      setPlaying(false)
    }

    const stop = (e: Event) => e.stopPropagation()
    const stopEvents = ['pointerdown', 'touchstart', 'click']
    stopEvents.forEach((name) => button.addEventListener(name, stop))
    const toggle = () => (audio.paused ? play() : pause())
    button.addEventListener('click', toggle)

    /* التشغيل التلقائي: بيشغّل، وبيسيب محاولة تانية عند أول تفاعل لو المتصفح رفض. */
    const beginAutoplay = () => {
      play()
      autoplayOnce = () => {
        if (audio.paused) play()
        document.removeEventListener('click', autoplayOnce!)
        document.removeEventListener('touchstart', autoplayOnce!)
        autoplayOnce = null
      }
      // تأخير تكّة: لو ربطنا المستمع دلوقتي نفس الضغطة (فتح الافتتاحية) هتصرفه
      window.setTimeout(() => {
        if (!autoplayOnce) return
        document.addEventListener('click', autoplayOnce, { once: true })
        document.addEventListener('touchstart', autoplayOnce, { once: true })
      }, 0)
    }

    if (config.autoplay) {
      const pendingIntro = document.querySelector('.lb-intro:not(.is-open)')
      // افتتاحية مستنية ضغطة بدء (زر تشغيل الفيديو أو غطا الكود): الموسيقى
      // مابتبدأش قبل الضغطة دي، حتى مع duringIntro
      const waitsForPress =
        pendingIntro &&
        (pendingIntro.classList.contains('is-awaiting-play') || Boolean(pendingIntro.querySelector('.lb-intro-extra')))
      if (pendingIntro && config.duringIntro && !waitsForPress) {
        // الإعداد مفعّل ومفيش زر بدء: الموسيقى تبدأ مع الافتتاحية. لو المتصفح
        // رفض، ضغطة تشغيل الفيديو الصامت (أول لمسة) بتعيد المحاولة
        beginAutoplay()
        introOpenStart = () => {
          document.removeEventListener('lb:intro-play', introOpenStart!)
          introOpenStart = null
          if (audio.paused) play()
        }
        document.addEventListener('lb:intro-play', introOpenStart)
      } else if (pendingIntro) {
        // اللي يوصل الأول بيشغّل: lb:intro-start (ضغطة زر بدء الافتتاحية، مع
        // duringIntro بس)، lb:intro-play (ضغطة تشغيل الفيديو الصامت)، و
        // lb:intro-open (الافتتاحية خلصت أو اتفتحت)
        const events = config.duringIntro
          ? ['lb:intro-start', 'lb:intro-play', 'lb:intro-open']
          : ['lb:intro-play', 'lb:intro-open']
        introOpenStart = () => {
          events.forEach((name) => document.removeEventListener(name, introOpenStart!))
          introOpenStart = null
          beginAutoplay()
        }
        events.forEach((name) => document.addEventListener(name, introOpenStart!))
      } else {
        beginAutoplay()
      }
    }

    const handle = {
      play,
      pause,
      audio,
      button,
      destroy() {
        audio.pause()
        if (autoplayOnce) {
          document.removeEventListener('click', autoplayOnce)
          document.removeEventListener('touchstart', autoplayOnce)
          autoplayOnce = null
        }
        if (introOpenStart) {
          document.removeEventListener('lb:intro-start', introOpenStart)
          document.removeEventListener('lb:intro-play', introOpenStart)
          document.removeEventListener('lb:intro-open', introOpenStart)
          introOpenStart = null
        }
        stopEvents.forEach((name) => button.removeEventListener(name, stop))
        button.removeEventListener('click', toggle)
        window.__lbMusic = null
      },
    }
    window.__lbMusic = handle
    return () => handle.destroy()
  }, [config.url, config.loop, config.autoplay, config.duringIntro, hidden])

  if (!config.url || hidden) return null
  return (
    <button
      ref={btn}
      type="button"
      className={`lb-music${config.player === 'bar' ? ' lb-music--bar' : ''}`}
      aria-label={t('music.play')}
    >
      <svg className="i-note" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17 3.5v11.6a3.6 3.6 0 1 1-2-3.2V7.2l-6 1.5v8.4a3.6 3.6 0 1 1-2-3.2V6.6L17 3.5Z" />
      </svg>
      <span className="lb-eq" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    </button>
  )
}
