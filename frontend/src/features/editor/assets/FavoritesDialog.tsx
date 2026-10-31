import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BlockSpec, DocBlock, EditorSchema, FavoriteRow } from '../types'
import { useEditorUi } from '../ui'
import { createFavorite, createFavoriteCategory, fetchFavoriteCategories } from './api'
import { addFavoriteToDocument } from './favorites'
import { errorText } from './errors'
import { FavoritePreview } from './FavoritePreview'
import { Modal } from './Modal'
import { countByCategory, FAVORITES_KEY, prefetchFavorites, UNCATEGORIZED, useFavoriteActions, useFavoritesQuery } from './useFavorites'

/** ‎null‎: شاشة اختيار التصنيف · ‎'all'‎: كل العناصر · ‎UNCATEGORIZED‎: من غير تصنيف · رقم: تصنيف بعينه */
type View = null | 'all' | typeof UNCATEGORIZED | number

/**
 * مكتبة المفضلة. لو فيه تصنيفات بنسأل الأول «أي تصنيف؟» وبعدها بنعرض عناصره؛ ولو مفيش تصنيفات
 * (لسه ماتعملتش) بنعرض كل العناصر على طول.
 */
export function FavoritesDialog({ schema, onClose }: { schema: EditorSchema; onClose: () => void }) {
  const { t } = useTranslation()
  const ui = useEditorUi()
  const actions = useFavoriteActions()
  const query = useFavoritesQuery()
  const [view, setView] = useState<View>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const rows = query.data?.favorites ?? []
  const categories = query.data?.categories ?? []
  const counts = countByCategory(rows)

  const choosing = view === null && categories.length > 0
  const current: Exclude<View, null> = view ?? 'all'
  const shown = rows.filter((f) => (current === 'all' ? true : current === UNCATEGORIZED ? f.categoryId === null : f.categoryId === current))
  const currentName =
    current === 'all'
      ? t('editorAssets.favorites.all')
      : current === UNCATEGORIZED
        ? t('editorAssets.favorites.uncategorized')
        : (categories.find((c) => c.id === current)?.name ?? '')

  const use = (favorite: FavoriteRow) => {
    const result = addFavoriteToDocument(favorite, schema)
    if (result === 'added') {
      ui.toast(t('editorAssets.favorites.added'), 'ok')
      onClose()
    } else {
      ui.toast(t(result === 'singleton' ? 'editorAssets.favorites.exists' : 'editorAssets.favorites.invalid'), 'error')
    }
  }

  const remove = async (favorite: FavoriteRow) => {
    if (!(await ui.confirm(t('editorAssets.favorites.confirmDelete'), { danger: true }))) return
    setRemoving(favorite.id)
    try {
      await actions.remove(favorite)
      ui.toast(t('editorAssets.favorites.deleted'), 'ok')
    } catch (error) {
      ui.toast(errorText(error, t, 'editorAssets.errors.favoriteDelete'), 'error')
    } finally {
      setRemoving(null)
    }
  }

  const choice = (key: Exclude<View, null>, label: string, count: number) => (
    <button type="button" className="ed-favorite-cat" key={String(key)} onClick={() => setView(key)}>
      <strong>{label}</strong>
      <small className="ed-hint">{t('editorAssets.favorites.count', { n: count })}</small>
    </button>
  )

  return (
    <Modal label={t('editorAssets.favorites.title')} onClose={onClose}>
      <h3>{t('editorAssets.favorites.title')}</h3>
      <p>{t(choosing ? 'editorAssets.favorites.pickCategory' : 'editorAssets.favorites.hint')}</p>
      <div className="ed-favorites">
        {query.isPending && <p className="ed-empty">{t('editorAssets.favorites.loading')}</p>}
        {query.isError && (
          <div className="ed-empty">
            <p>{errorText(query.error, t, 'editorAssets.errors.favoritesLoad')}</p>
            <button type="button" className="ed-btn ed-btn--sm" onClick={() => void query.refetch()}>
              {t('editorAssets.retry')}
            </button>
          </div>
        )}
        {query.isSuccess && rows.length === 0 && <p className="ed-empty">{t('editorAssets.favorites.empty')}</p>}

        {query.isSuccess && rows.length > 0 && choosing && (
          <div className="ed-favorite-cats">
            {categories.map((c) => choice(c.id, c.name, counts.get(c.id) ?? 0))}
            {(counts.get(UNCATEGORIZED) ?? 0) > 0 && choice(UNCATEGORIZED, t('editorAssets.favorites.uncategorized'), counts.get(UNCATEGORIZED) ?? 0)}
            {choice('all', t('editorAssets.favorites.all'), rows.length)}
          </div>
        )}

        {query.isSuccess && rows.length > 0 && !choosing && (
          <>
            {categories.length > 0 && (
              <div className="ed-favorite-crumb">
                <button type="button" className="ed-btn ed-btn--sm" onClick={() => setView(null)}>
                  {t('editorAssets.favorites.back')}
                </button>
                <strong>{currentName}</strong>
              </div>
            )}
            {shown.length === 0 && <p className="ed-empty">{t('editorAssets.favorites.emptyCategory')}</p>}
            {shown.map((favorite) => (
              <div className="ed-favorite-row" key={favorite.id}>
                <FavoritePreview block={schema.blocks[favorite.blockType] ? favorite.block : null} />
                <div className="ed-favorite-info">
                  <strong>{favorite.name}</strong>
                  <small className="ed-hint">{schema.blocks[favorite.blockType]?.label ?? favorite.blockType}</small>
                </div>
                <button type="button" className="ed-btn ed-btn--sm ed-btn--primary" onClick={() => use(favorite)}>
                  {t('editorAssets.favorites.use')}
                </button>
                <button type="button" className="ed-btn ed-btn--sm" disabled={removing === favorite.id} onClick={() => void remove(favorite)}>
                  {t('editorAssets.favorites.delete')}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="ed-modal-actions">
        <button type="button" className="ed-btn" onClick={onClose}>
          {t('editorAssets.close')}
        </button>
      </div>
    </Modal>
  )
}

/** زر «★ المفضلة» في تبويب الأقسام. */
export function FavoritesButton({ schema }: { schema: EditorSchema }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  // المكتبة بتتجاب أول ما الزر يتشاف (وقت فراغ) فتكون جاهزة قبل الضغطة
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const run = () => void prefetchFavorites(client)
    if (idle) idle(run)
    else setTimeout(run, 1500)
  }, [client])
  const warm = () => void prefetchFavorites(client)
  return (
    <>
      <button type="button" className="ed-btn ed-btn--sm" onClick={() => setOpen(true)} onPointerEnter={warm} onFocus={warm}>
        {t('editorAssets.favorites.open')}
      </button>
      {open && <FavoritesDialog schema={schema} onClose={() => setOpen(false)} />}
    </>
  )
}

const NEW_CATEGORY = 'new'
const CATEGORIES_KEY = ['editor', 'favorite-categories']

/** زر «☆ حفظ كمفضلة» في رأس الـinspector + نافذة صغيرة للاسم والتصنيف (بدل ‎window.prompt‎ القديم). */
export function SaveFavoriteButton({ block, spec }: { block: DocBlock; spec: BlockSpec }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="ed-btn ed-btn--sm" onClick={() => setOpen(true)}>
        {t('editorAssets.favorites.save')}
      </button>
      {open && <SaveFavoriteDialog block={block} spec={spec} onClose={() => setOpen(false)} />}
    </>
  )
}

function SaveFavoriteDialog({ block, spec, onClose }: { block: DocBlock; spec: BlockSpec; onClose: () => void }) {
  const { t } = useTranslation()
  const ui = useEditorUi()
  const client = useQueryClient()
  const [name, setName] = useState(block.label || spec.label)
  /** ‎''‎ بدون تصنيف · رقم نصّي · ‎NEW_CATEGORY‎ تصنيف جديد باسمه في ‎newName‎ */
  const [category, setCategory] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  // قايمة خفيفة (من غير الأقسام): مش بنحمّل المكتبة كلها عشان اختيار تصنيف
  const categories = useQuery({ queryKey: CATEGORIES_KEY, queryFn: fetchFavoriteCategories, staleTime: 0 })

  const creating = category === NEW_CATEGORY
  const ready = name.trim() !== '' && (!creating || newName.trim() !== '')
  const close = () => !busy && onClose()
  const submit = async () => {
    if (!ready) return
    setBusy(true)
    try {
      const categoryId = creating ? (await createFavoriteCategory(newName.trim())).category.id : category === '' ? null : Number(category)
      await createFavorite(name.trim(), block, categoryId)
      void client.invalidateQueries({ queryKey: FAVORITES_KEY })
      void client.invalidateQueries({ queryKey: CATEGORIES_KEY })
      ui.toast(t('editorAssets.favorites.saved'), 'ok')
      onClose()
    } catch (error) {
      ui.toast(errorText(error, t, 'editorAssets.errors.favoriteSave'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal label={t('editorAssets.favorites.saveTitle')} onClose={close}>
      <h3>{t('editorAssets.favorites.saveTitle')}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="ed-field">
          <label htmlFor="ed-favorite-name">
            <span>{t('editorAssets.favorites.nameLabel')}</span>
          </label>
          <input
            id="ed-favorite-name"
            className="ed-input"
            type="text"
            maxLength={120}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="ed-field">
          <label htmlFor="ed-favorite-category">
            <span>{t('editorAssets.favorites.categoryLabel')}</span>
          </label>
          <select id="ed-favorite-category" className="ed-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('editorAssets.favorites.uncategorized')}</option>
            {(categories.data?.categories ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>{t('editorAssets.favorites.newCategory')}</option>
          </select>
        </div>
        {creating && (
          <div className="ed-field">
            <label htmlFor="ed-favorite-new-category">
              <span>{t('editorAssets.favorites.newCategoryName')}</span>
            </label>
            <input
              id="ed-favorite-new-category"
              className="ed-input"
              type="text"
              maxLength={80}
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
        )}
        <div className="ed-modal-actions">
          <button type="button" className="ed-btn" disabled={busy} onClick={close}>
            {t('editorAssets.cancel')}
          </button>
          <button type="submit" className="ed-btn ed-btn--primary" disabled={busy || !ready}>
            {t('editorAssets.favorites.saveConfirm')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
