import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useImages } from '../api'
import type { ImageRow } from '../types'
import { useConfirm } from '../ui/ConfirmDialog'
import { MB } from '../ui/forms'
import { extraCopies } from '../ui/imageCopies'
import { ImagePreviewDialog } from '../ui/ImagePreview'
import { InlineEdit } from '../ui/InlineEdit'
import { PageHead, Pill, usePageTitle } from '../ui/page'
import { QueryState } from '../ui/table'
import { useToast } from '../ui/Toast'

type Filter = 'all' | 'dups' | 'unused' | 'used'

const FILTERS: Filter[] = ['all', 'dups', 'unused', 'used']
/** كام صورة نرسم في المرة — المكتبة ممكن توصل لآلاف والمصغّرات بتتحمّل كسولة. */
const PAGE_SIZE = 60

/** مكتبة الصور العامة: كل صورة في أي دعوة أو قالب، مع إظهار المكرر وحذفه. */
export function ImagesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const { list, create, rename, remove, removeMany, dedupe } = useImages()
  const fileInput = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [preview, setPreview] = useState<ImageRow | null>(null)
  const [uploading, setUploading] = useState('')
  usePageTitle(t('dashboard.images.pageTitle'))

  const rows = useMemo(() => list.data?.results ?? [], [list.data])
  const duplicateExtra = list.data?.duplicateExtra ?? 0

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matching = rows.filter((row) => {
      if (filter === 'dups' && !row.dupGroup) return false
      if (filter === 'unused' && row.used) return false
      if (filter === 'used' && !row.used) return false
      return !needle || row.name.toLowerCase().includes(needle)
    })
    // المكرر جنب بعضه عشان المقارنة تبقى سهلة
    return filter === 'dups' ? [...matching].sort((a, b) => a.dupGroup.localeCompare(b.dupGroup) || a.id - b.id) : matching
  }, [rows, filter, query])

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length === 0) return
    let done = 0
    let failed = 0
    let lastError: unknown
    for (const file of files) {
      setUploading(t('dashboard.images.uploading', { done: done + failed + 1, total: files.length }))
      if (file.size > 8 * MB) {
        failed += 1
        lastError = new Error(t('dashboard.errors.fileTooLarge', { mb: 8 }))
        continue
      }
      const body = new FormData()
      body.append('file', file)
      try {
        await create.mutateAsync(body)
        done += 1
      } catch (error) {
        failed += 1
        lastError = error
      }
    }
    setUploading('')
    if (done > 0) toast.success(t('dashboard.images.uploaded', { n: done }))
    if (failed > 0) {
      toast.error(t('dashboard.images.uploadFailed', { n: failed }))
      if (done === 0) toast.fail(lastError)
    }
  }

  function onRename(row: ImageRow, name: string) {
    return rename.mutateAsync({ id: row.id, name }).then(
      () => toast.success(t('dashboard.images.renamed', { name })),
      (error: unknown) => {
        toast.fail(error)
        throw error
      },
    )
  }

  async function onDelete(row: ImageRow) {
    const message = t('dashboard.images.confirmDelete', { name: row.name })
    if (!(await confirm({ message, danger: true, confirmLabel: t('dashboard.common.delete') }))) return
    remove.mutate(row.id, {
      onSuccess: () => {
        toast.success(t('dashboard.images.deleted', { name: row.name }))
        setSelected((current) => {
          const next = new Set(current)
          next.delete(row.id)
          return next
        })
      },
      onError: toast.fail,
    })
  }

  async function onDeleteSelected() {
    const ids = [...selected]
    const message = t('dashboard.images.confirmDeleteMany', { n: ids.length })
    if (!(await confirm({ message, danger: true, confirmLabel: t('dashboard.common.delete') }))) return
    removeMany.mutate(ids, {
      onSuccess: () => {
        toast.success(t('dashboard.images.deletedMany', { n: ids.length }))
        setSelected(new Set())
      },
      onError: toast.fail,
    })
  }

  function onSelectExtras() {
    const ids = extraCopies(rows)
    if (ids.length === 0) {
      toast.warning(t('dashboard.images.selectExtrasNone'))
      return
    }
    setSelected(new Set(ids))
    setFilter('dups')
    toast.success(t('dashboard.images.selectExtrasDone', { n: ids.length }))
  }

  async function onDedupe() {
    try {
      const plan = await dedupe.mutateAsync(true)
      if (plan.removeCount === 0) {
        toast.warning(t('dashboard.images.dedupe.none'))
        return
      }
      const message = t('dashboard.images.dedupe.confirm', { remove: plan.removeCount, keep: plan.keepCount })
      if (!(await confirm({ message, danger: true, confirmLabel: t('dashboard.images.dedupe.confirmLabel') }))) return
      const done = await dedupe.mutateAsync(false)
      let text = t('dashboard.images.dedupe.done', { removed: done.removeCount, kept: done.keepCount })
      if (done.repointedDocs > 0) text += ' ' + t('dashboard.images.dedupe.doneDocs', { docs: done.repointedDocs })
      if (done.freedBytes > 0) {
        text += ' ' + t('dashboard.images.dedupe.doneFreed', { size: (done.freedBytes / MB).toFixed(1) })
      }
      setSelected(new Set())
      toast.success(text)
    } catch (error) {
      toast.fail(error)
    }
  }

  const shown = visible.slice(0, limit)
  const busy = remove.isPending || removeMany.isPending || dedupe.isPending

  return (
    <>
      <PageHead title={t('dashboard.images.title')}>
        <Link className="btn btn--ghost" to="/dashboard/invitations">
          {t('dashboard.common.backToInvitations')}
        </Link>
      </PageHead>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>{t('dashboard.common.howItWorks')}</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          <Trans i18nKey="dashboard.images.how" components={{ strong: <strong /> }} />
        </p>
      </div>

      <div className="toolbar image-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setLimit(PAGE_SIZE)
          }}
          placeholder={t('dashboard.images.searchPlaceholder')}
          aria-label={t('dashboard.images.searchPlaceholder')}
        />
        <div className="image-filters" role="group" aria-label={t('dashboard.images.filtersLabel')}>
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'btn btn--sm btn--gold' : 'btn btn--sm btn--ghost'}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value)
                setLimit(PAGE_SIZE)
              }}
            >
              {t(`dashboard.images.filters.${value}`)}
            </button>
          ))}
        </div>
        <span className="image-toolbar-spacer" />
        {duplicateExtra > 0 && (
          <>
            <button className="btn btn--ghost btn--sm" type="button" onClick={onSelectExtras} disabled={busy}>
              {t('dashboard.images.selectExtras')}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => void onDedupe()}
              disabled={busy}
              title={t('dashboard.images.dedupe.hint')}
            >
              {dedupe.isPending
                ? t('dashboard.images.dedupe.checking')
                : t('dashboard.images.dedupe.button', { n: duplicateExtra })}
            </button>
          </>
        )}
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => void onUpload(event)} />
        <button
          className="btn btn--gold btn--sm"
          type="button"
          disabled={uploading !== ''}
          onClick={() => fileInput.current?.click()}
        >
          {uploading || t('dashboard.images.upload')}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="image-selection" role="status">
          <strong>{t('dashboard.images.selectedCount', { n: selected.size })}</strong>
          <button className="btn btn--danger btn--sm" type="button" disabled={busy} onClick={() => void onDeleteSelected()}>
            {t('dashboard.images.deleteSelected', { n: selected.size })}
          </button>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => setSelected(new Set())}>
            {t('dashboard.images.clearSelection')}
          </button>
        </div>
      )}

      <h2 style={{ fontSize: 18 }}>{t('dashboard.images.listTitle', { n: visible.length })}</h2>
      <QueryState loading={list.isPending} error={list.isError} />
      {list.data && visible.length === 0 && (
        <p className="empty">{rows.length === 0 ? t('dashboard.images.none') : t('dashboard.images.noMatch')}</p>
      )}

      {shown.length > 0 && (
        <ul className="image-grid">
          {shown.map((row) => (
            <li key={row.id} className={selected.has(row.id) ? 'image-card is-selected' : 'image-card'}>
              <div className="image-card-frame">
                <button
                  type="button"
                  className="image-card-thumb"
                  aria-label={t('dashboard.images.preview', { name: row.name })}
                  onClick={() => setPreview(row)}
                >
                  <img src={row.thumbUrl || row.url} alt="" loading="lazy" decoding="async" />
                </button>
                <input
                  type="checkbox"
                  className="image-card-check"
                  checked={selected.has(row.id)}
                  disabled={row.used}
                  title={row.used ? t('dashboard.images.usedLocked') : undefined}
                  aria-label={t('dashboard.images.select', { name: row.name })}
                  onChange={() => toggle(row.id)}
                />
              </div>
              <div className="image-card-body">
                <InlineEdit
                  value={row.name}
                  label={t('dashboard.images.editName')}
                  maxLength={200}
                  required
                  onSave={(name) => onRename(row, name)}
                />
                <span className="muted image-card-meta">
                  {[row.width && row.height ? `${row.width}×${row.height}` : '', row.sizeLabel].filter(Boolean).join(' · ')}
                </span>
                <span className="muted image-card-meta">
                  {row.ownerKind === 'invitation'
                    ? t('dashboard.images.ownerInvitation', { name: row.owner })
                    : row.ownerKind === 'template'
                      ? t('dashboard.images.ownerTemplate', { name: row.owner })
                      : t('dashboard.images.shared')}
                  {row.createdAt && ` · ${row.createdAt}`}
                </span>
                <div className="image-card-badges">
                  {row.dupGroup && <Pill kind="review">{t('dashboard.images.dupBadge', { n: row.dupCount })}</Pill>}
                  {row.used && <Pill kind="published">{t('dashboard.images.usedBadge')}</Pill>}
                </div>
                <button
                  className="btn btn--ghost btn--sm image-card-delete"
                  type="button"
                  disabled={row.used || busy}
                  title={row.used ? t('dashboard.images.usedLocked') : undefined}
                  onClick={() => void onDelete(row)}
                >
                  {t('dashboard.common.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {visible.length > shown.length && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button className="btn btn--ghost" type="button" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            {t('dashboard.images.showMore', { n: visible.length - shown.length })}
          </button>
        </div>
      )}

      {preview && <ImagePreviewDialog image={preview} onClose={() => setPreview(null)} />}
    </>
  )
}
