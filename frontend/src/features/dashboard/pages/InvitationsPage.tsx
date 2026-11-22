import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { appPath } from '@/lib/appPath'

import {
  useDeleteInvitation,
  useDuplicateInvitation,
  useInvitations,
  useSetInvitationPaid,
  useSetInvitationStatus,
} from '../api'
import type { InvitationFilters, InvitationRow } from '../types'
import { useConfirm } from '../ui/ConfirmDialog'
import { useLabels } from '../ui/labels'
import { usePageTitle } from '../ui/page'
import { RowMenu, RowMenuButton, RowMenuCopy, RowMenuLink, RowMenuTitle } from '../ui/RowMenu'
import { QueryState, Table } from '../ui/table'
import { useToast } from '../ui/Toast'

/** الدعوات: بحث + فلتر الحالة والقالب + قايمة الروابط والإجراءات (‎templates/dashboard/invitations.html‎). */
export function InvitationsPage() {
  const { t } = useTranslation()
  const labels = useLabels()
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const duplicate = useDuplicateInvitation()
  const remove = useDeleteInvitation()
  usePageTitle(t('dashboard.invitations.pageTitle'))

  const filters: InvitationFilters = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    template: params.get('template') ?? '',
  }
  const { data, isPending, isError } = useInvitations(filters)
  const host = window.location.origin
  const rows = data?.results ?? []
  const paidCount = rows.filter((row) => Number(row.paidAmount) > 0).length
  const stats: [string, number][] = [
    ['invitations', rows.length],
    ['published', rows.filter((row) => row.status === 'published').length],
    ['guests', rows.reduce((sum, row) => sum + row.guests, 0)],
    ['rsvps', rows.reduce((sum, row) => sum + row.rsvps, 0)],
    ['views', rows.reduce((sum, row) => sum + row.views, 0)],
  ]

  function applyFilters(form: HTMLFormElement) {
    const values = new FormData(form)
    const next = new URLSearchParams()
    for (const key of ['q', 'status', 'template'] as const) {
      const value = String(values.get(key) ?? '').trim()
      if (value) next.set(key, value)
    }
    setParams(next)
  }

  function onDuplicate(invitation: InvitationRow) {
    duplicate.mutate(invitation.id, {
      onSuccess: (copy) =>
        toast.success(t('dashboard.invitations.duplicated', { title: invitation.title, copy: copy.title })),
      onError: toast.fail,
    })
  }

  async function onDelete(invitation: InvitationRow) {
    let message = t('dashboard.invitations.confirmDelete', { title: invitation.title })
    if (invitation.guests) {
      message += `\n${t('dashboard.invitations.confirmGuests', { guests: invitation.guests, rsvps: invitation.rsvps })}`
    }
    if (invitation.status === 'published') message += `\n${t('dashboard.invitations.confirmPublished')}`
    if (!(await confirm({ message, danger: true, confirmLabel: t('dashboard.common.delete') }))) return
    remove.mutate(invitation.id, {
      onSuccess: () => toast.success(t('dashboard.invitations.deleted', { title: invitation.title })),
      onError: toast.fail,
    })
  }

  return (
    <>
      <section className="inv-hero">
        <div className="inv-hero__text">
          <span className="inv-hero__kicker">BAHJA · INVITATIONS</span>
          <h1>{t('dashboard.invitations.title')}</h1>
          <div className="inv-hero__orn" aria-hidden="true">
            <i />
            <b />
            <i />
          </div>
          <p>{t('dashboard.invitations.heroSubtitle')}</p>
          <Link className="btn btn--gold inv-hero__new" to="/dashboard/invitations/new">
            {t('dashboard.common.newInvitation')}
          </Link>
        </div>
        <div className="inv-hero__total">
          <span>{t('dashboard.invitations.totalPaid')}</span>
          <strong>
            {data ? formatMoney(data.totalPaid) : '—'}
            <small>{t('dashboard.invitations.currency')}</small>
          </strong>
          {data && <em>{t('dashboard.invitations.totalPaidFrom', { n: paidCount, total: data.results.length })}</em>}
        </div>
      </section>

      <div className="inv-stats">
        {stats.map(([key, value]) => (
          <div className="inv-stat" key={key}>
            <strong>{data ? formatMoney(String(value)) : '—'}</strong>
            <span>{t(`dashboard.invitations.stats.${key}`)}</span>
          </div>
        ))}
      </div>

      <form
        className="toolbar inv-toolbar"
        key={params.toString()}
        onSubmit={(event) => {
          event.preventDefault()
          applyFilters(event.currentTarget)
        }}
      >
        <label className="inv-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder={t('dashboard.invitations.searchPlaceholder')}
            aria-label={t('dashboard.invitations.searchPlaceholder')}
          />
        </label>
        <select name="status" defaultValue={filters.status}>
          <option value="">{t('dashboard.invitations.allStatuses')}</option>
          {data?.statusChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {labels.status(choice.value)}
            </option>
          ))}
        </select>
        <select name="template" defaultValue={data?.filters.template ?? filters.template}>
          <option value="">{t('dashboard.invitations.allTemplates')}</option>
          {data?.templateChoices.map((choice) => (
            <option key={choice.id} value={String(choice.id)}>
              {choice.name}
            </option>
          ))}
        </select>
        <button className="btn btn--ghost btn--sm" type="submit">
          {t('dashboard.invitations.search')}
        </button>
      </form>

      <QueryState loading={isPending} error={isError} />
      {data && (
        <Table
          cards="lg"
          className="inv-table inv-lux"
          head={[
            t('dashboard.invitations.cols.invitation'),
            t('dashboard.invitations.cols.customer'),
            t('dashboard.invitations.cols.template'),
            t('dashboard.invitations.cols.status'),
            t('dashboard.invitations.cols.guests'),
            t('dashboard.invitations.cols.rsvps'),
            t('dashboard.invitations.cols.views'),
            t('dashboard.invitations.cols.paid'),
            t('dashboard.invitations.cols.created'),
            t('dashboard.invitations.cols.actions'),
          ]}
          empty={t('dashboard.invitations.empty')}
          isEmpty={data.results.length === 0}
        >
          {data.results.map((invitation) => (
            <tr key={invitation.id}>
              <td className="cell--title">
                <strong>{invitation.title}</strong>
                <small className="muted">/i/{invitation.slug}/</small>
              </td>
              <td className="cell--text" data-label={t('dashboard.invitations.cols.customer')}>
                {invitation.customerName}
              </td>
              <td className="cell--text" data-label={t('dashboard.invitations.cols.template')}>
                {invitation.templateName}
              </td>
              <td data-label={t('dashboard.invitations.cols.status')}>
                <StatusSelect invitation={invitation} choices={data.statusChoices.map((choice) => choice.value)} />
              </td>
              <td data-label={t('dashboard.invitations.cols.guests')}>{invitation.guests}</td>
              <td data-label={t('dashboard.invitations.cols.rsvps')}>{invitation.rsvps}</td>
              <td data-label={t('dashboard.invitations.cols.views')}>{invitation.views}</td>
              <td data-label={t('dashboard.invitations.cols.paid')}>
                <PaidInput invitation={invitation} />
              </td>
              <td data-label={t('dashboard.invitations.cols.created')}>
                <time dateTime={invitation.createdAt ?? undefined} title={invitation.createdTitle}>
                  {invitation.createdLabel}
                </time>
              </td>
              <td className="cell--actions">
                <div className="row-actions">
                  <Link className="btn btn--gold btn--sm" to={appPath(invitation.editorUrl)}>
                    {t('dashboard.common.editor')}
                  </Link>
                  <Link className="btn btn--ghost btn--sm" to={`/dashboard/invitations/${invitation.id}/guests`}>
                    {t('dashboard.invitations.guests')}
                  </Link>
                  <RowMenu label={t('dashboard.invitations.links')}>
                    <RowMenuTitle>{t('dashboard.invitations.menu.invitation')}</RowMenuTitle>
                    <RowMenuLink href={invitation.url}>{t('dashboard.invitations.menu.openInvitation')}</RowMenuLink>
                    <RowMenuCopy text={host + invitation.url}>{t('dashboard.invitations.menu.copyInvitation')}</RowMenuCopy>

                    <RowMenuTitle>{t('dashboard.invitations.menu.client')}</RowMenuTitle>
                    <RowMenuLink href={invitation.clientUrl}>{t('dashboard.invitations.menu.openClient')}</RowMenuLink>
                    <RowMenuCopy text={host + invitation.clientUrl}>{t('dashboard.invitations.menu.copyClient')}</RowMenuCopy>

                    <RowMenuTitle>{t('dashboard.invitations.menu.venue')}</RowMenuTitle>
                    <RowMenuLink href={invitation.venueUrl}>{t('dashboard.invitations.menu.openVenue')}</RowMenuLink>
                    <RowMenuCopy text={host + invitation.venueUrl}>{t('dashboard.invitations.menu.copyVenue')}</RowMenuCopy>

                    <RowMenuTitle>{t('dashboard.invitations.menu.itself')}</RowMenuTitle>
                    <RowMenuButton icon="⎘" onClick={() => onDuplicate(invitation)}>
                      {t('dashboard.invitations.menu.duplicate')}
                    </RowMenuButton>
                    <RowMenuButton icon="✕" danger onClick={() => void onDelete(invitation)}>
                      {t('dashboard.invitations.menu.delete')}
                    </RowMenuButton>
                  </RowMenu>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  )
}

function formatMoney(value: string) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('en-US') : value
}

/** حبّة الحالة كقايمة: اختيار مسودة/منشورة/… بيتحفظ على طول من غير فتح المحرر. */
function StatusSelect({ invitation, choices }: { invitation: InvitationRow; choices: string[] }) {
  const { t } = useTranslation()
  const labels = useLabels()
  const toast = useToast()
  const save = useSetInvitationStatus()
  const status = save.isPending && save.variables ? save.variables.status : invitation.status

  return (
    <label className={`pill pill--${status} status-pick`} title={t('dashboard.invitations.changeStatus')}>
      <select
        value={status}
        disabled={save.isPending}
        aria-label={t('dashboard.invitations.changeStatus')}
        onChange={(event) => {
          const next = event.currentTarget.value
          save.mutate(
            { id: invitation.id, status: next },
            {
              onSuccess: () =>
                toast.success(t('dashboard.invitations.statusSaved', { title: invitation.title, status: labels.status(next) })),
              onError: toast.fail,
            },
          )
        }}
      >
        {choices.map((value) => (
          <option key={value} value={value}>
            {labels.status(value)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** خانة «المدفوع»: بتتحفظ لما تسيبها أو تدوس Enter؛ Esc بيرجّع القيمة القديمة. */
function PaidInput({ invitation }: { invitation: InvitationRow }) {
  const { t } = useTranslation()
  const toast = useToast()
  const save = useSetInvitationPaid()
  const initial = invitation.paidAmount === '0' ? '' : invitation.paidAmount

  function commit(input: HTMLInputElement) {
    const value = input.value.trim()
    if (value === initial) return
    save.mutate(
      { id: invitation.id, paidAmount: value },
      {
        onSuccess: (res) => {
          input.value = res.paidAmount === '0' ? '' : res.paidAmount
          toast.success(t('dashboard.invitations.paidSaved', { title: invitation.title }))
        },
        onError: (error) => {
          input.value = initial
          toast.fail(error)
        },
      },
    )
  }

  return (
    <label className={initial ? 'paid-field is-paid' : 'paid-field'}>
    <input
      key={initial}
      className="paid-input"
      type="text"
      inputMode="decimal"
      dir="ltr"
      defaultValue={initial}
      placeholder="—"
      aria-label={t('dashboard.invitations.cols.paid')}
      disabled={save.isPending}
      onBlur={(event) => commit(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          event.currentTarget.value = initial
          event.currentTarget.blur()
        }
      }}
    />
      <span>{t('dashboard.invitations.currency')}</span>
    </label>
  )
}
