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

  it('مع duringIntro: تبدأ فوراً والافتتاحية لسه مقفولة', () => {
    mount({ ...base, duringIntro: true })
    expect(play).toHaveBeenCalledTimes(1)
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
