import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useEditor } from '../store'
import type { FieldProps } from './registry'

const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * نقطة بداية الأغنية (‎music_start‎): شريط على طول الأغنية بيتسحب بالماوس، وزر
 * «سمّع من هنا» بيشغّلها من الموضع ده، ولو بتسمع وبتسحب بتتحرك معاك.
 */
export function AudioStartBody({ value, onChange, id }: FieldProps) {
  const { t } = useTranslation()
  const url = useEditor((s) => String(s.doc.settings.music_url ?? ''))
  const audio = useRef<HTMLAudioElement | null>(null)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const start = Number(value) || 0

  useEffect(() => {
    setDuration(0)
    setFailed(false)
    setPlaying(false)
    if (!url) return
    const el = new Audio()
    el.preload = 'metadata'
    el.addEventListener('loadedmetadata', () => setDuration(Number.isFinite(el.duration) ? el.duration : 0))
    el.addEventListener('error', () => setFailed(true))
    el.addEventListener('pause', () => setPlaying(false))
    el.addEventListener('play', () => setPlaying(true))
    el.src = url
    audio.current = el
    return () => {
      el.pause()
      el.removeAttribute('src')
      audio.current = null
    }
  }, [url])

  if (!url) return <p className="ed-hint">{t('editorAssets.field.audioStart.needSong')}</p>

  const seek = (sec: number) => {
    onChange(sec)
    if (audio.current && !audio.current.paused) audio.current.currentTime = sec
  }
  const toggle = () => {
    const el = audio.current
    if (!el) return
    if (!el.paused) return el.pause()
    el.currentTime = start
    void el.play().catch(() => setFailed(true))
  }

  return (
    <div>
      <div className="ed-row">
        <input
          id={id}
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          step={1}
          value={start}
          disabled={!duration}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <b dir="ltr">
          {clock(start)}
          {duration ? ` / ${clock(duration)}` : ''}
        </b>
      </div>
      <button type="button" className="ed-btn ed-btn--sm" disabled={!duration} onClick={toggle}>
        {playing ? t('editorAssets.field.audioStart.stop') : t('editorAssets.field.audioStart.preview')}
      </button>
      {failed && <small>{t('editorAssets.field.audioStart.failed')}</small>}
    </div>
  )
}
