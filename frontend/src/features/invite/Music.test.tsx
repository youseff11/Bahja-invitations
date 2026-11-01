import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InviteContext } from './context'
import { Music } from './Music'
import type { MusicConfig } from './types'

const ctx = { lang: 'ar' as const, t: (k: string) => k, maxWidth: 480, demo: false, hasIntro: true }

function mount(config: MusicConfig) {
  return render(
    <InviteContext.Provider value={ctx}>
      <Music config={config} />
    </InviteContext.Provider>,
  )
}

const base: MusicConfig = { url: '/a.mp3', autoplay: true, loop: true, player: 'floating' }

describe('Music مع الافتتاحية', () => {
  const play = vi.fn(() => Promise.resolve())

  beforeEach(() => {
    play.mockClear()
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(play)
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    document.body.insertAdjacentHTML('beforeend', '<div class="lb-intro"></div>')
  })

  afterEach(() => {
    document.querySelector('.lb-intro')?.remove()
    vi.restoreAllMocks()
  })

  it('من غير الإعداد: تستنى فتح الافتتاحية', () => {
    mount(base)
    expect(play).not.toHaveBeenCalled()
    document.dispatchEvent(new CustomEvent('lb:intro-open'))
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('مع duringIntro ومفيش زر بدء: تبدأ فوراً والافتتاحية لسه مقفولة', () => {
    mount({ ...base, duringIntro: true })
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('مع duringIntro وزر بدء الافتتاحية: تستنى الضغطة ومابتبدأش قبلها', () => {
    document.querySelector('.lb-intro')!.classList.add('is-awaiting-play')
    mount({ ...base, duringIntro: true })
    expect(play).not.toHaveBeenCalled()
    document.dispatchEvent(new CustomEvent('lb:intro-start'))
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('من غير duringIntro: ضغطة البدء لوحدها ماتشغّلش الموسيقى', () => {
    document.querySelector('.lb-intro')!.classList.add('is-awaiting-play')
    mount(base)
    document.dispatchEvent(new CustomEvent('lb:intro-start'))
    expect(play).not.toHaveBeenCalled()
  })

  it('مع duringIntro لو المتصفح رفض: ضغطة تشغيل الفيديو تعيد المحاولة', async () => {
    play.mockImplementationOnce(() => Promise.reject(new Error('blocked')))
    mount({ ...base, duringIntro: true })
    await Promise.resolve()
    document.dispatchEvent(new CustomEvent('lb:intro-play'))
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('duringIntro من غير autoplay مابيشغّلش حاجة', () => {
    mount({ ...base, autoplay: false, duringIntro: true })
    expect(play).not.toHaveBeenCalled()
  })
})

describe('Music مقطع من الأغنية (بداية ونهاية)', () => {
  const play = vi.fn(() => Promise.resolve())

  beforeEach(() => {
    play.mockClear()
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(play)
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const audio = () => window.__lbMusic!.audio

  it('بتبدأ من ثانية البداية', () => {
    mount({ ...base, start: 30 })
    expect(audio().currentTime).toBe(30)
  })

  it('من غير بداية ولا نهاية: تكرار الأغنية العادي', () => {
    mount(base)
    expect(audio().loop).toBe(true)
    expect(audio().currentTime).toBe(0)
  })

  it('عند ثانية النهاية مع التكرار: ترجع لثانية البداية', () => {
    mount({ ...base, start: 10, end: 20 })
    expect(audio().loop).toBe(false)
    audio().currentTime = 20
    audio().dispatchEvent(new Event('timeupdate'))
    expect(audio().currentTime).toBe(10)
  })

  it('عند ثانية النهاية من غير تكرار: تقف وترجع لثانية البداية', () => {
    const { container } = mount({ ...base, loop: false, start: 10, end: 20 })
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause')
    audio().currentTime = 21
    audio().dispatchEvent(new Event('timeupdate'))
    expect(pause).toHaveBeenCalled()
    expect(audio().currentTime).toBe(10)
    expect(container.querySelector('.lb-music')!.classList.contains('is-playing')).toBe(false)
  })

  it('نهاية أقل من البداية بتتجاهل (لحد آخر الأغنية)', () => {
    mount({ ...base, start: 30, end: 10 })
    audio().currentTime = 40
    audio().dispatchEvent(new Event('timeupdate'))
    expect(audio().currentTime).toBe(40)
  })
})
