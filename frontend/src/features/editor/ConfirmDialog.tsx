import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  /** إجراء خطر (حذف…): أيقونة حمراء وزرار تأكيد أحمر، والتركيز يبدأ على «إلغاء». */
  danger?: boolean
}

interface Props extends ConfirmOptions {
  message: string
  onResult: (ok: boolean) => void
}

/** بديل ‎window.confirm‎ بشكل المحرر. بيترسم جوّه ‎.ed-root‎ عشان متغيّرات الألوان (زي ‎Modal‎). */
export function ConfirmDialog({ message, title, confirmLabel, danger, onResult }: Props) {
  const { t } = useTranslation()
  const primary = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const settle = useRef(onResult)
  settle.current = onResult

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ;(danger ? cancel : primary).current?.focus()
    // Escape بتقفل التأكيد بس (مش النافذة اللي تحته)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      event.preventDefault()
      settle.current(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previous?.focus?.()
    }
  }, [danger])

  const heading = title ?? t(danger ? 'editor.confirm.dangerTitle' : 'editor.confirm.title')
  const root = document.querySelector('.ed-root') ?? document.body
  return createPortal(
    <div className="ed-modal ed-confirm" onMouseDown={(event) => event.target === event.currentTarget && onResult(false)}>
      <div className={`ed-modal-card ed-confirm-card${danger ? ' is-danger' : ''}`} role="alertdialog" aria-modal="true" aria-label={heading}>
        <span className="ed-confirm-icon" aria-hidden="true">
          {danger ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16.5v.01" />
            </svg>
          )}
        </span>
        <h3>{heading}</h3>
        <p>{message}</p>
        <div className="ed-confirm-actions">
          <button ref={cancel} type="button" className="ed-btn" onClick={() => onResult(false)}>
            {t('editor.confirm.cancel')}
          </button>
          <button
            ref={primary}
            type="button"
            className={`ed-btn ${danger ? 'ed-btn--danger-solid' : 'ed-btn--primary'}`}
            onClick={() => onResult(true)}
          >
            {confirmLabel ?? t(danger ? 'editor.confirm.delete' : 'editor.confirm.ok')}
          </button>
        </div>
      </div>
    </div>,
    root,
  )
}
