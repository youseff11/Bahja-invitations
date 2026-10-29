import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { initI18n } from '@/i18n'
import type { DedupeResult, ImageRow } from '../types'
import { ConfirmProvider } from '../ui/ConfirmDialog'
import { extraCopies } from '../ui/imageCopies'
import { ToastProvider } from '../ui/Toast'
import { ImagesPage } from './ImagesPage'

const image = (id: number, over: Partial<ImageRow> = {}): ImageRow => ({
  id,
  name: `صورة ${id}`,
  url: `/media/assets/${id}.png`,
  thumbUrl: `/media/assets/${id}-t.webp`,
  width: 800,
  height: 600,
  sizeBytes: 1000,
  sizeLabel: '1.0 KB',
  owner: '',
  ownerKind: '',
  createdAt: '2026-10-01',
  used: false,
  dupGroup: '',
  dupCount: 1,
  ...over,
})

// ١ و٢ و٣ متطابقة (٣ مستخدمة)، ٤ فريدة، ٥ مستخدمة وفريدة
const ROWS = [
  image(1, { dupGroup: 'aaa', dupCount: 3 }),
  image(2, { dupGroup: 'aaa', dupCount: 3 }),
  image(3, { dupGroup: 'aaa', dupCount: 3, used: true, ownerKind: 'invitation', owner: 'دعوة ليلى' }),
  image(4),
  image(5, { used: true, ownerKind: 'template', owner: 'ذهبي' }),
]

const plan = (over: Partial<DedupeResult> = {}): DedupeResult => ({
  dryRun: true,
  removeCount: 2,
  keepCount: 1,
  repointedDocs: 0,
  freedBytes: 0,
  groups: [],
  ...over,
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mockApi(opts: { rows?: ImageRow[]; duplicateExtra?: number; apply?: DedupeResult } = {}) {
  const calls: { url: string; method: string; body: unknown }[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    if (url.endsWith('/site/')) return json({ name: { ar: 'بهجة', en: 'Bahja Invitations' } })
    if (url.endsWith('/images/dedupe/')) {
      calls.push({ url, method, body })
      return json(body.dryRun ? plan() : (opts.apply ?? plan({ dryRun: false })))
    }
    if (url.endsWith('/images/bulk-delete/')) {
      calls.push({ url, method, body })
      return json({ deleted: body.ids })
    }
    if (/\/images\/\d+\/$/.test(url) && method !== 'GET') {
      calls.push({ url, method, body })
      return json({ deleted: 1 })
    }
    if (url.endsWith('/dashboard/images/')) {
      return json({ results: opts.rows ?? ROWS, duplicateExtra: opts.duplicateExtra ?? 2 })
    }
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <ImagesPage />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const cards = () => [...document.querySelectorAll('.image-card')]

beforeAll(() => {
  initI18n('ar')
})
beforeEach(() => {
  document.cookie = 'csrftoken=tok'
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('extraCopies', () => {
  it('keeps the oldest copy when none is used, and only picks unused ones otherwise', () => {
    expect(extraCopies(ROWS).sort()).toEqual([1, 2]) // ٣ مستخدمة: يفضل، والباقي زيادة
    const unusedGroup = [image(7, { dupGroup: 'x' }), image(6, { dupGroup: 'x' }), image(8, { dupGroup: 'x' })]
    expect(extraCopies(unusedGroup).sort()).toEqual([7, 8]) // الأقدم (٦) يفضل
  })

  it('ignores images that are not duplicated', () => {
    expect(extraCopies([image(1), image(2, { used: true })])).toEqual([])
  })
})

describe('ImagesPage', () => {
  it('lists every image with duplicate and in-use badges', async () => {
    mockApi()
    renderPage()
    await waitFor(() => expect(cards()).toHaveLength(5))
    expect(screen.getAllByText('مكررة ×3')).toHaveLength(3)
    expect(within(cards()[2] as HTMLElement).getByText('مستخدمة')).toBeInTheDocument()
    expect(screen.getByText(/دعوة: دعوة ليلى/)).toBeInTheDocument()
    expect(screen.getByText(/قالب: ذهبي/)).toBeInTheDocument()
  })

  it('filters duplicates, unused and in-use images', async () => {
    mockApi()
    renderPage()
    await waitFor(() => expect(cards()).toHaveLength(5))
    fireEvent.click(screen.getByRole('button', { name: 'المكررة' }))
    expect(cards()).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'غير مستخدمة' }))
    expect(cards()).toHaveLength(3) // ١ و٢ و٤
    fireEvent.click(screen.getByRole('button', { name: 'مستخدمة' }))
    expect(cards()).toHaveLength(2) // ٣ و٥
  })

  it('searches by name', async () => {
    mockApi()
    renderPage()
    await waitFor(() => expect(cards()).toHaveLength(5))
    fireEvent.change(screen.getByPlaceholderText('ابحث باسم الصورة…'), { target: { value: 'صورة 4' } })
    expect(cards()).toHaveLength(1)
  })

  it('locks delete and selection for images that are in use', async () => {
    mockApi()
    renderPage()
    await waitFor(() => expect(cards()).toHaveLength(5))
    const used = cards()[2] as HTMLElement
    expect(within(used).getByRole('button', { name: 'حذف' })).toBeDisabled()
    expect(within(used).getByRole('checkbox')).toBeDisabled()
    expect(within(cards()[0] as HTMLElement).getByRole('button', { name: 'حذف' })).toBeEnabled()
  })

  it('deletes one image after confirming', async () => {
    const { calls } = mockApi()
    renderPage()
    await waitFor(() => expect(cards()).toHaveLength(5))
    fireEvent.click(within(cards()[3] as HTMLElement).getByRole('button', { name: 'حذف' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('صورة 4')
    expect(calls).toEqual([])
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'حذف' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({ method: 'DELETE' })
    expect(calls[0].url).toMatch(/\/images\/4\/$/)
  })

  it('selects the extra copies and deletes them in one request', async () => {
    const { calls } = mockApi()
    renderPage()
    await waitFor(() => expect(cards()).toHaveLength(5))
    fireEvent.click(screen.getByRole('button', { name: 'حدّد النسخ الزيادة' }))
    expect(await screen.findByText('2 صورة محددة')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'حذف المحدد (2)' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'حذف' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ ids: [1, 2] })
  })

  it('previews, asks to confirm, then removes duplicates automatically', async () => {
    const { calls } = mockApi({ apply: plan({ dryRun: false, repointedDocs: 1, freedBytes: 2 * 1024 * 1024 }) })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'مسح المكرر (2)' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('هيتمسح 2 صورة مكررة')
    expect(calls.map((c) => c.body)).toEqual([{ dryRun: true }])
    fireEvent.click(within(dialog).getByRole('button', { name: 'امسح المكرر' }))
    await waitFor(() => expect(calls.map((c) => c.body)).toEqual([{ dryRun: true }, { dryRun: false }]))
    expect(await screen.findByText(/اتمسح 2 صورة مكررة وفضل 1/)).toHaveTextContent('2.0 ميجابايت')
  })

  it('hides the duplicate actions when there are none', async () => {
    mockApi({ rows: [image(4), image(5)], duplicateExtra: 0 })
    renderPage()
    await waitFor(() => expect(cards()).toHaveLength(2))
    expect(screen.queryByRole('button', { name: /مسح المكرر/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حدّد النسخ الزيادة' })).not.toBeInTheDocument()
  })

  it('opens a full-size preview', async () => {
    mockApi()
    renderPage()
    await waitFor(() => expect(cards()).toHaveLength(5))
    fireEvent.click(screen.getByRole('button', { name: 'معاينة «صورة 4»' }))
    const dialog = await screen.findByRole('dialog', { name: 'صورة 4' })
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/media/assets/4.png')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
