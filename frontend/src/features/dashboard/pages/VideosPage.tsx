import type { FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useVideos } from '../api'
import type { VideoRow } from '../types'
import { useConfirm } from '../ui/ConfirmDialog'
import { ErrorList, FileField, MB, useFormErrors } from '../ui/forms'
import { PageHead, usePageTitle } from '../ui/page'
import { QueryState, Table } from '../ui/table'
import { useToast } from '../ui/Toast'

/** مكتبة الفيديوهات العامة: كل فيديو في أي دعوة أو قالب — واللي بيتنقل للافتتاحيات بيختفي من هنا. */
export function VideosPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const { list, create, toIntro } = useVideos()
  const errors = useFormErrors()
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

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', alignItems: 'start' }}>
        <div>
          <h2 style={{ fontSize: 18 }}>{t('dashboard.videos.listTitle', { n: rows.length })}</h2>
          <QueryState loading={list.isPending} error={list.isError} />
          {list.data && (
            <Table
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
                  <td>
                    {row.name}
                    {row.createdAt && (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: 12.5 }}>
                          {row.createdAt}
                        </span>
                      </>
                    )}
                  </td>
                  <td>
                    <video
                      controls
                      preload="none"
                      src={row.url}
                      poster={row.posterUrl || undefined}
                      style={{ width: 190, maxWidth: '100%', borderRadius: 8 }}
                    />
                  </td>
                  <td>{row.owner || t('dashboard.videos.shared')}</td>
                  <td className="nums">{row.sizeLabel || '—'}</td>
                  <td>
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      disabled={toIntro.isPending}
                      onClick={() => void onMove(row)}
                    >
                      {t('dashboard.videos.moveToIntros')}
                    </button>
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
    </>
  )
}
