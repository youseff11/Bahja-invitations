import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { HeroInfo } from '@/api/types'
import i18n, { initI18n } from '@/i18n'

import { HeroSection } from './HeroSection'

const EMPTY: HeroInfo = {
  images: { lightAr: '', lightEn: '', darkAr: '', darkEn: '' },
  text: {
    ar: { top: '', main: '', sub: '', cta: '', plans: '', trust: [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }] },
    en: { top: '', main: '', sub: '', cta: '', plans: '', trust: [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }] },
  },
}

const show = (hero?: HeroInfo) =>
  render(
    <MemoryRouter>
      <HeroSection hero={hero} />
    </MemoryRouter>,
  )

beforeAll(() => initI18n('ar'))
afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('ar')
})

describe('HeroSection settings', () => {
  it('falls back to the translated defaults when nothing is set', () => {
    show(EMPTY)
    expect(screen.getByText('تروي بدايتكم بأناقة')).toBeInTheDocument()
    expect(screen.getByText('شوف القوالب')).toBeInTheDocument()
    expect(screen.queryByText('شوف الباقات')).toBeNull() // زرار واحد بس
    expect(document.querySelectorAll('.hero-actions a')).toHaveLength(1)
    expect(document.querySelector('style')).toBeNull()
  })

  it('uses only the fields that were filled and keeps the default for the rest', () => {
    const hero: HeroInfo = {
      ...EMPTY,
      text: { ...EMPTY.text, ar: { ...EMPTY.text.ar, main: 'عنوان مخصص', trust: [{ value: '+٨٠', label: '' }, EMPTY.text.ar.trust[1], EMPTY.text.ar.trust[2]] } },
    }
    show(hero)
    expect(screen.getByText('عنوان مخصص')).toBeInTheDocument()
    expect(screen.queryByText('تروي بدايتكم بأناقة')).toBeNull()
    expect(screen.getByText('دعوات زفاف رقمية')).toBeInTheDocument() // السطر الصغير لسه الافتراضي
    expect(screen.getByText('+٨٠')).toBeInTheDocument()
    expect(screen.getByText('تصميم أنيق')).toBeInTheDocument() // التسمية فاضية → الافتراضي
  })

  it('shows the text of the current language', async () => {
    await i18n.changeLanguage('en')
    const hero: HeroInfo = {
      ...EMPTY,
      text: { ...EMPTY.text, ar: { ...EMPTY.text.ar, main: 'عربي' }, en: { ...EMPTY.text.en, main: 'Your love story' } },
    }
    show(hero)
    expect(screen.getByText('Your love story')).toBeInTheDocument()
    expect(screen.queryByText('عربي')).toBeNull()
  })

  it('does not double-encode URLs the server already percent-encoded (Arabic file names)', () => {
    show({ ...EMPTY, images: { ...EMPTY.images, darkAr: '/media/home/x/%D8%A7%D8%B9%D9%85%D9%84.webp' } })
    const css = document.querySelector('style')?.textContent ?? ''
    expect(css).toContain('url("/media/home/x/%D8%A7%D8%B9%D9%85%D9%84.webp")')
    expect(css).not.toContain('%25')
  })

  it('emits a background rule per filled image with the same selectors as the stylesheet', () => {
    show({ ...EMPTY, images: { lightAr: '/media/home/a/l.webp', lightEn: '', darkAr: '/media/home/b/d ar.webp', darkEn: '/media/home/c/de.webp' } })
    const css = document.querySelector('style')?.textContent ?? ''
    expect(css).toContain('.hero-art{--hero-img:url("/media/home/a/l.webp")}')
    expect(css).toContain('[data-theme="dark"] .hero-art{--hero-img:url("/media/home/b/d%20ar.webp")}')
    expect(css).toContain('html[lang="en"][data-theme="dark"] .hero-art{--hero-img:url("/media/home/c/de.webp")}')
    // لايت إنجليزي فاضي → بياخد صورة لايت العربي
    expect(css).toContain('html[lang="en"] .hero-art{--hero-img:url("/media/home/a/l.webp")}')
  })
})
