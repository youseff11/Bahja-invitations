import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type ToastKind = 'ok' | 'error' | 'info'

interface Ui {
  toast: (text: string, kind?: ToastKind) => void
  /** نفس ‎window.confirm‎ زي المحرر القديم */
  confirm: (text: string) => boolean
}

const UiContext = createContext<Ui | null>(null)

export function useEditorUi(): Ui {
  const ui = useContext(UiContext)
  if (!ui) throw new Error('useEditorUi must be used inside <EditorUiProvider>')
  return ui
}

interface Item {
  id: number
  text: string
  kind: ToastKind
}

/** تنبيهات المحرر (‎.ed-toasts‎) — لوحدها عشان المحرر ملوش علاقة بغلاف لوحة التحكم وCSS بتاعه. */
export function EditorUiProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const next = useRef(1)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    if (!text) return
    const id = next.current++
    setItems((current) => [...current, { id, text, kind }].slice(-4))
    const timer = setTimeout(
      () => {
        timers.current.delete(timer)
        setItems((current) => current.filter((item) => item.id !== id))
      },
      kind === 'error' ? 5200 : 2800,
    )
    timers.current.add(timer)
  }, [])

  useEffect(() => {
    const live = timers.current
    return () => live.forEach(clearTimeout)
  }, [])

  const ui = useMemo<Ui>(() => ({ toast, confirm: (text) => window.confirm(text) }), [toast])

  return (
    <UiContext.Provider value={ui}>
      {children}
      <div className="ed-toasts" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`ed-toast${item.kind === 'info' ? '' : ` ed-toast--${item.kind}`}`} role={item.kind === 'error' ? 'alert' : 'status'}>
            {item.text}
          </div>
        ))}
      </div>
    </UiContext.Provider>
  )
}
