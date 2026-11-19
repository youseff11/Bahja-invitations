import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { initImportedMedia } from './media'

/**
 * فيديو بيبنيه سكربت «كود متقدّم» (من غير ‎autoplay‎): وضع التوفير في الآيفون
 * بيرفض ‎play()‎ بتاعه لحد ما يشتغل مرة جوّه لمسة حقيقية.
 */
const makeVideo = (opts: { muted?: boolean; loop?: boolean } = {}) => {
  const box = document.createElement('div')
  box.className = 'lb-extra-html'
  const v = document.createElement('video')
  v.muted = opts.muted ?? true
  v.loop = opts.loop ?? true
  box.appendChild(v)
  document.body.appendChild(box)
  let paused = true
  Object.defineProperty(v, 'paused', { get: () => paused, configurable: true })
  Object.defineProperty(v, 'readyState', { get: () => 4, configurable: true })
  const seek = vi.fn()
  Object.defineProperty(v, 'currentTime', { get: () => 0.4, set: seek, configurable: true })
  const play = vi.fn(() => {
    paused = false
    return Promise.resolve()
  })
  const pause = vi.fn(() => {
    paused = true
  })
  v.play = play
  v.pause = pause
  return { box, v, play, pause, seek }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('script-built code videos get unlocked by the first tap', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    initImportedMedia()
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('plays then parks a muted video created after load', async () => {
    const { play, pause, seek, v } = makeVideo()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await tick()
    expect(play).toHaveBeenCalledTimes(1)
    expect(pause).toHaveBeenCalledTimes(1)
    expect(v.paused).toBe(true)
    // seek على فيديو واقف بيعلّق سفاري iOS 26 — مانرجّعوش للصفر
    expect(seek).not.toHaveBeenCalled()
    // مرة واحدة بس
    document.body.dispatchEvent(new Event('click', { bubbles: true }))
    await tick()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('never plays a video with sound', async () => {
    const { play } = makeVideo({ muted: false })
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await tick()
    expect(play).not.toHaveBeenCalled()
  })

  it('leaves the video alone when the tap is inside its own code box', async () => {
    const { box, play } = makeVideo()
    box.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await tick()
    expect(play).not.toHaveBeenCalled()
  })

  it('does not touch it on lb:intro-open (the designer script plays it then)', async () => {
    const { play } = makeVideo()
    document.dispatchEvent(new Event('lb:intro-open'))
    await tick()
    expect(play).not.toHaveBeenCalled()
  })

  it('skips a video that is already playing', async () => {
    const { v, play, pause } = makeVideo()
    await v.play()
    play.mockClear()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await tick()
    expect(play).not.toHaveBeenCalled()
    expect(pause).not.toHaveBeenCalled()
  })
})
