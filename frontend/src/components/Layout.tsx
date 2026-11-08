// الأساس المشترك لازم يتحمّل قبل CSS الموقع العام (الترتيب هو اللي بيحدد مين
// يغلب مين) — main.tsx بيستورد نفس الملفات بعد App فمن غير السطور دي كان
// styles/app.css هيطلع بعد public.css ويغلبه.
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/app.css'
import '@/features/public/public.css'

import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'

import { useSite } from '@/api/hooks'
import { MetaPixel } from '@/features/public/metaPixel'
import { WhatsAppFloat } from '@/features/public/WhatsAppFloat'
import { scheduleWarm } from '@/features/public/warm'
import { restoreScroll, savedScroll } from '@/lib/scrollMemory'
import { useTheme } from '@/lib/theme'
import { Header } from './Header'

/** مسار الدخول: صفحة مستقلة من غير ترويسة ولا واتساب (زي ‎auth/login.html‎ القديم). */
const BARE_PATHS = new Set(['/login', '/login/'])

/**
 * الصفحة الجديدة بتبدأ من فوق (الـSPA مابتحمّلش الصفحة من جديد)، والـhash بيتعامل معاه كل صفحة.
 * الرجوع بالسهم (مثلاً من معاينة قالب) بيرجّع المكان اللي كان الزائر واقف فيه.
 */
function useScrollOnNavigate() {
  const { pathname, key } = useLocation()
  const type = useNavigationType()
  const previous = useRef<string | null>(null)

  // التمرير بنتحكم فيه إحنا؛ المتصفح بيحاول يرجّعه قبل ما البيانات توصل فيطلع غلط
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = 'auto'
    }
  }, [])

  useEffect(() => {
    const before = previous.current
    previous.current = pathname
    const saved = type === 'POP' ? savedScroll(key) : undefined
    if (saved !== undefined) return restoreScroll(saved)
    if (before !== null && before !== pathname) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, key, type])
}

/** غلاف الموقع العام: الترويسة، زر واتساب العائم، و Meta Pixel. */
export function Layout() {
  const { pathname } = useLocation()
  useScrollOnNavigate()
  useEffect(() => scheduleWarm(), [])
  // الدارك اتقفل/اتفتح من اللوحة وسط الجلسة — الـshell بيظبط أول رسم بس
  const darkAllowed = useSite().data?.darkModeEnabled
  const setDarkAllowed = useTheme((s) => s.setDarkAllowed)
  useEffect(() => {
    if (darkAllowed !== undefined) setDarkAllowed(darkAllowed)
  }, [darkAllowed, setDarkAllowed])

  return (
    <>
      <MetaPixel />
      {BARE_PATHS.has(pathname) ? (
        <Outlet />
      ) : (
        <>
          <Header />
          <WhatsAppFloat />
          <main id="main">
            <Outlet />
          </main>
        </>
      )}
    </>
  )
}
