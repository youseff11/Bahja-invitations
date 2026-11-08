import { useLayoutEffect } from 'react'

import { prefersReducedMotion } from './motion'

/**
 * بيعلّم عناصر ‎[data-reveal]‎ جوّه ‎#main‎ بكلاس ‎is-in‎ لما تدخل الشاشة (بما
 * فيها اللي بتتضاف بعد وصول البيانات).
 *
 * العناصر نفسها ظاهرة من الأول — مفيش إخفاء ولا ظهور تدريجي بالسكرول. الكلاس
 * ده بيشغّل حركات مربّعات المميزات (Bento) بس، عشان ماتشتغلش وهي برّه الشاشة.
 */
export function useReveal() {
  useLayoutEffect(() => {
    const root = document.getElementById('main') ?? document.body

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      const showAll = () =>
        root.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'))
      showAll()
      const mutations = new MutationObserver(showAll)
      mutations.observe(root, { childList: true, subtree: true })
      return () => mutations.disconnect()
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        }
      },
      { threshold: 0.12 },
    )

    const seen = new WeakSet<Element>()
    const scan = () =>
      root.querySelectorAll('[data-reveal]').forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        io.observe(el)
      })
    scan()
    const mutations = new MutationObserver(scan)
    mutations.observe(root, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mutations.disconnect()
    }
  }, [])
}
