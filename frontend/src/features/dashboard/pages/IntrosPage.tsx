import type { FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useLibrary } from '../api'
import { CheckField, ErrorList, FileField, MB, TextField, useFormErrors } from '../ui/forms'
import { LibraryActions } from '../ui/LibraryActions'
import { PageHead, Pill, usePageTitle } from '../ui/page'
import { QueryState, Table } from '../ui/table'
import { useToast } from '../ui/Toast'

/** مكتبة الافتتاحيات (‎templates/dashboard/intros.html‎). */
export function IntrosPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { list, create, toggle, remove } = useLibrary('intros')
  const errors = useFormErrors()
  usePageTitle(t('dashboard.intros.pageTitle'))

  const clips = list.data?.results ?? []

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    errors.clear()
    create.mutate(new FormData(form), {
      onSuccess: (clip) => {
        toast.success(t('dashboard.intros.added', { name: clip.name }))
        form.reset()
      },
      onError: (error) => {
        if (errors.fail(error)) toast.error(t('dashboard.intros.reviewData'))
        else toast.fail(error)
      },
    })
  }

  return (
    <>
      <PageHead title={t('dashboard.intros.title')}>
        <Link className="btn btn--ghost" to="/dashboard/invitations">
          {t('dashboard.common.backToInvitations')}
        </Link>
      </PageHead>

      <div className="card" style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>{t('dashboard.common.howItWorks')}</h2>
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 13.5 }}>
          <Trans i18nKey="dashboard.intros.how" components={{ strong: <strong /> }} />
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {t('dashboard.intros.howNote')}
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', alignItems: 'start' }}>
        <div>
          <h2 style={{ fontSize: 18 }}>{t('dashboard.intros.listTitle', { n: clips.length })}</h2>
          <QueryState loading={list.isPending} error={list.isError} />
          {list.data && (
            <Table
              head={[
                t('dashboard.intros.cols.name'),
                t('dashboard.intros.cols.preview'),
                t('dashboard.intros.cols.duration'),
                t('dashboard.intros.cols.order'),
                t('dashboard.intros.cols.status'),
                null,
              ]}
              empty={t('dashboard.intros.none')}
              isEmpty={clips.length === 0}
            >
              {clips.map((clip) => (
                <tr key={clip.id}>
                  <td>
                    {clip.name}
                    {clip.note && (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: 12.5 }}>
                          {clip.note}
                        </span>
                      </>
                    )}
                  </td>
                  <td>
                    {clip.url ? (
                      <video
                        controls
                        preload="none"
                        src={clip.url}
                        poster={clip.posterUrl || undefined}
                        style={{ width: 190, maxWidth: '100%', borderRadius: 8 }}
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="nums">
                    {clip.secondsLabel ? `${clip.secondsLabel} ${t('dashboard.intros.secondsUnit')}` : '—'}
                  </td>
                  <td>{clip.order}</td>
                  <td>
                    {clip.isActive ? (
                      <Pill kind="published">{t('dashboard.intros.available')}</Pill>
                    ) : (
                      <Pill kind="archived">{t('dashboard.intros.hidden')}</Pill>
                    )}
                  </td>
                  <td>
                    <LibraryActions kind="intros" row={clip} toggle={toggle} remove={remove} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <aside className="card">
          <h2 style={{ fontSize: 17, marginTop: 0 }}>{t('dashboard.intros.addTitle')}</h2>
          <form className="form" onSubmit={onSubmit} encType="multipart/form-data">
            <ErrorList message={errors.formError} nonField />
            <TextField
              name="name"
              label={t('dashboard.intros.fields.name')}
              maxLength={120}
              required
              error={errors.fields.name}
            />
            <FileField
              name="file"
              label={t('dashboard.intros.fields.file')}
              accept="video/mp4,video/webm"
              maxBytes={40 * MB}
              error={errors.fields.file}
            />
            <FileField
              name="poster"
              label={t('dashboard.intros.fields.poster')}
              accept="image/*"
              maxBytes={8 * MB}
              error={errors.fields.poster}
            />
            <TextField
              name="externalUrl"
              type="url"
              label={t('dashboard.intros.fields.externalUrl')}
              placeholder="https://.../intro.mp4"
              maxLength={200}
              help={t('dashboard.intros.externalUrlHelp')}
              helpSmall
              error={errors.fields.externalUrl}
            />
            <TextField
              name="note"
              label={t('dashboard.intros.fields.note')}
              maxLength={200}
              error={errors.fields.note}
            />
            <CheckField name="isActive" label={t('dashboard.intros.fields.isActive')} defaultChecked />
            <TextField
              name="order"
              type="number"
              label={t('dashboard.intros.fields.order')}
              defaultValue={0}
              min={0}
              required
              error={errors.fields.order}
            />
            <button className="btn btn--gold btn--block" type="submit" disabled={create.isPending}>
              {t('dashboard.common.saveToLibrary')}
            </button>
          </form>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
            {t('dashboard.intros.footnote')}
          </p>
        </aside>
      </div>
    </>
  )
}
