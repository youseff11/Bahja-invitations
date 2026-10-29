import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface ConfirmOptions {
  message: string
  confirmLabel?: string
  /** يلوّن زرار التأكيد كإجراء خطر (حذف). */
  danger?: boolean
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

/** بديل ‎window.confirm‎: ‎const confirm = useConfirm(); if (await confirm({ message })) …‎ */
export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<Pending | null>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  const confirm = useCallback<Confirm>((options) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }))
  }, [])

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok)
      setPending(null)
      opener.current?.focus?.()
    },
    [pending],
  )

  useEffect(() => {
    if (!pending) return
    confirmButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settle(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending, settle])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="dash-dialog-veil"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) settle(false)
          }}
        >
          <div className="dash-dialog" role="alertdialog" aria-modal="true" aria-label={pending.message}>
            <span className={`dash-dialog-icon${pending.danger ? ' is-danger' : ''}`} aria-hidden="true">
              {pending.danger ? (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16.5v.01" />
                </svg>
              )}
            </span>
            <h3>{t(pending.danger ? 'dashboard.common.dangerTitle' : 'dashboard.common.confirmTitle')}</h3>
            <p>{pending.message}</p>
            <div className="dash-dialog-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => settle(false)}>
                {t('dashboard.common.cancel')}
              </button>
              <button
                ref={confirmButton}
                type="button"
                className={`btn btn--sm ${pending.danger ? 'btn--danger-solid' : 'btn--gold'}`}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? t('dashboard.common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
