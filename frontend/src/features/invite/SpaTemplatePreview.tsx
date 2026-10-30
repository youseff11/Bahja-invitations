import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { boot } from '@/app/boot'
import { PIXEL_ID, installFbq } from '@/features/public/pixel'
import { Viewer } from './InviteApp'
import inviteCss from './invite.css?inline'
import { takePreview } from './previewPrefetch'
import type { InviteLang, RenderPayload } from './types'

/**
 * معاينة القالب جوّه التطبيق (من غير تحميل صفحة): نفس ‎Viewer‎ بتاع صفحة الدعوة المستقلة.
 * الفتح المباشر للرابط (مشاركة، تحديث) لسه بيتقدّم من السيرفر بـ‎spa/invite.html‎ عشان الـOG.
 *
 * ‎invite.css‎ فيه ‎:root‎ بمتغيّرات (‎--bg‎ و‎--accent‎…) بتتصادم مع ‎tokens.css‎، فبنحقنه كنص
 * وهو متحوّل ‎:root → .lb-doc‎ ونشيله مع ‎lb-doc‎ لما نخرج. كل اللي الصفحة بتلمسه برّه React
 * (كلاس الـbody والستايل واللغة والعنوان وأنماط الـhead) بيتسجّل هنا وبيرجع زي ما كان.
 */
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@300;400;600;700&family=Cormorant+Garamond:wght@300;400;500;600&family=Gelasio:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Great+Vibes&family=Marcellus&family=Montserrat:wght@300;400;500;600&family=Playfair+Display:wght@400;500;600&family=Reem+Kufi:wght@400;600&family=Tajawal:wght@300;400;500;700&display=swap'
const HEAD_ATTRS = ['data-font-faces', 'data-lb-layout-css', 'data-imported-css', 'data-zero-block-css']

function enterInviteDocument() {
  const html = document.documentElement
  const body = document.body
  const saved = {
    title: document.title,
    lang: html.getAttribute('lang'),
    dir: html.getAttribute('dir'),
    bodyStyle: body.getAttribute('style'),
    bodyClass: body.getAttribute('class'),
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
  }

  const style = document.createElement('style')
  style.setAttribute('data-spa-invite-css', '')
  style.textContent = inviteCss.replace(/:root\s*\{/, '.lb-doc{')
  document.head.appendChild(style)

  let fonts = document.head.querySelector<HTMLLinkElement>('link[data-spa-invite-fonts]')
  if (!fonts) {
    fonts = document.createElement('link')
    fonts.rel = 'stylesheet'
    fonts.href = FONTS_HREF
    fonts.setAttribute('data-spa-invite-fonts', '')
    document.head.appendChild(fonts)
  }

  body.classList.add('lb-doc')
  body.setAttribute('data-invite-root', '')
  body.setAttribute('data-ready', '1')
  window.scrollTo({ top: 0, behavior: 'instant' })

  return () => {
    style.remove()
    for (const attr of HEAD_ATTRS) document.head.querySelector(`style[${attr}]`)?.remove()
    body.removeAttribute('data-invite-root')
    body.removeAttribute('data-ready')
    if (saved.bodyClass === null) body.removeAttribute('class')
    else body.setAttribute('class', saved.bodyClass)
    if (saved.bodyStyle === null) body.removeAttribute('style')
    else body.setAttribute('style', saved.bodyStyle)
    if (saved.lang !== null) html.setAttribute('lang', saved.lang)
    if (saved.dir !== null) html.setAttribute('dir', saved.dir)
    document.title = saved.title
    if (saved.description !== null) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', saved.description)
    }
  }
}

/** المعاينة الحية فيها سكربتات runtime (قوالب مستوردة) أو مش لاقيينها: الصفحة المستقلة من السيرفر. */
const needsServerPage = (payload: RenderPayload) => payload.stage.runtime || payload.runtimeScripts.length > 0

export function SpaTemplatePreview() {
  const { slug = '' } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [installed, setInstalled] = useState(false)
  const [payload, setPayload] = useState<RenderPayload | null>(null)
  const requested = search.get('lang')
  const lang: InviteLang | '' = requested === 'en' || requested === 'ar' ? requested : ''

  useLayoutEffect(() => {
    const leave = enterInviteDocument()
    setInstalled(true)
    return leave
  }, [])

  useEffect(() => {
    let alive = true
    takePreview(slug, lang)
      .then((next) => {
        if (!alive) return
        if (needsServerPage(next)) {
          window.location.replace(window.location.href)
          return
        }
        setPayload(next)
      })
      // قالب مش موجود أو خطأ شبكة: السيرفر يرد بصفحة الخطأ المناسبة
      .catch(() => alive && window.location.replace(window.location.href))
    return () => {
      alive = false
    }
  }, [slug, lang])

  // نفس PageView بتاع الصفحة المستقلة (من غير Contact — زي ‎no_contact‎ في الـshell)
  useEffect(() => {
    if (boot.debug || !payload) return
    const fresh = !window.fbq
    const fbq = installFbq()
    if (fresh) fbq('init', PIXEL_ID)
    fbq('track', 'PageView')
  }, [payload])

  // «عودة للموقع» جوّه التطبيق بدل تحميل الرئيسية من جديد
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target as Element | null)?.closest?.('a[data-back-to-site]')) return
      event.preventDefault()
      navigate({ pathname: '/', hash: '#templates' })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [navigate])

  if (!installed || !payload) {
    return (
      <div className="lb-loading-screen" role="status" aria-live="polite">
        <div className="lb-loading-screen__card">
          <span className="lb-loading-screen__spinner" aria-hidden="true" />
        </div>
      </div>
    )
  }
  return <Viewer key={slug} initial={payload} />
}
