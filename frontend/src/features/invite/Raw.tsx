import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

import { morphInto } from './runtime/morph'
import { runSectionScripts } from './runtime/code-roots'

const CONTENTS: CSSProperties = { display: 'contents' }

/**
 * HTML جاهز من السيرفر (متنقّى هناك). الغلاف ‎display: contents‎ فمايأثّرش على
 * التخطيط. سكربتات «كود متقدّم» (‎data-lb-section-script‎) بتتنفّذ بعد الحقن
 * لأن ‎innerHTML‎ مابيشغّلش السكربتات.
 *
 * ‎morph‎ (المحرر بس): لما الـHTML يتغيّر بنطبّق الفرق على العقد الحية بدل ما نبنيها من جديد،
 * فتعديل خط أو نص أو لون جوّه كود القسم مايعيدش تشغيل السكربت والأنيميشن من الأول.
 */
export function Raw({ html, morph = false }: { html: string; morph?: boolean }) {
  if (!html) return null
  return morph ? <MorphRaw html={html} /> : <PlainRaw html={html} />
}

function PlainRaw({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (ref.current) runSectionScripts(ref.current)
  }, [html])
  return <div ref={ref} style={CONTENTS} dangerouslySetInnerHTML={{ __html: html }} />
}

function MorphRaw({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // React يكتب الـHTML مرة واحدة (عند التركيب)؛ كل تغيير بعد كده بنطبّقه إحنا
  const [initial] = useState(html)
  const shown = useRef<string | null>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const before = shown.current
    shown.current = html
    if (before === null) {
      runSectionScripts(root)
      return
    }
    if (before === html || morphInto(root, before, html)) return
    root.innerHTML = html
    runSectionScripts(root)
  }, [html])
  return <div ref={ref} style={CONTENTS} dangerouslySetInnerHTML={{ __html: initial }} />
}
