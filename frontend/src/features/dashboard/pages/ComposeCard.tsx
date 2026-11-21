import { useEffect, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { TemplatesLayout } from '@/api/types'
import { useComposeSettings, useSaveComposeSettings } from '../api'
import { useToast } from '../ui/Toast'

/**
 * عرض القوالب في الرئيسية: الأدمن بيختار الشكل (تلفون بيشغّل القالب أو شبكة الكروت القديمة)
 * والقوالب اللي تظهر حوالين التلفون بالترتيب. مفيش اختيار = كل القوالب المفعّلة.
 */
export function ComposeCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data } = useComposeSettings()
  const save = useSaveComposeSettings()
  const [layout, setLayout] = useState<TemplatesLayout>('showcase')
  // ترتيب كل القوالب (= ترتيب المعرض والرئيسية والتلفون) — بيتغيّر بالسحب والإفلات
  const [order, setOrder] = useState<number[]>([])
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  useEffect(() => {
    if (!data) return
    setLayout(data.layout)
    setOrder(data.templates.map((row) => row.id))
  }, [data])

  if (!data) return null
  const byId = new Map(data.templates.map((row) => [row.id, row]))
  const rows = order.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row))

  /** بيشيل ‎id‎ من مكانه ويحطّه مكان ‎target‎ */
  function dropOn(target: number) {
    const id = drag
    setDrag(null)
    setOver(null)
    if (id == null || id === target) return
    setOrder((list) => {
      const from = list.indexOf(id)
      const to = list.indexOf(target)
      if (from < 0 || to < 0) return list
      const next = [...list]
      next.splice(from, 1)
      next.splice(to, 0, id)
      return next
    })
  }

  const move = (index: number, step: -1 | 1) =>
    setOrder((list) => {
      const to = index + step
      if (to < 0 || to >= list.length) return list
      const next = [...list]
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })

  const dragProps = (id: number) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(id))
      setDrag(id)
    },
    onDragOver: (event: DragEvent) => {
      if (drag == null) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (over !== id) setOver(id)
    },
    onDragLeave: () => setOver((current) => (current === id ? null : current)),
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      dropOn(id)
    },
    onDragEnd: () => {
      setDrag(null)
      setOver(null)
    },
  })

  function onSave() {
    // الترتيب الكامل هو المرجع الوحيد: مفيش قايمة "اللي تظهر الأول" منفصلة
    save.mutate({ templateIds: [], layout, order }, {
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

      <h3 className="compose-admin-sub">{t('dashboard.site.compose.layout')}</h3>
      <div className="compose-admin-layouts" role="radiogroup" aria-label={t('dashboard.site.compose.layout')}>
        {data.layouts.map((value) => (
          <label key={value} className={'compose-admin-layout' + (layout === value ? ' is-on' : '')}>
            <input type="radio" name="templatesLayout" value={value} checked={layout === value} onChange={() => setLayout(value)} />
            <span>
              <strong>{t(`dashboard.site.compose.layouts.${value}`)}</strong>
              <small className="muted">{t(`dashboard.site.compose.layouts.${value}Hint`)}</small>
            </span>
          </label>
        ))}
      </div>

      <h3 className="compose-admin-sub">{t('dashboard.site.compose.order')}</h3>
      <p className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>{t('dashboard.site.compose.dragHint')}</p>
      <ol className="compose-admin-stack">
        {rows.map((row, index) => (
          <li
            key={row.id}
            {...dragProps(row.id)}
            className={
              'compose-admin-card compose-admin-draggable' +
              (row.isActive ? '' : ' is-hidden') +
              (drag === row.id ? ' is-dragging' : '') +
              (over === row.id && drag !== row.id ? ' is-over' : '')
            }
          >
            <span className="compose-admin-grip" aria-hidden="true">⋮⋮</span>
            <span className="compose-admin-n">{index + 1}</span>
            {row.cover || row.intro ? (
              <img className="compose-admin-thumb" src={row.cover || row.intro} alt="" loading="lazy" draggable={false} />
            ) : (
              <span className="compose-admin-thumb compose-admin-ph" />
            )}
            <span className="compose-admin-info">
              <strong>{row.name}</strong>
              {!row.isActive && <em className="muted">{t('dashboard.site.compose.hidden')}</em>}
            </span>
            <span className="compose-admin-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label="up">
                ↑
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label="down"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      {data.templates.length === 0 && <p className="muted">{t('dashboard.site.compose.none')}</p>}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--gold" onClick={onSave} disabled={save.isPending}>
          {t('dashboard.site.compose.save')}
        </button>
      </div>
    </div>
  )
}
