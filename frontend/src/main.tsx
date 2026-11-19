import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
import { boot } from '@/app/boot'
import { initI18n } from '@/i18n'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/app.css'

initI18n(boot.lang)

// رقم البيلد: بيغيّر بصمة ملف main لما يتزوّد. اتعمل لما متصفحات خزّنت main-bBshPL2p.js
// كصفحة HTML (اتطلب قبل collectstatic) — زوّده لو حصل كده تاني عشان الكاش القديم يتساب.
document.documentElement.dataset.build = '2'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
