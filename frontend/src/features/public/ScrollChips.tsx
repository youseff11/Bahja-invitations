import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * صف أزرار التصنيفات: لو مااتّسعش في العرض بيتسحب أفقيًا وبيظهر له سهمين
 * تقليب (يمين وشمال حقيقيين، بيشتغلوا في RTL و LTR). السهم بيختفي لما
 * الصف يوصل لحافته، ولو الأزرار كلها باينة مفيش أسهم خالص.
 */
export function ScrollChips({ children, label }: { children: ReactNode; label?: string }) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // في RTL الـscrollLeft سالب (٠ عند البداية اليمين)، فبنحوّله لمسافة من الحافة الشمال
    const fromLeft = getComputedStyle(el).direction === 'rtl' ? max + el.scrollLeft : el.scrollLeft
    const next = { left: fromLeft > 2, right: max - fromLeft > 2 }
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next))
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(el)
    if (el.firstElementChild) observer?.observe(el.firstElementChild)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, children])

  const scroll = (dir: -1 | 1) => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: 'smooth' })
  }

  return (
    <div className="chips">
      {edges.left && (
        <button
          type="button"
          className="chips-arrow chips-arrow--left"
          aria-label={t('public.templates.scrollLeft')}
          onClick={() => scroll(-1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      <div className="chips-track" ref={track} onScroll={measure} role="group" aria-label={label}>
        <div className="chips-row">{children}</div>
      </div>
      {edges.right && (
        <button
          type="button"
          className="chips-arrow chips-arrow--right"
          aria-label={t('public.templates.scrollRight')}
          onClick={() => scroll(1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
