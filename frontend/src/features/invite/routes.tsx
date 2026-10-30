import { lazy, Suspense } from 'react'
import type { RouteObject } from 'react-router-dom'

/**
 * صاحب الملف: B3 (عارض الدعوة).
 * صفحات الدعوة المستقلة (من غير ترويسة الموقع):
 *   ‎i/:slug‎، ‎i/:slug/g/:token‎، وصفحة كلمة السر — بتتقدّم من السيرفر بـentry الدعوة الخفيف.
 * ‎i/:slug/venue|client|g/:token/pass‎ بتاعة B2 — متكتبش فوقها.
 *
 * ‎templates/:slug/preview‎: لما الزائر يوصلها بالضغط جوّه التطبيق بتتفتح هنا من غير تحميل
 * صفحة (chunk لوحده بيتسخّن قبل الضغطة)؛ والفتح المباشر للرابط بيتقدّم من السيرفر زي الدعوة.
 */
const SpaTemplatePreview = lazy(() => import('./SpaTemplatePreview').then((m) => ({ default: m.SpaTemplatePreview })))

export const inviteRoutes: RouteObject[] = [
  {
    path: 'templates/:slug/preview',
    element: (
      <Suspense fallback={null}>
        <SpaTemplatePreview />
      </Suspense>
    ),
  },
]
