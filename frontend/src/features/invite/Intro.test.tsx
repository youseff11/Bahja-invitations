import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InviteContext } from './context'
import { intro } from './fixtures'
import { Intro } from './Intro'
import { makeT } from './strings'

function renderIntro(data = intro(), lockSkip = false) {
  return render(
    <InviteContext.Provider value={{ lang: 'ar', t: makeT('ar'), maxWidth: 760, demo: false, hasIntro: true }}>
      <Intro data={data} lockSkip={lockSkip} />
    </InviteContext.Provider>,
  )
}

describe('Intro', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.style.overflow = ''
  })
  afterEach(() => vi.useRealTimers())

  it('locks scrolling until the guest opens the invitation', () => {
    const opened = vi.fn()
    document.addEventListener('lb:intro-open', opened)
    const { container } = renderIntro()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(container.querySelector('[data-intro-open]')!)
    expect(opened).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.lb-intro')!.classList.contains('is-open')).toBe(true)
    expect(document.body.style.overflow).toBe('')
    // الافتتاحية بتتشال بعد انتهاء الانتقال
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(container.querySelector('.lb-intro')).toBeNull()
    document.removeEventListener('lb:intro-open', opened)
  })

  it('any tap on the screen opens it, and the event is sent only once', () => {
    const opened = vi.fn()
    document.addEventListener('lb:intro-open', opened)
    const { container } = renderIntro()
    const root = container.querySelector('.lb-intro')!
    fireEvent.click(root)
    fireEvent.click(root)
    expect(opened).toHaveBeenCalledTimes(1)
    document.removeEventListener('lb:intro-open', opened)
  })

  describe('intro code without a full-screen cover (e.g. a small envelope)', () => {
    const envelope = { css: '', html: '<div class="env"><i class="seal"></i></div>', js: '' }

    async function renderWithCode() {
      const view = renderIntro(intro({ code: envelope }))
      // «غطا الكود» بيتحمّل بـimport ديناميكي
      await act(async () => {
        await vi.dynamicImportSettled()
      })
      return view
    }

    it('a tap on the code is left to the code: no instant open while it animates', async () => {
      const { container } = await renderWithCode()
      const root = container.querySelector('.lb-intro')!
      const seal = container.querySelector('.seal')!
      fireEvent.click(seal)
      // الكود بيرد: بيغيّر الـDOM (زي ما onclick بتضيف كلاس is-opening)
      seal.classList.add('is-opening')
      await act(async () => {
        await Promise.resolve()
        vi.advanceTimersByTime(1500)
      })
      expect(root.classList.contains('is-open')).toBe(false)
      // ضغطة على الخلفية برّه الكود بتدخّل الدعوة
      fireEvent.click(root)
      expect(root.classList.contains('is-open')).toBe(true)
    })

    it('a tap the code ignores still opens the invitation, so the guest is never stuck', async () => {
      const { container } = await renderWithCode()
      const root = container.querySelector('.lb-intro')!
      fireEvent.click(container.querySelector('.seal')!)
      expect(root.classList.contains('is-open')).toBe(false)
      await act(async () => {
        vi.advanceTimersByTime(800)
      })
      expect(root.classList.contains('is-open')).toBe(true)
    })
  })

  it('opens by itself after the configured seconds', () => {
    const { container } = renderIntro(intro({ seconds: 3 }))
    expect(container.querySelector('.lb-intro')!.classList.contains('is-open')).toBe(false)
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(container.querySelector('.lb-intro')!.classList.contains('is-open')).toBe(true)
  })

  it('renders the guest greeting and the per-item styles', () => {
    const { container } = renderIntro(intro({ guestName: 'منى', itemStyles: { button: '--intro-item-x:3vw' } }))
    expect(container.querySelector('.lb-intro-name')!.textContent).toBe('أهلاً منى')
    expect((container.querySelector('[data-intro-open]') as HTMLElement).style.getPropertyValue('--intro-item-x')).toBe(
      '3vw',
    )
  })

  describe('video started by the intro code', () => {
    const knock = {
      css: '',
      html: '<div class="knock"></div>',
      js: 'var video = document.querySelector("video"); window.__knock = function () { video.play() }',
    }

    it('does not autoplay when the code decides when the video starts', () => {
      const play = vi.fn().mockResolvedValue(undefined)
      HTMLMediaElement.prototype.play = play
      HTMLMediaElement.prototype.pause = vi.fn()
      HTMLMediaElement.prototype.load = vi.fn()
      const { container } = renderIntro(intro({ video: '/v.mp4', audio: 'sound', code: knock }))
      const video = container.querySelector('video')!
      expect(video.hasAttribute('autoplay')).toBe(false)
      expect(play).not.toHaveBeenCalled()
      expect(container.querySelector('.lb-intro')!.classList.contains('is-video-blocked')).toBe(false)
    })

    it('still autoplays when the code never touches the video', () => {
      const play = vi.fn().mockResolvedValue(undefined)
      HTMLMediaElement.prototype.play = play
      HTMLMediaElement.prototype.pause = vi.fn()
      HTMLMediaElement.prototype.load = vi.fn()
      const sparkle = { css: '', html: '<i></i>', js: 'window.__pop = function () { new Audio("/pop.wav").play() }' }
      const { container } = renderIntro(intro({ video: '/v.mp4', code: sparkle }))
      expect(container.querySelector('video')!.hasAttribute('autoplay')).toBe(true)
      expect(play).toHaveBeenCalledTimes(1)
    })
  })

  it('manual video mode waits for the play button and keeps the auto timer paused', () => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
    const played = vi.fn()
    document.addEventListener('lb:intro-play', played)
    const { container } = renderIntro(intro({ video: '/v.mp4', playMode: 'button', seconds: 2 }))
    const root = container.querySelector('.lb-intro')!
    expect(root.classList.contains('is-awaiting-play')).toBe(true)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(root.classList.contains('is-open')).toBe(false)
    fireEvent.click(container.querySelector('[data-intro-play]')!)
    expect(played).toHaveBeenCalledTimes(1)
    expect(root.classList.contains('is-awaiting-play')).toBe(false)
    expect(root.classList.contains('is-open')).toBe(false)
    document.removeEventListener('lb:intro-play', played)
  })
})

describe('Intro — the guest cannot skip the video', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.style.overflow = ''
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
  })
  afterEach(() => vi.useRealTimers())

  const rendered = () => renderIntro(intro({ video: '/v.mp4' }), true)

  it('neither a tap nor the enter button opens it while the video plays, and the button is hidden', () => {
    const { container } = rendered()
    const root = container.querySelector('.lb-intro')!
    expect(root.classList.contains('is-skip-locked')).toBe(true)
    fireEvent.click(container.querySelector('[data-intro-open]')!)
    fireEvent.click(root)
    expect(root.classList.contains('is-open')).toBe(false)
  })

  it('opens by itself when the video ends', () => {
    const { container } = rendered()
    const root = container.querySelector('.lb-intro')!
    fireEvent.ended(container.querySelector('video')!)
    expect(root.classList.contains('is-open')).toBe(true)
  })

  it('opens at the configured seconds even though skipping is locked', () => {
    const { container } = renderIntro(intro({ video: '/v.mp4', seconds: 3 }), true)
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(container.querySelector('.lb-intro')!.classList.contains('is-open')).toBe(true)
  })

  it('lets the guest in when the video fails, so nobody is stuck', () => {
    const { container } = rendered()
    const root = container.querySelector('.lb-intro')!
    fireEvent.error(container.querySelector('video')!)
    expect(root.classList.contains('is-skip-locked')).toBe(false)
    fireEvent.click(root)
    expect(root.classList.contains('is-open')).toBe(true)
  })

  it('unlocks after a failsafe if the video never finishes', () => {
    const { container } = rendered()
    const root = container.querySelector('.lb-intro')!
    act(() => {
      vi.advanceTimersByTime(16000)
    })
    expect(root.classList.contains('is-skip-locked')).toBe(false)
  })

  it('when the browser refuses autoplay, a tap starts the video instead of skipping it', async () => {
    // صامت أصلاً: الرفض الأول نهائي، واللمسة هي المحاولة التانية
    const play = vi.fn().mockRejectedValueOnce(new Error('NotAllowed')).mockResolvedValue(undefined)
    HTMLMediaElement.prototype.play = play
    const { container } = rendered()
    const root = container.querySelector('.lb-intro')!
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(root.classList.contains('is-video-blocked')).toBe(true)
    expect(root.classList.contains('is-skip-locked')).toBe(true)
    fireEvent.click(root)
    expect(root.classList.contains('is-open')).toBe(false)
    expect(root.classList.contains('is-video-blocked')).toBe(false)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('retries muted when autoplay with sound is refused', async () => {
    const play = vi.fn().mockRejectedValueOnce(new Error('NotAllowed')).mockResolvedValue(undefined)
    HTMLMediaElement.prototype.play = play
    const { container } = renderIntro(intro({ video: '/v.mp4', audio: 'sound' }), true)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(play).toHaveBeenCalledTimes(2)
    expect(container.querySelector('video')!.muted).toBe(true)
    expect(container.querySelector('.lb-intro')!.classList.contains('is-video-blocked')).toBe(false)
  })

  it('does not lock the editor preview or a no-video intro', () => {
    const editor = renderIntro(intro({ video: '/v.mp4' }), false)
    fireEvent.click(editor.container.querySelector('.lb-intro')!)
    expect(editor.container.querySelector('.lb-intro')!.classList.contains('is-open')).toBe(true)
    editor.unmount()
    const plain = renderIntro(intro(), true)
    expect(plain.container.querySelector('.lb-intro')!.classList.contains('is-skip-locked')).toBe(false)
  })
})
