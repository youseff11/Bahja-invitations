import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import * as api from '@/features/editor/assets/api'
import type { FavoriteRow } from '@/features/editor/types'
import { initI18n } from '@/i18n'
import { ConfirmProvider } from '../ui/ConfirmDialog'
import { ToastProvider } from '../ui/Toast'
import { FavoritesPage } from './FavoritesPage'

vi.mock('@/features/editor/assets/api', async (original) => ({
  ...(await original<typeof import('@/features/editor/assets/api')>()),
  fetchFavorites: vi.fn(),
  updateFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
  createFavoriteCategory: vi.fn(),
  renameFavoriteCategory: vi.fn(),
  deleteFavoriteCategory: vi.fn(),
}))
// المعاينة بتفتح iframe وبتطلب من السيرفر — مالهاش لازمة هنا
vi.mock('@/features/editor/assets/FavoritePreview', () => ({
  FavoritePreview: ({ block }: { block: unknown }) => <div data-testid="preview" data-empty={block === null} />,
}))
vi.mock('@/features/editor/hooks', () => ({
  useSchema: () => ({ isSuccess: true, data: { blocks: { schedule: { label: 'برنامج اليوم' }, countdown: { label: 'العد التنازلي' } } } }),
}))

const fetchFavorites = vi.mocked(api.fetchFavorites)
const updateFavorite = vi.mocked(api.updateFavorite)
const deleteFavorite = vi.mocked(api.deleteFavorite)
const createFavoriteCategory = vi.mocked(api.createFavoriteCategory)
const renameFavoriteCategory = vi.mocked(api.renameFavoriteCategory)
const deleteFavoriteCategory = vi.mocked(api.deleteFavoriteCategory)

const favorite = (id: number, name: string, categoryId: number | null = null, blockType = 'schedule'): FavoriteRow => ({
  id,
  name,
  blockType,
  categoryId,
  block: { id: `b${id}`, type: blockType, visible: true, locked: false, props: {}, style: {} },
})

const CATEGORIES = [
  { id: 1, name: 'اليوم الكبير' },
  { id: 2, name: 'العدّادات' },
]

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function renderPage() {
  vi.stubGlobal('fetch', vi.fn(async () => json({ name: { ar: 'بهجة', en: 'Bahja' } })))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <FavoritesPage />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const card = async (name: string) => (await screen.findByText(name)).closest('.fav-card') as HTMLElement

async function answerConfirm(ok: boolean) {
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getAllByRole('button')[ok ? 1 : 0])
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
}

beforeAll(() => initI18n('ar'))
beforeEach(() => {
  vi.clearAllMocks()
  fetchFavorites.mockResolvedValue({
    favorites: [favorite(1, 'جدول الحفل', 1), favorite(2, 'عدّاد أنيق', 2, 'countdown'), favorite(3, 'بلا تصنيف')],
    categories: CATEGORIES,
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('FavoritesPage', () => {
  it('lists every favorite with a preview, its section type, and filters by category', async () => {
    renderPage()
    const first = await card('جدول الحفل')
    expect(within(first).getByTestId('preview')).toBeInTheDocument()
    expect(within(first).getByText('برنامج اليوم')).toBeInTheDocument()
    expect(within(await card('عدّاد أنيق')).getByText('العد التنازلي')).toBeInTheDocument()
    expect(screen.getAllByTestId('preview')).toHaveLength(3)

    const filters = screen.getByRole('group', { name: 'تصفية بالتصنيف' })
    expect(within(filters).getByRole('button', { name: /الكل/ })).toHaveTextContent('3')
    fireEvent.click(within(filters).getByRole('button', { name: /اليوم الكبير/ }))
    expect(screen.getByText('جدول الحفل')).toBeInTheDocument()
    expect(screen.queryByText('عدّاد أنيق')).toBeNull()

    fireEvent.click(within(filters).getByRole('button', { name: /بدون تصنيف/ }))
    expect(screen.getByText('بلا تصنيف')).toBeInTheDocument()
    expect(screen.queryByText('جدول الحفل')).toBeNull()
  })

  it('renames a favorite by clicking its name', async () => {
    updateFavorite.mockResolvedValue({ favorite: favorite(1, 'اسم جديد', 1) })
    renderPage()
    const target = await card('جدول الحفل')
    fireEvent.click(within(target).getByRole('button', { name: /جدول الحفل/ }))
    const input = within(target).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'اسم جديد' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(updateFavorite).toHaveBeenCalledWith(1, { name: 'اسم جديد' }))
    expect(await screen.findByText('اسم جديد')).toBeInTheDocument()
  })

  it('moves a favorite to another category, or out of any category', async () => {
    updateFavorite.mockResolvedValueOnce({ favorite: favorite(3, 'بلا تصنيف', 2) }).mockResolvedValueOnce({ favorite: favorite(3, 'بلا تصنيف', null) })
    renderPage()
    const target = await card('بلا تصنيف')
    fireEvent.change(within(target).getByRole('combobox'), { target: { value: '2' } })
    await waitFor(() => expect(updateFavorite).toHaveBeenCalledWith(3, { categoryId: 2 }))
    // اتنقل: العدّاد اتحدّث والعنصر بقى تحت «العدّادات»
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'تصفية بالتصنيف' })).getByRole('button', { name: /العدّادات/ })).toHaveTextContent('2'))

    fireEvent.change(within(await card('بلا تصنيف')).getByRole('combobox'), { target: { value: '' } })
    await waitFor(() => expect(updateFavorite).toHaveBeenLastCalledWith(3, { categoryId: null }))
  })

  it('deletes a favorite only after confirmation', async () => {
    deleteFavorite.mockResolvedValue({ deleted: 1 })
    renderPage()
    fireEvent.click(within(await card('جدول الحفل')).getByRole('button', { name: 'حذف' }))
    await answerConfirm(false)
    expect(deleteFavorite).not.toHaveBeenCalled()

    fireEvent.click(within(await card('جدول الحفل')).getByRole('button', { name: 'حذف' }))
    await answerConfirm(true)
    await waitFor(() => expect(deleteFavorite).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('جدول الحفل')).toBeNull())
  })

  it('adds a category and keeps the name in the field when the server refuses', async () => {
    createFavoriteCategory.mockResolvedValueOnce({ category: { id: 7, name: 'الضيافة' } })
    renderPage()
    await card('جدول الحفل')
    const input = screen.getByLabelText('اسم تصنيف جديد')
    const submit = screen.getByRole('button', { name: 'إضافة تصنيف' })
    expect(submit).toBeDisabled()
    fireEvent.change(input, { target: { value: '  الضيافة ' } })
    fireEvent.click(submit)
    await waitFor(() => expect(createFavoriteCategory).toHaveBeenCalledWith('الضيافة'))
    expect(await within(screen.getByRole('group', { name: 'تصفية بالتصنيف' })).findByRole('button', { name: /الضيافة/ })).toBeInTheDocument()
    expect(input).toHaveValue('')

    createFavoriteCategory.mockRejectedValueOnce(new ApiError(400, 'validation_error', 'فيه تصنيف بنفس الاسم.'))
    fireEvent.change(input, { target: { value: 'الضيافة' } })
    fireEvent.click(submit)
    expect(await screen.findByText('فيه تصنيف بنفس الاسم.')).toBeInTheDocument()
    expect(input).toHaveValue('الضيافة')
  })

  it('renames a category', async () => {
    renameFavoriteCategory.mockResolvedValue({ category: { id: 2, name: 'عدّادات الحفل' } })
    renderPage()
    await card('جدول الحفل')
    const row = screen.getAllByRole('listitem').find((li) => li.textContent?.includes('العدّادات')) as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: /العدّادات/ }))
    const input = within(row).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'عدّادات الحفل' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(renameFavoriteCategory).toHaveBeenCalledWith(2, 'عدّادات الحفل'))
  })

  it('deleting a category keeps its favorites under «بدون تصنيف»', async () => {
    deleteFavoriteCategory.mockResolvedValue({ deleted: 1 })
    renderPage()
    await card('جدول الحفل')
    const filters = screen.getByRole('group', { name: 'تصفية بالتصنيف' })
    fireEvent.click(within(filters).getByRole('button', { name: /اليوم الكبير/ }))

    const row = screen.getAllByRole('listitem').find((li) => li.textContent?.includes('اليوم الكبير')) as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'حذف التصنيف' }))
    await answerConfirm(true)
    await waitFor(() => expect(deleteFavoriteCategory).toHaveBeenCalledWith(1))

    // التصنيف المختار اتحذف: بنرجع «الكل» والعنصر لسه موجود
    expect(await screen.findByText('جدول الحفل')).toBeInTheDocument()
    expect(screen.getAllByTestId('preview')).toHaveLength(3)
    expect(within(screen.getByRole('group', { name: 'تصفية بالتصنيف' })).getByRole('button', { name: /بدون تصنيف/ })).toHaveTextContent('2')
  })

  it('shows an empty state', async () => {
    fetchFavorites.mockResolvedValue({ favorites: [], categories: [] })
    renderPage()
    expect(await screen.findByText(/مفيش عناصر هنا/)).toBeInTheDocument()
    expect(screen.getByText('لسه مفيش تصنيفات.')).toBeInTheDocument()
  })
})
