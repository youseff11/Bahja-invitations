import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

interface InlineEditProps {
  value: string
  /** بيرجّع Promise: لو اتحققت بنقفل المحرر، ولو اترفضت بيفضل مفتوح عشان الكتابة ماتضيعش. */
  onSave: (value: string) => Promise<unknown>
  label: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
  /** الفاضي مرفوض (الاسم) — بنرجع للقيمة القديمة بدل ما نبعت طلب. */
  required?: boolean
  className?: string
}

/**
 * نص بيتحوّل لحقل تعديل بمجرد الضغط عليه. ‎Enter‎ أو الخروج من الحقل بيحفظ،
 * و‎Escape‎ بيلغي (و‎Shift+Enter‎ سطر جديد في الوصف).
 */
export function InlineEdit({
  value,
  onSave,
  label,
  placeholder,
  multiline = false,
  maxLength,
  required = false,
  className = '',
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  // Enter بيحفظ ثم الحقل بيفقد التركيز فيحصل blur — بنمنع الحفظ مرتين
  const settled = useRef(false)

  useEffect(() => {
    if (!editing) return
    const el = field.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  useEffect(() => {
    if (!editing || !multiline) return
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft, editing, multiline])

  function start() {
    settled.current = false
    setDraft(value)
    setEditing(true)
  }

  function cancel() {
    settled.current = true
    setEditing(false)
  }

  async function commit() {
    if (settled.current || saving) return
    const next = draft.trim()
    if (next === value.trim() || (required && !next)) return cancel()
    settled.current = true
    setSaving(true)
    try {
      await onSave(next)
      setEditing(false)
    } catch {
      // الخطأ اتعرض في التوست؛ الحقل بيفضل مفتوح بنصه عشان يصحّحه ويحاول تاني
      settled.current = false
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    } else if (event.key === 'Enter' && !(multiline && event.shiftKey)) {
      event.preventDefault()
      void commit()
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={`inline-edit ${value ? '' : 'inline-edit--empty'} ${className}`}
        title={label}
        aria-label={`${label}: ${value || placeholder || ''}`}
        onClick={start}
      >
        {value || placeholder}
      </button>
    )
  }

  const shared = {
    ref: field,
    className: `inline-edit-field ${className}`,
    value: draft,
    maxLength,
    readOnly: saving, // مش disabled عشان التركيز مايضيعش لو الحفظ فشل
    placeholder,
    'aria-label': label,
    onKeyDown,
    onBlur: () => void commit(),
  }
  return multiline ? (
    <textarea {...shared} rows={2} onChange={(event) => setDraft(event.target.value)} />
  ) : (
    <input {...shared} type="text" onChange={(event) => setDraft(event.target.value)} />
  )
}
