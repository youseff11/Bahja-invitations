import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useComposeSettings, useSaveComposeSettings } from '../api'
import { useToast } from '../ui/Toast'

/**
 * إعدادات قسم «اعملوا دعوتكم بذوقكم» في الرئيسية: الأدمن بيختار القوالب اللي تظهر
 * حوالين التلفون وبيرتّبها. القالب اللي مالوش حتت (لقطات) مايتختارش.
 */
export function ComposeCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data } = useComposeSettings()
  const save = useSaveComposeSettings()
  const [picked, setPicked] = useState<number[]>([])

  useEffect(() => {
    if (data) setPicked(data.selected)
  }, [data])

  if (!data) return null
  const byId = new Map(data.templates.map((row) => [row.id, row]))
  const usable = data.templates.filter((row) => row.parts.length > 0)
  const full = picked.length >= data.max

  const toggle = (id: number) =>
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : full ? list : [...list, id]))
  const move = (index: number, step: -1 | 1) =>
    setPicked((list) => {
      const next = [...list]
      const to = index + step
      if (to < 0 || to >= next.length) return list
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })

  function onSave() {
    save.mutate(picked, {
      onSuccess: () => toast.success(t('dashboard.site.compose.saved')),
      onError: (error) => toast.fail(error),
    })
  }

  return (
    <div className="card compose-admin" style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>{t('dashboard.site.compose.title')}</h2>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
        {t('dashboard.site.compose.body', { max: data.max })}
      </p>

      <h3 className="compose-admin-sub">{t('dashboard.site.compose.order')}</h3>
      {picked.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>{t('dashboard.site.compose.auto')}</p>
      ) : (
        <ol className="compose-admin-order">
          {picked.map((id, index) => {
            const row = byId.get(id)
            return (
              <li key={id}>
                <span className="compose-admin-n">{index + 1}</span>
                <strong>{row?.name ?? `#${id}`}</strong>
                {row && !row.isActive && <em className="muted">{t('dashboard.site.compose.hidden')}</em>}
                <span className="compose-admin-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(index, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => move(index, 1)}
                    disabled={index === picked.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggle(id)}>
                    {t('dashboard.site.compose.remove')}
                  </button>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <h3 className="compose-admin-sub">{t('dashboard.site.compose.available')}</h3>
      <div className="compose-admin-grid">
        {data.templates.map((row) => {
          const on = picked.includes(row.id)
          const disabled = row.parts.length === 0 || (!on && full)
          return (
            <button
              key={row.id}
              type="button"
              className={'compose-admin-tile' + (on ? ' is-on' : '')}
              onClick={() => toggle(row.id)}
              disabled={disabled}
              title={row.parts.length ? row.parts.join(' · ') : t('dashboard.site.compose.noPieces')}
            >
              {row.intro || row.cover ? <img src={row.intro || row.cover} alt="" loading="lazy" /> : <span className="compose-admin-ph" />}
              <span className="compose-admin-name">{row.name}</span>
              <small>
                {row.parts.length
                  ? t('dashboard.site.compose.parts', { count: row.parts.length })
                  : t('dashboard.site.compose.noPieces')}
              </small>
            </button>
          )
        })}
      </div>
      {usable.length === 0 && <p className="muted">{t('dashboard.site.compose.none')}</p>}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--gold" onClick={onSave} disabled={save.isPending}>
          {t('dashboard.site.compose.save')}
        </button>
      </div>
    </div>
  )
}
