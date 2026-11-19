import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { useSite } from '@/api/hooks'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useClientFollowup } from '../api'
import { absoluteUrl, passPath, qrPngUrl, qrSvgUrl, venuePath } from '../links'
import { rsvpLabel } from '../scanner/useScanFlow'
import { useNoIndex } from '../useNoIndex'
import { CopyButton } from './CopyButton'
import { InvalidLink } from './PageStatus'
import '../styles/base.css'
import '../styles/client.css'

/**
 * طباعة قسم لوحده (الردود أو رسائل التهنئة): الـCSS بيخفي الباقي لما ‎body.print-rsvp‎ أو ‎body.print-wishes‎
 * موجود، والمتصفح بيحفظه PDF بالخط العربي الصح من غير مكتبات. عنوان الصفحة هو اسم الملف الافتراضي.
 */
function printSection(mode: 'rsvp' | 'wishes', fileTitle: string) {
  const bodyClass = `print-${mode}`
  const previousTitle = document.title
  const done = () => {
    document.body.classList.remove(bodyClass)
    document.title = previousTitle
    window.removeEventListener('afterprint', done)
  }
  document.title = fileTitle
  document.body.classList.add(bodyClass)
  window.addEventListener('afterprint', done)
  window.print()
}

/**
 * ‎/i/:slug/client/:token‎ — لوحة متابعة خاصة بصاحب الدعوة (للقراءة فقط):
 * الحضور، رموز QR، ورسائل التهنئة. بتعرض الوحدات اللي اتجمّع فيها بيانات فعلاً.
 */
export function ClientFollowupPage() {
  const { slug = '', token = '' } = useParams()
  const { t } = useTranslation()
  const { data, error, isPending } = useClientFollowup(slug, token)
  const { data: site } = useSite()
  const siteName = site?.displayName ?? ''

  useNoIndex()
  useDocumentTitle(t('guests.client.docTitle', { site: siteName }))

  if (isPending) return <div className="gw client-followup-page" aria-busy="true" />
  if (error || !data) {
    return (
      <div className="gw client-followup-page">
        <main className="client-followup">
          <InvalidLink error={error} messageKey="guests.client.invalid" />
        </main>
      </div>
    )
  }

  const { invitation, hasRsvp, hasQr, hasGuestbook, hasAnswers, rsvpRows, messageRows, qrRows, stats } = data
  const venueLink = absoluteUrl(venuePath(invitation.slug, invitation.venueToken))
  const names = invitation.nameTwo ? `${invitation.nameOne} ${t('guests.client.and')}${invitation.nameTwo}` : invitation.nameOne
  const answersColumns = hasAnswers ? 6 : 5
  const fileNames = names || invitation.slug
  const canPrintRsvp = hasRsvp && rsvpRows.length > 0
  const canPrintWishes = hasGuestbook && messageRows.length > 0

  return (
    <div className="gw client-followup-page">
      <main className="client-followup">
        {/* الصفحة دي بيفتحها العميل نفسه، فمفيش كلام موجّه لينا ولا العنوان الداخلي ولا حالة النشر */}
        <header className="client-followup-welcome">
          <Link className="brand brand--stacked client-followup-logo" to="/">
            <span className="sr-only">{siteName}</span>
          </Link>
          <h1>{invitation.nameOne ? t('guests.client.welcomeNamed', { names }) : t('guests.client.welcome')}</h1>
          <span className="client-followup-orn" aria-hidden="true"><i /><b /><i /></span>
          <p className="client-followup-subtitle">{t('guests.client.subtitle')}</p>
          {(canPrintRsvp || canPrintWishes) && (
            <div className="client-followup-toolbar no-print">
              {canPrintRsvp && (
                <button
                  type="button"
                  className="btn btn--gold client-followup-tool"
                  onClick={() => printSection('rsvp', `${t('guests.client.rsvpTitle')} — ${fileNames}`)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" /></svg>
                  {t('guests.client.printReplies')}
                </button>
              )}
              {canPrintWishes && (
                <button
                  type="button"
                  className="btn btn--ghost client-followup-tool"
                  onClick={() => printSection('wishes', `${t('guests.client.wishesTitle')} — ${fileNames}`)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                  {t('guests.client.wishesPdfTop')}
                </button>
              )}
            </div>
          )}
        </header>

        <section className="client-followup-stats" aria-label={t('guests.client.summary')}>
          {hasRsvp && (
            <>
              <article className="client-followup-stat">
                <span className="client-followup-stat-icon">✓</span>
                <span className="client-followup-stat-label">{t('guests.client.allReplies')}</span>
                <strong>{stats.rsvpTotal}</strong>
              </article>
              <article className="client-followup-stat">
                <span className="client-followup-stat-icon client-followup-stat-icon--ok">♥</span>
                <span className="client-followup-stat-label">{t('guests.client.attending')}</span>
                <strong>{stats.attending}</strong>
              </article>
            </>
          )}
          {hasQr && (
            <>
              <article className="client-followup-stat">
                <span className="client-followup-stat-icon">▣</span>
                <span className="client-followup-stat-label">{t('guests.client.guestsQr')}</span>
                <strong>{stats.guests}</strong>
              </article>
              <article className="client-followup-stat">
                <span className="client-followup-stat-icon client-followup-stat-icon--ok">↗</span>
                <span className="client-followup-stat-label">{t('guests.client.checkedIn')}</span>
                <strong>{stats.checkedIn}</strong>
              </article>
            </>
          )}
          {hasGuestbook && (
            <article className="client-followup-stat">
              <span className="client-followup-stat-icon">✉</span>
              <span className="client-followup-stat-label">{t('guests.client.wishes')}</span>
              <strong>{stats.messages}</strong>
            </article>
          )}
        </section>

        {hasQr && (
          <section className="client-followup-section client-followup-venue" aria-labelledby="venue-title">
            <div className="client-followup-section-head">
              <div>
                <p className="client-followup-kicker">{t('guests.client.venueKicker')}</p>
                <h2 id="venue-title">{t('guests.client.venueTitle')}</h2>
              </div>
            </div>
            <p className="client-followup-venue-note">{t('guests.client.venueNote')}</p>
            <div className="client-followup-venue-row">
              <input
                className="client-followup-venue-input"
                type="text"
                value={venueLink}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                dir="ltr"
                aria-label={t('guests.client.venueLink')}
              />
              <CopyButton className="btn btn--gold btn--sm" text={venueLink}>
                {t('guests.client.copyLink')}
              </CopyButton>
              <Link
                className="btn btn--ghost btn--sm"
                to={venuePath(invitation.slug, invitation.venueToken)}
                target="_blank"
                rel="noopener"
              >
                {t('guests.client.open')}
              </Link>
              <a
                className="btn btn--ghost btn--sm"
                target="_blank"
                rel="noopener"
                href={`https://wa.me/?text=${encodeURIComponent(venueLink)}`}
              >
                {t('guests.client.whatsapp')}
              </a>
            </div>
          </section>
        )}

        {hasRsvp && (
          <section className="client-followup-section client-followup-rsvp" aria-labelledby="rsvp-title">
            <div className="client-followup-section-head">
              <div>
                <p className="client-followup-kicker">RSVP</p>
                <h2 id="rsvp-title">{t('guests.client.rsvpTitle')}</h2>
                {invitation.nameOne && <p className="client-followup-print-names">{names}</p>}
              </div>
              <span className="client-followup-count">{t('guests.client.repliesCount', { n: stats.rsvpTotal })}</span>
            </div>
            <div className="client-followup-table-wrap">
              <table className="client-followup-table client-followup-table--stack">
                <thead>
                  <tr>
                    <th>{t('guests.rsvp.name')}</th>
                    <th>{t('guests.rsvp.status')}</th>
                    <th>{t('guests.client.companions')}</th>
                    <th>{t('guests.client.comment')}</th>
                    {hasAnswers && <th>{t('guests.client.answers')}</th>}
                    <th>{t('guests.rsvp.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rsvpRows.map((row) => (
                    <tr key={row.id}>
                      <td data-label={t('guests.rsvp.name')} className="client-followup-cell-name">
                        <strong>{row.name}</strong>
                      </td>
                      <td data-label={t('guests.rsvp.status')}>
                        <span className={`client-followup-pill client-followup-pill--${row.status}`}>
                          {rsvpLabel(t, row.status)}
                        </span>
                      </td>
                      <td data-label={t('guests.client.companions')}>{row.companions}</td>
                      <td className="client-followup-message" data-label={t('guests.client.comment')}>{row.message || '—'}</td>
                      {hasAnswers && (
                        <td className="client-followup-answers" data-label={t('guests.client.answers')}>
                          {row.answers.length
                            ? row.answers.map((answer, index) => (
                                <span className="client-followup-answer" key={index}>
                                  <b>{answer.q}</b>
                                  {answer.a}
                                </span>
                              ))
                            : '—'}
                        </td>
                      )}
                      <td data-label={t('guests.rsvp.date')} className="client-followup-cell-date">{row.createdAt}</td>
                    </tr>
                  ))}
                  {rsvpRows.length === 0 && (
                    <tr>
                      <td colSpan={answersColumns} className="client-followup-empty">
                        {t('guests.client.noReplies')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {hasQr && (
          <section className="client-followup-section" aria-labelledby="qr-title">
            <div className="client-followup-section-head">
              <div>
                <p className="client-followup-kicker">QR</p>
                <h2 id="qr-title">{t('guests.client.qrTitle')}</h2>
              </div>
              <span className="client-followup-count">{t('guests.client.guestsCount', { n: stats.guests })}</span>
            </div>
            <div className="client-followup-table-wrap">
              <table className="client-followup-table client-followup-table--stack">
                <thead>
                  <tr>
                    <th>{t('guests.rsvp.name')}</th>
                    <th>{t('guests.client.passCode')}</th>
                    <th>{t('guests.client.entries')}</th>
                    <th>{t('guests.client.symbol')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {qrRows.map((row) => (
                    <tr key={row.id}>
                      <td data-label={t('guests.rsvp.name')} className="client-followup-cell-name">
                        <strong>{row.name}</strong>
                      </td>
                      <td data-label={t('guests.client.passCode')}>
                        <b className="client-followup-code">{row.passCode}</b>
                      </td>
                      <td data-label={t('guests.client.entries')}>
                        {row.entriesUsed} / {row.entriesAllowed}
                      </td>
                      <td data-label={t('guests.client.symbol')}>
                        <img className="client-followup-qr" src={qrSvgUrl(invitation.slug, row.token)} alt={`QR ${row.name}`} />
                      </td>
                      <td className="client-followup-actions">
                        <Link
                          className="btn btn--ghost btn--sm"
                          to={passPath(invitation.slug, row.token)}
                          target="_blank"
                          rel="noopener"
                        >
                          {t('guests.client.view')}
                        </Link>
                        <a className="btn btn--gold btn--sm" href={qrPngUrl(invitation.slug, row.token)}>
                          {t('guests.client.download')}
                        </a>
                      </td>
                    </tr>
                  ))}
                  {qrRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="client-followup-empty">
                        {t('guests.client.noGuests')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {hasGuestbook && (
          <section className="client-followup-section client-followup-wishes" aria-labelledby="messages-title">
            <div className="client-followup-section-head">
              <div>
                <p className="client-followup-kicker">GUESTBOOK</p>
                <h2 id="messages-title">{t('guests.client.wishesTitle')}</h2>
                {invitation.nameOne && <p className="client-followup-print-names">{names}</p>}
              </div>
              <span className="client-followup-count">{t('guests.client.wishesCount', { n: stats.messages })}</span>
            </div>
            <div className="client-followup-messages">
              {messageRows.map((row) => (
                <article className="client-followup-message-card" key={row.id}>
                  <div className="client-followup-message-card-head">
                    <strong>{row.name}</strong>
                    <time>{row.createdAt}</time>
                  </div>
                  <p>{row.message}</p>
                </article>
              ))}
              {messageRows.length === 0 && <p className="client-followup-empty">{t('guests.client.noWishes')}</p>}
            </div>
          </section>
        )}

        {!hasRsvp && !hasQr && !hasGuestbook && (
          <section className="client-followup-empty-state">
            <span>◇</span>
            <h2>{t('guests.client.emptyTitle')}</h2>
            <p>{t('guests.client.emptyText')}</p>
          </section>
        )}
      </main>
    </div>
  )
}
