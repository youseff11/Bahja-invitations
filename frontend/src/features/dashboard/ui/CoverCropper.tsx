import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

/** نسبة غلاف القالب (عرض:ارتفاع) — نفس ‎.tpl-cover { aspect-ratio: 1/1 }‎. */
const COVER_ASPECT = 1
/** المقاس المثالي للصورة (بالبكسل) عشان الغلاف يبان كامل وواضح حتى على الشاشات الكبيرة. */
const COVER_IDEAL = { width: 1200, height: 1200 }

const FRAME_W = 300
const FRAME_H = FRAME_W / COVER_ASPECT
const MAX_ZOOM = 4
const MAX_OUT_W = 1200
const STEP = 12

interface Point {
  x: number
  y: number
}

interface Props {
  file: File
  onCancel: () => void
  onDone: (file: File) => void
}

/** ‎zoom=1‎ يعني أصغر مقاس يغطي الإطار بالكامل (زي ‎background-size: cover‎). */
function clampOffset(offset: Point, natW: number, natH: number, zoom: number): Point {
  const scale = Math.max(FRAME_W / natW, FRAME_H / natH) * zoom
  const maxX = (natW * scale - FRAME_W) / 2
  const maxY = (natH * scale - FRAME_H) / 2
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

/** قص صورة الغلاف بنسبة ثابتة ١:١ — اسحب الصورة وكبّرها لحد ما الجزء المطلوب يبان جوه الإطار. */
export function CoverCropper({ file, onCancel, onDone }: Props) {
  const { t } = useTranslation()
  const [src, setSrc] = useState('')
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  const drag = useRef<{ pointer: Point; start: Point } | null>(null)
  const saveButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const scale = size ? Math.max(FRAME_W / size.w, FRAME_H / size.h) * zoom : 1

  function move(next: Point, nextZoom = zoom) {
    if (size) setOffset(clampOffset(next, size.w, size.h, nextZoom))
  }

  function changeZoom(value: number) {
    const next = Math.min(MAX_ZOOM, Math.max(1, value))
    setZoom(next)
    // التكبير حوالين مركز الإطار؛ نرجّع الإزاحة جوه الحدود الجديدة
    if (size) setOffset((current) => clampOffset(current, size.w, size.h, next))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: { x: event.clientX, y: event.clientY }, start: offset }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current) return
    move({
      x: current.start.x + event.clientX - current.pointer.x,
      y: current.start.y + event.clientY - current.pointer.y,
    })
  }

  function onFrameKey(event: KeyboardEvent<HTMLDivElement>) {
    const delta: Record<string, Point> = {
      ArrowLeft: { x: -STEP, y: 0 },
      ArrowRight: { x: STEP, y: 0 },
      ArrowUp: { x: 0, y: -STEP },
      ArrowDown: { x: 0, y: STEP },
    }
    const step = delta[event.key]
    if (!step) return
    event.preventDefault()
    move({ x: offset.x + step.x, y: offset.y + step.y })
  }

  const lowRes = !!size && FRAME_W / scale < COVER_IDEAL.width * 0.6

  function onSave() {
    const img = image.current
    if (!img || !size) return
    setBusy(true)
    // الجزء الظاهر جوه الإطار بإحداثيات الصورة الأصلية
    const left = FRAME_W / 2 + offset.x - (size.w * scale) / 2
    const top = FRAME_H / 2 + offset.y - (size.h * scale) / 2
    const sw = FRAME_W / scale
    const sh = FRAME_H / scale
    const outW = Math.min(MAX_OUT_W, Math.round(sw))
    const outH = Math.round(outW / COVER_ASPECT)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const context = canvas.getContext('2d')
    if (!context) {
      setBusy(false)
      setFailed(true)
      return
    }
    const keepPng = file.type === 'image/png'
    if (!keepPng) {
      context.fillStyle = '#fff' // JPEG مالوش شفافية
      context.fillRect(0, 0, outW, outH)
    }
    // max(0, …) بيمنع خروج صغير عن حدود الصورة بسبب تقريب الأعداد العشرية
    context.drawImage(img, Math.max(0, -left / scale), Math.max(0, -top / scale), sw, sh, 0, 0, outW, outH)
    const type = keepPng ? 'image/png' : 'image/jpeg'
    canvas.toBlob(
      (blob) => {
        setBusy(false)
        if (!blob) return setFailed(true)
        const base = file.name.replace(/\.[^.]+$/, '') || 'cover'
        onDone(new File([blob], `${base}-cover.${keepPng ? 'png' : 'jpg'}`, { type }))
      },
      type,
      0.92,
    )
  }

  const host = document.querySelector('.dash-root') ?? document.body

  return createPortal(
    <div
      className="dash-dialog-veil"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="dash-dialog cover-cropper" role="dialog" aria-modal="true" aria-label={t('dashboard.templates.cropTitle')}>
        <h3>{t('dashboard.templates.cropTitle')}</h3>
        <p className="muted cover-cropper-hint">
          {t('dashboard.templates.cropHint', { w: COVER_IDEAL.width, h: COVER_IDEAL.height })}
        </p>

        {failed ? (
          <p role="alert">{t('dashboard.templates.cropFailed')}</p>
        ) : (
          <>
            <div
              className="cover-cropper-frame"
              style={{ width: FRAME_W, height: FRAME_H }}
              tabIndex={0}
              aria-label={t('dashboard.templates.cropFrame')}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={onFrameKey}
            >
              {src && (
                <img
                  ref={image}
                  src={src}
                  alt=""
                  draggable={false}
                  onLoad={(event) => {
                    const { naturalWidth: w, naturalHeight: h } = event.currentTarget
                    setSize({ w, h })
                    saveButton.current?.focus()
                  }}
                  onError={() => setFailed(true)}
                  style={
                    size
                      ? {
                          width: size.w * scale,
                          height: size.h * scale,
                          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                        }
                      : { visibility: 'hidden' }
                  }
                />
              )}
            </div>
            <label className="cover-cropper-zoom">
              <span>{t('dashboard.templates.cropZoom')}</span>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => changeZoom(Number(event.target.value))}
              />
            </label>
            {lowRes && <p className="cover-cropper-warn">{t('dashboard.templates.cropLowRes')}</p>}
          </>
        )}

        <div className="dash-dialog-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            {t('dashboard.common.cancel')}
          </button>
          {!failed && (
            <button
              ref={saveButton}
              type="button"
              className="btn btn--gold btn--sm"
              disabled={!size || busy}
              onClick={onSave}
            >
              {t('dashboard.templates.cropSave')}
            </button>
          )}
        </div>
      </div>
    </div>,
    host,
  )
}
