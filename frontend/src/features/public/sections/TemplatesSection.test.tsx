import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { initI18n } from '@/i18n'
import type { PublicTemplate } from '../types'
import { TemplatesSection } from './TemplatesSection'

const card = (id: number, name: string, category: string): PublicTemplate => ({
  id,
  slug: `t${id}`,
  name,
  nameEn: '',
  displayName: name,
  description: '',
  descriptionEn: '',
  displayDescription: '',
  category,
  categoryLabel: category === 'wedding' ? 'زفاف' : 'خطوبة',
  collection: '',
  cover: null,
})

const CATEGORIES = [
  { value: 'wedding', label: 'زفاف' },
  { value: 'engagement', label: 'خطوبة' },
]

beforeAll(() => {
  initI18n('ar')
})

afterEach(() => vi.unstubAllGlobals())

describe('TemplatesSection categories', () => {
  it('shows category chips and loads the chosen category from the gallery API', async () => {
    const fetchMock = vi.fn((..._args: unknown[]) =>
      Promise.resolve(
        new Response(
          JSON.stringify({ results: [card(3, 'قالب الخطوبة', 'engagement')], categories: CATEGORIES, category: 'engagement' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <TemplatesSection
            templates={[card(1, 'قالب الزفاف', 'wedding')]}
            categories={CATEGORIES}
            error={null}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('button', { name: 'الكل', pressed: true })).toBeInTheDocument()
    expect(screen.getByText('قالب الزفاف')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'خطوبة' }))
    expect(await screen.findByText('قالب الخطوبة')).toBeInTheDocument()
    expect(screen.queryByText('قالب الزفاف')).toBeNull()
    await waitFor(() => expect(String(fetchMock.mock.calls[0]?.[0])).toContain('category=engagement'))

    fireEvent.click(screen.getByRole('button', { name: 'الكل' }))
    expect(screen.getByText('قالب الزفاف')).toBeInTheDocument()
  })

  it('hides the chips when there are no categories', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TemplatesSection templates={[card(1, 'قالب', 'none')]} categories={[]} error={null} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('button', { name: 'الكل' })).toBeNull()
  })
})
