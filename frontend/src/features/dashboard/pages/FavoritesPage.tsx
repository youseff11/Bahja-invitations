import { useState } from 'react'
import type { FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { FavoritePreview } from '@/features/editor/assets/FavoritePreview'
import { countByCategory, UNCATEGORIZED, useFavoriteActions, useFavoritesQuery } from '@/features/editor/assets/useFavorites'
import { useSchema } from '@/features/editor/hooks'
import type { FavoriteCategory, FavoriteRow } from '@/features/editor/types'
import { useConfirm } from '../ui/ConfirmDialog'
import { InlineEdit } from '../ui/InlineEdit'
import { PageHead, usePageTitle } from '../ui/page'
import { QueryState } from '../ui/table'
import { useToast } from '../ui/Toast'

/** ‎'all'‎ كل العناصر · ‎UNCATEGORIZED‎ من غير تصنيف · رقم: تصنيف بعينه */
type Filter = 'all' | typeof UNCATEGORIZED | number

/**
 * مكتبة المفضلة: الأقسام المحفوظة من المحرر، بمعاينة، مع تسمية ونقل بين التصنيفات وحذف،
 * وإدارة التصنيفات نفسها (إضافة/تسمية/حذف) في العمود الجانبي.
 */
export function FavoritesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const actions = useFavoriteActions()
  const query = useFavoritesQuery()
  const schema = useSchema()
  const [filter, setFilter] = useState<Filter>('all')
  const [newCategory, setNewCategory] = useState('')
  const [busy, setBusy] = useState(false)
  usePageTitle(t('dashboard.favorites.pageTitle'))

  const rows = query.data?.favorites ?? []
  const categories = query.data?.categories ?? []
  const counts = countByCategory(rows)
  const uncategorized = counts.get(UNCATEGORIZED) ?? 0
  // تصنيف اتحذف وهو المختار: نرجع «الكل» بدل شاشة فاضية
  const active: Filter = typeof filter === 'number' && !categories.some((c) => c.id === filter) ? 'all' : filter
  const shown = rows.filter((f) => (active === 'all' ? true : active === UNCATEGORIZED ? f.categoryId === null : f.categoryId === active))

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action()
      toast.success(success)
    } catch (error) {
      toast.fail(error)
      throw error
    }
  }

  const rename = (favorite: FavoriteRow, name: string) =>
    run(() => actions.rename(favorite, name), t('dashboard.favorites.renamed', { name }))

  const move = (favorite: FavoriteRow, value: string) => {
    const category = value === '' ? null : (categories.find((c) => c.id === Number(value)) ?? null)
    const message = category
      ? t('dashboard.favorites.moved', { name: favorite.name, category: category.name })
      : t('dashboard.favorites.movedNone', { name: favorite.name })
    void run(() => actions.move(favorite, category?.id ?? null), message).catch(() => undefined)
  }

  async function remove(favorite: FavoriteRow) {
    const message = t('dashboard.favorites.confirmDelete', { name: favorite.name })
    if (!(await confirm({ message, danger: true, confirmLabel: t('dashboard.favorites.delete') }))) return
    void run(() => actions.remove(favorite), t('dashboard.favorites.deleted', { name: favorite.name })).catch(() => undefined)
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    setBusy(true)
    try {
      await run(() => actions.addCategory(name), t('dashboard.favorites.categoryAdded', { name }))
      setNewCategory('')
    } catch {
      /* الخطأ اتعرض في التنبيه والاسم فاضل في الحقل */
    } finally {
      setBusy(false)
    }
  }

  const renameCategory = (category: FavoriteCategory, name: string) =>
    run(() => actions.renameCategory(category, name), t('dashboard.favorites.categoryRenamed', { name }))

  async function removeCategory(category: FavoriteCategory) {
    const message = t('dashboard.favorites.confirmDeleteCategory', { name: category.name })
    if (!(await confirm({ message, danger: true, confirmLabel: t('dashboard.favorites.deleteCategory') }))) return
    void run(() => actions.removeCategory(category), t('dashboard.favorites.categoryDeleted', { name: category.name })).catch(() => undefined)
  }

  const chip = (key: Filter, label: string, count: number) => (
    <button
      key={String(key)}
      type="button"
      className={`fav-chip${active === key ? ' is-active' : ''}`}
      aria-pressed={active === key}
      onClick={() => setFilter(key)}
    >
      {label}
      <span className="fav-chip-count nums">{count}</span>
    </button>
  )

  return (
    <>
      <PageHead title={t('dashboard.favorites.title')}>
        <Link className="btn btn--ghost" to="/dashboard/invitations">
          {t('dashboard.common.backToInvitations')}
        </Link>
      </PageHead>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>{t('dashboard.common.howItWorks')}</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          <Trans i18nKey="dashboard.favorites.how" components={{ strong: <strong /> }} />
        </p>
      </div>

      <div className="grid split-layout">
        <div>
          <h2 style={{ fontSize: 18 }}>{t('dashboard.favorites.listTitle', { n: rows.length })}</h2>
          <QueryState loading={query.isPending} error={query.isError} />

          {query.data && (
            <>
              <div className="fav-chips" role="group" aria-label={t('dashboard.favorites.filtersLabel')}>
                {chip('all', t('dashboard.favorites.all'), rows.length)}
                {categories.map((c) => chip(c.id, c.name, counts.get(c.id) ?? 0))}
                {uncategorized > 0 && chip(UNCATEGORIZED, t('dashboard.favorites.uncategorized'), uncategorized)}
              </div>

              {shown.length === 0 && (
                <p className="card muted" style={{ textAlign: 'center' }}>
                  {t(rows.length === 0 ? 'dashboard.favorites.none' : 'dashboard.favorites.noneInCategory')}
                </p>
              )}

              <div className="fav-grid">
                {shown.map((favorite) => {
                  const spec = schema.data?.blocks[favorite.blockType]
                  // السكيما لسه بتتحمّل: ما نحكمش إن النوع مش مدعوم
                  const unsupported = schema.isSuccess && !spec
                  return (
                    <article className="fav-card card" key={favorite.id}>
                      <FavoritePreview block={unsupported ? null : favorite.block} standalone className="fav-preview" />
                      <div className="fav-body">
                        <InlineEdit
                          value={favorite.name}
                          label={t('dashboard.favorites.editName')}
                          maxLength={120}
                          required
                          onSave={(name) => rename(favorite, name)}
                        />
                        <span className="muted fav-type">
                          {unsupported ? t('dashboard.favorites.invalidType') : (spec?.label ?? favorite.blockType)}
                        </span>
                        <label className="fav-move">
                          <span className="muted">{t('dashboard.favorites.moveLabel')}</span>
                          <select value={favorite.categoryId ?? ''} onChange={(e) => move(favorite, e.target.value)}>
                            <option value="">{t('dashboard.favorites.uncategorized')}</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="toolbar" style={{ margin: 0 }}>
                          <button className="btn btn--ghost btn--sm" type="button" onClick={() => void remove(favorite)}>
                            {t('dashboard.favorites.delete')}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <aside className="card">
          <h2 style={{ fontSize: 17, marginTop: 0 }}>{t('dashboard.favorites.categoriesTitle')}</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
            {t('dashboard.favorites.categoriesHint')}
          </p>
          <form className="form" onSubmit={(event) => void addCategory(event)}>
            <div className="field">
              <label htmlFor="fav-new-category">{t('dashboard.favorites.categoryName')}</label>
              <input
                id="fav-new-category"
                type="text"
                maxLength={80}
                placeholder={t('dashboard.favorites.categoryPlaceholder')}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
            <button className="btn btn--gold btn--block" type="submit" disabled={busy || !newCategory.trim()}>
              {t('dashboard.favorites.addCategory')}
            </button>
          </form>

          {query.data && categories.length === 0 && (
            <p className="muted" style={{ fontSize: 13.5 }}>
              {t('dashboard.favorites.noCategories')}
            </p>
          )}
          <ul className="fav-categories">
            {categories.map((category) => (
              <li key={category.id}>
                <InlineEdit
                  value={category.name}
                  label={t('dashboard.favorites.editCategory')}
                  maxLength={80}
                  required
                  onSave={(name) => renameCategory(category, name)}
                />
                <span className="muted nums">{counts.get(category.id) ?? 0}</span>
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => void removeCategory(category)}>
                  {t('dashboard.favorites.deleteCategory')}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  )
}
