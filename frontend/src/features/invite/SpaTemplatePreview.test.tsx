import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { block, payload } from './fixtures'
import { SpaTemplatePreview } from './SpaTemplatePreview'
import type { RenderPayload } from './types'

const hero = block('hero', { name_one: 'ليلى', name_two: '', names_layout: 'stacked', height: 'full', name_size: 76, name_size_mobile: 46 })

function mockPreview(body: Partial<RenderPayload>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(payload({ kind: 'template', slug: 'demo', demo: true, ...body })), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/templates/demo/preview/']}>
      <Routes>
        <Route path="templates/:slug/preview" element={<SpaTemplatePreview />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SpaTemplatePreview', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=tok'
    document.title = 'الموقع'
    document.documentElement.setAttribute('lang', 'ar')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the template inside the app and gives the document back when it unmounts', async () => {
    mockPreview({
      blocks: [hero],
      bodyStyle: '--bg:#123456',
      lang: 'en',
      dir: 'ltr',
      css: { font: '@font-face{font-family:x}', layout: '.a{}', shared: '', zero: '' },
      head: { title: 'معاينة قالب', description: '', image: { url: '', width: 0, height: 0 }, favicon: '', canonical: '' },
    })
    const { unmount } = renderRoute()

    expect(document.body.classList.contains('lb-doc')).toBe(true)
    await waitFor(() => expect(document.querySelector('section#hero-1')).not.toBeNull())
    expect(document.title).toBe('معاينة قالب')
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    expect(document.head.querySelector('style[data-lb-layout-css]')).not.toBeNull()
    expect(document.querySelector('a[data-back-to-site]')).not.toBeNull()

    unmount()
    expect(document.body.classList.contains('lb-doc')).toBe(false)
    expect(document.body.hasAttribute('style')).toBe(false)
    expect(document.title).toBe('الموقع')
    expect(document.documentElement.getAttribute('lang')).toBe('ar')
    expect(document.head.querySelector('style[data-spa-invite-css],style[data-font-faces],style[data-lb-layout-css]')).toBeNull()
  })

  it('leaves for the home page without a reload when "back to site" is clicked', async () => {
    mockPreview({ blocks: [hero], siteUrl: 'https://site.test/' })
    renderRoute()
    const back = await screen.findByRole('link', { name: /عودة للموقع/ })
    back.click()
    await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument())
    expect(document.body.classList.contains('lb-doc')).toBe(false)
  })
})
