import { useCallback, useState } from 'react'

/**
 * قيمة نصية بتتحفظ في خانة التاريخ الحالية (جوّه ‎history.state.usr‎ اللي React Router بيقراه ‎location.state‎):
 * الرجوع بالسهم يرجّعها، والدخول الجديد للصفحة يبدأ من القيمة الافتراضية.
 * بنكتب في ‎history.state‎ مباشرة من غير ‎navigate‎ عشان الراوتر مايعيدش التمرير ولا الـhash.
 */
export function useHistoryState(name: string, fallback: string): [string, (next: string) => void] {
  const [value, setValue] = useState(() => {
    const stored = (window.history.state as { usr?: Record<string, unknown> } | null)?.usr?.[name]
    return typeof stored === 'string' ? stored : fallback
  })
  const set = useCallback(
    (next: string) => {
      setValue(next)
      const state = window.history.state as { usr?: Record<string, unknown> } | null
      window.history.replaceState({ ...state, usr: { ...state?.usr, [name]: next } }, '')
    },
    [name],
  )
  return [value, set]
}
