import { createRoot } from 'react-dom/client'

import { InviteApp } from '@/features/invite/InviteApp'
import type { Boot } from '@/features/invite/types'
import '@/features/invite/invite.css'

/**
 * Entry منفصل وخفيف لصفحات الدعوة (‎/app/i/<slug>/‎ و‎/app/templates/<slug>/preview/‎):
 * مفيش لوحة تحكم ولا راوتر ولا react-query ولا i18next — الضيف على موبايل.
 * الحمولة جاية جوّه الصفحة (‎#invite-data‎) فمفيش طلب قبل الرسم.
 * من غير StrictMode عن قصد: الافتتاحية والموسيقى مستمعاتها native وبتتربط مرة.
 */
// تشخيص الافتتاحية على الموبايل (آيفون من غير أدوات مطوّر): ‎?debug=1‎ بس
if (/[?&]debug=1\b/.test(location.search)) void import('@/features/invite/runtime/intro-debug')

const node = document.getElementById('invite-data')
const boot = JSON.parse(node?.textContent || '{}') as Boot
createRoot(document.getElementById('root')!).render(<InviteApp boot={boot} />)
