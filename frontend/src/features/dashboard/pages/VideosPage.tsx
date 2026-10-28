import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useVideos } from '../api'
import type { VideoRow } from '../types'
import { useConfirm } from '../ui/ConfirmDialog'
import { ErrorList, FileField, MB, useFormErrors } from '../ui/forms'
import { InlineEdit } from '../ui/InlineEdit'
import { PageHead, usePageTitle } from '../ui/page'
import { QueryState, Table } from '../ui/table'
import { useToast } from '../ui/Toast'

/** نافذة تشغيل الفيديو: بتفتح بالضغط على المعاينة وتتقفل بـ‎Escape‎ أو بالضغط برّه. */
function PreviewDialog({ row, onClose }: { row: VideoRow; onClose: () => void }) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="dash-dialog-veil"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dash-dialog video-dialog" role="dialog" aria-modal="true" aria-label={row.name}>
        <video className="video-dialog-player" src={row.url} poster={row.posterUrl || undefined} controls autoPlay playsInline />
        <div className="video-dialog-foot">
          <strong>{row.name}</strong>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            {t('dashboard.videos.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** مكتبة الفيديوهات العامة: كل فيديو في أي دعوة أو قالب — واللي بيتنقل للافتتاحيات بيختفي من هنا. */
export function VideosPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const { list, create, rename, toIntro } = useVideos()
  const errors = useFormErrors()
  const [preview, setPreview] = useState<VideoRow | null>(null)
  usePageTitle(t('dashboard.videos.pageTitle'))

  const rows = list.data?.results ?? []

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    errors.clear()
    create.mutate(new FormData(form), {
      onSuccess: (row) => {
        toast.success(t('dashboard.videos.added', { name: row.name }))
        form.reset()
      },
      onError: (error) => {
        if (errors.fail(error)) toast.error(t('dashboard.videos.reviewData'))
        else toast.fail(error)
      },
    })
  }

  function onRename(row: VideoRow, name: string) {
    return rename.mutateAsync({ id: row.id, name }).then(
      () => toast.success(t('dashboard.videos.renamed', { name })),
      (error: unknown) => {
        toast.fail(error)
        throw error
      },
    )
  }

  async function onMove(row: VideoRow) {
    const message = t('dashboard.videos.confirmMove', { name: row.name })
    if (!(await confirm({ message, confirmLabel: t('dashboard.videos.moveToIntros') }))) return
    toIntro.mutate(row.id, {
      onSuccess: () => toast.success(t('dashboard.videos.moved', { name: row.name })),
      onError: toast.fail,
    })
  }

  return (
    <>
      <PageHead title={t('dashboard.videos.title')}>
        <Link className="btn btn--ghost" to="/dashboard/invitations">
          {t('dashboard.common.backToInvitations')}
        </Link>
      </PageHead>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>{t('dashboard.common.howItWorks')}</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          <Trans i18nKey="dashboard.videos.how" components={{ strong: <strong /> }} />
        </p>
      </div>

      <div className="grid split-layout">
        <div>
          <h2 style={{ fontSize: 18 }}>{t('dashboard.videos.listTitle', { n: rows.length })}</h2>
          <QueryState loading={list.isPending} error={list.isError} />
          {list.data && (
            <Table
              cards="lg"
              className="rows-table"
              head={[
                t('dashboard.videos.cols.name'),
                t('dashboard.videos.cols.preview'),
                t('dashboard.videos.cols.source'),
                t('dashboard.videos.cols.size'),
                null,
              ]}
              empty={t('dashboard.videos.none')}
              isEmpty={rows.length === 0}
            >
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="cell--title">
                    <InlineEdit
                      value={row.name}
                      label={t('dashboard.videos.editName')}
                      maxLength={200}
                      required
                      onSave={(name) => onRename(row, name)}
                    />
                    {row.createdAt && <span className="muted cell-desc">{row.createdAt}</span>}
                  </td>
                  <td data-label={t('dashboard.videos.cols.preview')}>
                    <button
                      type="button"
                      className="video-thumb"
                      aria-label={t('dashboard.videos.play', { name: row.name })}
                      onClick={() => setPreview(row)}
                    >
                      <video
                        src={`${row.url}#t=0.1`}
                        poster={row.posterUrl || undefined}
                        preload="metadata"
                        muted
                        playsInline
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                      <span className="video-thumb-play" aria-hidden="true">
                        ▶
                      </span>
                    </button>
                  </td>
                  <td data-label={t('dashboard.videos.cols.source')}>{row.owner || t('dashboard.videos.shared')}</td>
                  <td data-label={t('dashboard.videos.cols.size')} className="nums">
                    {row.sizeLabel || '—'}
                  </td>
                  <td className="cell--actions">
                    <div className="toolbar" style={{ margin: 0 }}>
                      <button className="btn btn--ghost btn--sm" type="button" onClick={() => setPreview(row)}>
                        {t('dashboard.videos.watch')}
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        type="button"
                        disabled={toIntro.isPending}
                        onClick={() => void onMove(row)}
                      >
                        {t('dashboard.videos.moveToIntros')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <aside className="card">
          <h2 style={{ fontSize: 17, marginTop: 0 }}>{t('dashboard.videos.addTitle')}</h2>
          <form className="form" onSubmit={onSubmit} encType="multipart/form-data">
            <ErrorList message={errors.formError} nonField />
            <FileField
              name="file"
              label={t('dashboard.videos.fields.file')}
              accept="video/mp4,video/webm"
              maxBytes={40 * MB}
              error={errors.fields.file}
            />
            <button className="btn btn--gold btn--block" type="submit" disabled={create.isPending}>
              {t('dashboard.videos.upload')}
            </button>
          </form>
        </aside>
      </div>

      {preview && <PreviewDialog row={preview} onClose={() => setPreview(null)} />}
    </>
  )
}
