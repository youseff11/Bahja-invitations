import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export interface PreviewClip {
  name: string
  url: string
  posterUrl: string
}

/** مصغّرة فيديو (أول فريم) بزرار تشغيل — بتفتح ‎VideoPreviewDialog‎ بالضغط عليها. */
export function VideoThumb({ clip, onPlay }: { clip: PreviewClip; onPlay: () => void }) {
  const { t } = useTranslation()
  if (!clip.url) return <span className="muted">—</span>
  return (
    <button type="button" className="video-thumb" aria-label={t('dashboard.common.play', { name: clip.name })} onClick={onPlay}>
      {/* ‎#t=0.1‎ + ‎preload=metadata‎: المتصفح يعرض أول فريم حتى لو مفيش غلاف محفوظ */}
      <video
        src={`${clip.url}#t=0.1`}
        poster={clip.posterUrl || undefined}
        preload="metadata"
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
      />
      <span className="video-thumb-play" aria-hidden="true">
        ▶
      </span>
    </button>
  )
}

/** نافذة تشغيل الفيديو: بتتقفل بـ‎Escape‎ أو بالضغط برّه. */
export function VideoPreviewDialog({ clip, onClose }: { clip: PreviewClip; onClose: () => void }) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="dash-dialog-veil"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dash-dialog video-dialog" role="dialog" aria-modal="true" aria-label={clip.name}>
        <video className="video-dialog-player" src={clip.url} poster={clip.posterUrl || undefined} controls autoPlay playsInline />
        <div className="video-dialog-foot">
          <strong>{clip.name}</strong>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            {t('dashboard.common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
