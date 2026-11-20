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
  const [picked, setPicked] = useState<number[]>([])
  const [layout, setLayout] = useState<TemplatesLayout>('showcase')
  // ترتيب كل القوالب (= ترتيب المعرض والرئيسية) — بيتغيّر بالسحب والإفلات
  const [order, setOrder] = useState<number[]>([])
  const [dirtyOrder, setDirtyOrder] = useState(false)
  const [drag, setDrag] = useState<{ list: 'grid' | 'picked'; id: number } | null>(null)
  const [over, setOver] = useState<number | null>(null)

  useEffect(() => {
    if (!data) return
    setPicked(data.selected)
    setLayout(data.layout)
    setOrder(data.templates.map((row) => row.id))
    setDirtyOrder(false)
  }, [data])

  if (!data) return null
  const byId = new Map(data.templates.map((row) => [row.id, row]))
  const full = picked.length >= data.max
  const rows = order.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row))

  /** بيشيل ‎id‎ من مكانه ويحطّه مكان ‎target‎ */
  const reorder = (list: number[], id: number, target: number) => {
    const from = list.indexOf(id)
    const to = list.indexOf(target)
    if (from < 0 || to < 0 || from === to) return list
    const next = [...list]
    next.splice(from, 1)
    next.splice(to, 0, id)
    return next
  }

  function onDrop(list: 'grid' | 'picked', target: number) {
    const source = drag
    setDrag(null)
    setOver(null)
    if (!source || source.list !== list || source.id === target) return
    if (list === 'picked') {
      setPicked((current) => reorder(current, source.id, target))
      return
    }
    const next = reorder(order, source.id, target)
    setOrder(next)
    setDirtyOrder(true)
    // القوالب المختارة بتظهر الأول في الرئيسية: تمشي على نفس ترتيب الشبكة
    setPicked((current) => [...current].sort((a, b) => next.indexOf(a) - next.indexOf(b)))
  }

  const dragProps = (list: 'grid' | 'picked', id: number) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(id))
      setDrag({ list, id })
    },
    onDragOver: (event: DragEvent) => {
      if (!drag || drag.list !== list) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (over !== id) setOver(id)
    },
    onDragLeave: () => setOver((current) => (current === id ? null : current)),
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      onDrop(list, id)
    },
    onDragEnd: () => {
      setDrag(null)
      setOver(null)
    },
  })
  const dragClass = (list: 'grid' | 'picked', id: number) =>
    (drag?.list === list && drag.id === id ? ' is-dragging' : '') +
    (drag?.list === list && over === id && drag.id !== id ? ' is-over' : '')

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
    save.mutate({ templateIds: picked, layout, ...(dirtyOrder ? { order } : {}) }, {
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
      {picked.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>{t('dashboard.site.compose.auto')}</p>
      ) : (
        <ol className="compose-admin-order">
          {picked.map((id, index) => {
            const row = byId.get(id)
            return (
              <li key={id} {...dragProps('picked', id)} className={'compose-admin-draggable' + dragClass('picked', id)}>
                <span className="compose-admin-grip" aria-hidden="true">⋮⋮</span>
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
      <p className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>{t('dashboard.site.compose.dragHint')}</p>
      <div className="compose-admin-grid">
        {rows.map((row, index) => {
          const on = picked.includes(row.id)
          const disabled = !on && full
          return (
            <button
              key={row.id}
              type="button"
              className={'compose-admin-tile compose-admin-draggable' + (on ? ' is-on' : '') + (disabled ? ' is-full' : '') + dragClass('grid', row.id)}
              onClick={() => !disabled && toggle(row.id)}
              aria-disabled={disabled}
              {...dragProps('grid', row.id)}
            >
              <span className="compose-admin-rank">{index + 1}</span>
              {on && <span className="compose-admin-pick">★ {picked.indexOf(row.id) + 1}</span>}
              {row.cover || row.intro ? <img src={row.cover || row.intro} alt="" loading="lazy" /> : <span className="compose-admin-ph" />}
              <span className="compose-admin-name">{row.name}</span>
              {!row.isActive && <small>{t('dashboard.site.compose.hidden')}</small>}
            </button>
          )
        })}
      </div>
      {data.templates.length === 0 && <p className="muted">{t('dashboard.site.compose.none')}</p>}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--gold" onClick={onSave} disabled={save.isPending}>
          {t('dashboard.site.compose.save')}
        </button>
      </div>
    </div>
  )
}
