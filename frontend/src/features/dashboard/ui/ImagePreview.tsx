import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export interface PreviewImage {
  name: string
  url: string
}

/** نافذة عرض الصورة بحجمها الكامل: بتتقفل بـ‎Escape‎ أو بالضغط برّه. */
export function ImagePreviewDialog({ image, onClose }: { image: PreviewImage; onClose: () => void }) {
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
      <div className="dash-dialog image-dialog" role="dialog" aria-modal="true" aria-label={image.name}>
        <img className="image-dialog-img" src={image.url} alt={image.name} />
        <div className="image-dialog-foot">
          <strong>{image.name}</strong>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            {t('dashboard.common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
