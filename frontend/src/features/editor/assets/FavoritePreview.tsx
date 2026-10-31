import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchPreview } from '../api'
import { parseMessage, sendToFrame } from '../frame/bridge'
import { useEditor } from '../store'
import type { DocBlock, FromFrame, PreviewPayload } from '../types'
import { cachedPreview, loadStandalonePreview, rememberPreview } from './previewCache'

/**
 * معاينة صغيرة للقسم المفضّل: نفس إطار المعاينة (‎/editor-frame/‎) بس بقسم واحد، بثيم المستند الحالي،
 * ومصغّر. الحمولة بتتجاب من السيرفر لما الصف يظهر على الشاشة بس (القايمة ممكن تكون طويلة).
 *
 * ‎standalone‎ (صفحة المكتبة في اللوحة): مفيش مستند مفتوح، فالقسم بيتعرض لوحده بالثيم الافتراضي.
 */
export function FavoritePreview({
  block,
  standalone = false,
  className = 'ed-favorite-preview',
}: {
  block: DocBlock | null
  standalone?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined')
  const [payload, setPayload] = useState<PreviewPayload | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const node = box.current
    if (visible || !node) return
    // نبدأ قبل ما الصف يظهر بشاشة تقريباً، عشان يكون جاهز لما المستخدم يوصله
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !block) return
    const controller = new AbortController()
    if (standalone) {
      loadStandalonePreview(block, controller.signal)
        .then((next) => setPayload({ ...next, intro: null, showBranding: false }))
        .catch(() => !controller.signal.aborted && setFailed(true))
      return () => controller.abort()
    }
    const { mode, id, doc, fields, previewLang } = useEditor.getState()
    const single = { ...doc, blocks: [JSON.parse(JSON.stringify(block)) as DocBlock] }
    const key = `${mode}|${id}|${previewLang}|${JSON.stringify(single)}|${JSON.stringify(fields ?? null)}`
    const hit = cachedPreview(key)
    if (hit) {
      setPayload({ ...hit, intro: null, showBranding: false })
      return
    }
    fetchPreview(mode, id, single, previewLang, controller.signal, fields)
      .then((next) => {
        rememberPreview(key, next)
        setPayload({ ...next, intro: null, showBranding: false })
      })
      .catch(() => !controller.signal.aborted && setFailed(true))
    return () => controller.abort()
  }, [visible, block, standalone])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = parseMessage<FromFrame>(event, frame.current?.contentWindow)
      if (message?.type === 'lb-editor:ready') setReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [visible])

  useEffect(() => {
    if (ready && payload) sendToFrame(frame.current, { type: 'lb-editor:render', payload, selected: null, force: true })
  }, [ready, payload])

  const shown = ready && payload !== null
  return (
    <div className={className} ref={box} data-state={failed ? 'failed' : shown ? 'ready' : 'loading'} aria-hidden="true">
      {visible && block && <iframe ref={frame} src="/editor-frame/" title={t('editorAssets.favorites.previewTitle')} tabIndex={-1} scrolling="no" />}
      {failed && <span>{t('editorAssets.favorites.previewFailed')}</span>}
    </div>
  )
}
