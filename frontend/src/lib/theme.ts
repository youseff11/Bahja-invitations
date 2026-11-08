import { create } from 'zustand'

export type Theme = 'light' | 'dark'

// نفس مفتاح الموقع القديم وسكربت الـshell — الاختيار بيمشي بين النسختين
const STORAGE_KEY = 'leila-theme'

// السيرفر بيحطها على الـ<html> لما الدارك يتقفل من إعدادات الموقع
const LOCK_ATTR = 'data-dark-off'

function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/** اختيار الزائر المحفوظ، أو مظهر الجهاز لو مفيش — نفس منطق سكربت الـshell. */
function preferredTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* تخزين ممنوع */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* وضع خاص أو تخزين ممنوع — الاختيار بيفضل للجلسة بس */
  }
}

interface ThemeState {
  theme: Theme
  toggle: () => void
  set: (theme: Theme) => void
  /** الدارك مقفول من إعدادات الموقع: فاتح دايماً من غير ما نمسح اختيار الزائر. */
  setDarkAllowed: (allowed: boolean) => void
}

// القيمة الأولى بيحطها سكربت الـshell قبل أول رسم؛ هنا بنقراها بس
export const useTheme = create<ThemeState>((set, get) => ({
  theme: currentTheme(),
  toggle: () => get().set(get().theme === 'dark' ? 'light' : 'dark'),
  set: (theme) => {
    if (document.documentElement.hasAttribute(LOCK_ATTR)) return
    apply(theme)
    set({ theme })
  },
  setDarkAllowed: (allowed) => {
    const root = document.documentElement
    if (allowed === !root.hasAttribute(LOCK_ATTR)) return
    // التغيير ده بييجي من اللوحة وسط الجلسة (الـshell بيظبط أول رسم) —
    // من غير ‎apply()‎ عشان مانكتبش «فاتح» فوق اختيار الزائر المحفوظ
    const theme = allowed ? preferredTheme() : 'light'
    root.toggleAttribute(LOCK_ATTR, !allowed)
    root.setAttribute('data-theme', theme)
    set({ theme })
  },
}))
