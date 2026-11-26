import { useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * إرشادات فوق شاشة تلفون عرض القوالب، عشان الزائر يفهم إن الدعوة جوه التلفون شغّالة بجد:
 * ١) الافتتاحية لسه مقفولة: إيد بتضغط ودواير بتتمد + «اضغطوا لفتح الدعوة».
 * ٢) بعد ما تتفتح: إيد بتسحب لفوق (أو ماوس بعجلة على الكمبيوتر) + الدعوة نفسها بتنزل شوية
 *    وترجع لوحدها (معاينة للتمرير)، ومؤشر رفيع على جنب الشاشة بيقول فين إنت من الدعوة.
 * أول ما الزائر يلمس/يمرّر جوه التلفون الإرشاد بيختفي، واللي اتعلّمه مايتكررش مع القوالب التانية.
 * الطبقة كلها ‎pointer-events: none‎ — الضغطات بتعدّي للمعاينة عادي.
 */

interface Props {
  frame: RefObject<HTMLIFrameElement | null>
  /** بيزيد مع كل تحميل للمعاينة */
  loaded: number
  slug: string
}

type Mode = '' | 'tap' | 'scroll'

/** اللي الزائر عمله مرة خلاص فهمه — على مستوى الصفحة كلها مش القالب */
const learned = { tap: false, scroll: false }

const SCROLL_HINT_FOR = 9000

export function PhoneHints({ frame, loaded, slug }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('')
  const [inView, setInView] = useState(false)
  const [scrollable, setScrollable] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const modeRef = useRef<Mode>('')
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  // الإرشاد مايشتغلش والتلفون برّه الشاشة (المعاينة كانت هتنزل وترجع ومحدش شايف)
  useEffect(() => {
    const el = host.current
    if (!el || !('IntersectionObserver' in window)) return setInView(true)
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.55 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // قالب جديد: نبدأ من الأول
  useEffect(() => {
    setMode('')
    setScrollable(false)
  }, [slug])

  // بعد كل تحميل: نستنّى الدعوة تترسم جوه المعاينة، ونشوف الافتتاحية مقفولة ولا لأ
  useEffect(() => {
    if (!loaded) return
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
    let detach = () => {}
    let tries = 0

    const attach = () => {
      let win: Window | null = null
      let doc: Document | null = null
      try {
        win = frame.current?.contentWindow ?? null
        doc = frame.current?.contentDocument ?? null
      } catch {
        return
      }
      if (!win || !doc || !doc.querySelector('.lb-doc')) {
        if (++tries < 40) later(attach, 250)
        return
      }
      const w = win
      const d = doc
      const root = d.scrollingElement || d.documentElement

      const measure = () => {
        const max = root.scrollHeight - w.innerHeight
        if (thumb.current && max > 0) {
          const p = Math.min(1, Math.max(0, root.scrollTop / max))
          thumb.current.style.transform = `translateY(${p * 400}%)`
        }
        return max
      }
      const afterOpen = () => {
        later(() => {
          setScrollable(measure() > 80)
          if (!learned.scroll) setMode('scroll')
        }, 1100)
      }
      const onOpen = () => {
        learned.tap = true
        setMode('')
        afterOpen()
      }

      // أي لمسة جوه المعاينة = الزائر فهم، فالإرشاد بيختفي على طول — حتى لو الافتتاحية
      // لسه بتشتغل (فيديو بيكمّل قبل ما تتفتح)؛ التمرير بإيده (عجلة/سحب) = اتعلّم التمرير
      let touched = false
      const onTouch = () => {
        touched = true
        if (modeRef.current === 'tap') learned.tap = true
        if (modeRef.current) setMode('')
      }
      const onScrollIntent = () => {
        learned.scroll = true
        if (modeRef.current === 'scroll') setMode('')
      }
      const onScroll = () => measure()

      d.addEventListener('lb:intro-open', onOpen)
      d.addEventListener('pointerdown', onTouch, { passive: true, capture: true })
      d.addEventListener('wheel', onScrollIntent, { passive: true })
      d.addEventListener('touchmove', onScrollIntent, { passive: true })
      w.addEventListener('scroll', onScroll, { passive: true })
      detach = () => {
        d.removeEventListener('lb:intro-open', onOpen)
        d.removeEventListener('pointerdown', onTouch, true)
        d.removeEventListener('wheel', onScrollIntent)
        d.removeEventListener('touchmove', onScrollIntent)
        w.removeEventListener('scroll', onScroll)
      }

      // الدعوة (‎.lb-doc‎) بتترسم قبل الافتتاحية بلحظة، فمانحكمش إن مفيش افتتاحية من أول نظرة
      let looks = 0
      const decide = () => {
        if (d.querySelector('.lb-intro:not(.is-open)')) {
          if (!learned.tap) later(() => !touched && setMode((m) => m || 'tap'), 700)
        } else if (!d.querySelector('.lb-intro') && ++looks < 4) later(decide, 300)
        else afterOpen()
      }
      decide()
    }
    attach()
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      detach()
    }
  }, [loaded, frame])

  const active: Mode = inView ? mode : ''

  // إرشاد التمرير: الدعوة بتنزل شوية وترجع (مرة لكل قالب)، والإرشاد بيختفي لوحده بعد شوية
  const peeked = useRef('')
  useEffect(() => {
    if (active !== 'scroll') return
    const timers: number[] = []
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!reduced && peeked.current !== slug) {
      peeked.current = slug
      timers.push(
        window.setTimeout(() => {
          try {
            const w = frame.current?.contentWindow
            // القالب اللي فيه تمرير تلقائي بينزل لوحده أصلاً — النزول والرجوع هيتخانقوا معاه
            if (!w || w.scrollY > 8 || w.__lbScroll) return
            w.scrollBy({ top: 220, behavior: 'smooth' })
            timers.push(
              window.setTimeout(() => {
                if (modeRef.current === 'scroll') w.scrollTo({ top: 0, behavior: 'smooth' })
              }, 1100),
            )
          } catch {
            /* نفس الموقع دايمًا */
          }
        }, 700),
      )
    }
    timers.push(window.setTimeout(() => setMode((m) => (m === 'scroll' ? '' : m)), SCROLL_HINT_FOR))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [active, slug, frame])

  return (
    <div
      ref={host}
      className={'sc-hints' + (active ? ` is-${active}` : '') + (scrollable ? ' has-progress' : '')}
      aria-hidden="true"
    >
      <span className="sc-progress">
        <span ref={thumb} />
      </span>

      <span className="sc-hint sc-hint--tap">
        <span className="sc-hint-ring" />
        <span className="sc-hint-ring sc-hint-ring--late" />
        <Hand />
      </span>

      <span className="sc-hint sc-hint--scroll">
        <span className="sc-hint-trail" />
        <Hand />
        <span className="sc-hint-mouse">
          <i />
        </span>
      </span>

      <span className="sc-hint-pill">
        {active === 'tap' && t('public.showcase.hintTap')}
        {active === 'scroll' && (
          <>
            <span className="sc-hint-touch">{t('public.showcase.hintSwipe')}</span>
            <span className="sc-hint-wheel">{t('public.showcase.hintWheel')}</span>
          </>
        )}
      </span>
    </div>
  )
}

/** إيد بتشاور (Material «touch_app» — Apache 2.0) */
function Hand() {
  return (
    <svg className="sc-hint-hand" viewBox="0 0 24 24">
      <path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z" />
    </svg>
  )
}
