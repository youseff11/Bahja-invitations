import { beforeEach, describe, expect, it } from 'vitest'

import { useTheme } from './theme'

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    useTheme.getState().setDarkAllowed(true)
    useTheme.getState().set('light')
  })

  it('toggles between light and dark and mirrors it on <html>', () => {
    useTheme.getState().toggle()
    expect(useTheme.getState().theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    useTheme.getState().toggle()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('persists the choice under the same key the legacy site uses', () => {
    useTheme.getState().set('dark')
    expect(localStorage.getItem('leila-theme')).toBe('dark')
  })

  it('locks to light when dark mode is turned off, without losing the saved choice', () => {
    useTheme.getState().set('dark')
    useTheme.getState().setDarkAllowed(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.hasAttribute('data-dark-off')).toBe(true)
    useTheme.getState().toggle()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('leila-theme')).toBe('dark')
    useTheme.getState().setDarkAllowed(true)
    expect(useTheme.getState().theme).toBe('dark')
    expect(document.documentElement.hasAttribute('data-dark-off')).toBe(false)
  })
})
