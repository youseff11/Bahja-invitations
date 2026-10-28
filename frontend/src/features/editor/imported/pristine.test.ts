import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FromFrame, PreviewPayload } from '../types'
import { commitHtml, hasRuntime, installImported, patchNode, prepareImported, WRITE_WAIT } from './frame'

const SIZED = () => ({ width: 80, height: 30 }) as DOMRect

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(SIZED)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const payload = (runtime: boolean) =>
  ({
    lang: 'ar',
    baseLang: 'ar',
    stage: { runtime },
    runtimeScripts: runtime ? [{ code: 'x' }] : [],
    runtimeIsSpa: false,
  }) as unknown as PreviewPayload

const HTML = '<h1 data-move="el-1">عنوان</h1><img data-move="el-2" src="a.png"><img data-move="el-3" src="b.png">'

function mount() {
  document.body.innerHTML = `<section data-block="b1" data-block-type="custom_html"><div class="lb-custom">${HTML}</div></section>`
  return document.querySelector('.lb-custom') as HTMLElement
}

/** سكربت القالب بيعدّل الـDOM بعد ما اللقطة اتاخدت: كلاس، ستايل، عنصر مبني، ونص جوّه العنوان */
function scriptRuns(root: HTMLElement) {
  root.querySelector('h1')!.classList.add('t-animate_started')
  root.querySelector<HTMLElement>('h1')!.style.opacity = '0.3'
  const built = document.createElement('div')
  built.className = 'built-by-script'
  root.appendChild(built)
}

describe('saving while the template runtime is running', () => {
  it('detects whether the runtime runs in the preview', () => {
    expect(hasRuntime(payload(true))).toBe(true)
    expect(hasRuntime(payload(false))).toBe(false)
    expect(hasRuntime(null)).toBe(false)
    expect(hasRuntime({ ...payload(true), runtimeIsSpa: true })).toBe(false)
  })

  it('does not save what the scripts did to the DOM', () => {
    const root = mount()
    const send = vi.fn<(m: FromFrame) => void>()
    prepareImported(payload(true), send)
    scriptRuns(root)
    commitHtml(root, send)
    const sent = send.mock.calls.map(([m]) => m).find((m) => m.type === 'lb-editor:html')
    expect(sent).toBeTruthy()
    const value = (sent as { value: string }).value
    expect(value).not.toContain('t-animate_started')
    expect(value).not.toContain('opacity')
    expect(value).not.toContain('built-by-script')
    expect(value).toContain('عنوان')
  })

  it('saves the user\'s typing on top of the snapshot, not the script changes', () => {
    const root = mount()
    const send = vi.fn<(m: FromFrame) => void>()
    prepareImported(payload(true), send)
    const stop = installImported({ payload: () => payload(true), send, onPick: () => {} })
    scriptRuns(root)
    const h1 = root.querySelector('h1')!
    h1.setAttribute('data-lb-text', '1')
    h1.classList.add('lb-el-typing')
    h1.textContent = 'عنوان جديد'
    h1.dispatchEvent(new Event('input', { bubbles: true }))
    vi.advanceTimersByTime(WRITE_WAIT + 10)
    const html = send.mock.calls.map(([m]) => m).filter((m) => m.type === 'lb-editor:html')
    const value = (html.at(-1) as { value: string }).value
    expect(value).toContain('عنوان جديد')
    expect(value).not.toContain('t-animate_started')
    expect(value).not.toContain('built-by-script')
    stop()
  })

  it('keeps a swap of two images and a panel edit in the snapshot', () => {
    const root = mount()
    const send = vi.fn<(m: FromFrame) => void>()
    prepareImported(payload(true), send)
    scriptRuns(root)
    const [a, b] = Array.from(root.querySelectorAll('img'))
    const [srcA, srcB] = [a.getAttribute('src')!, b.getAttribute('src')!]
    a.setAttribute('src', srcB)
    b.setAttribute('src', srcA)
    patchNode('b1', 'el-1', { kind: 'text', value: 'من اللوحة' })
    commitHtml(root, send, [a, b])
    const value = (send.mock.calls.map(([m]) => m).filter((m) => m.type === 'lb-editor:html').at(-1) as { value: string })
      .value
    expect(value).toMatch(/data-move="el-2"[^>]*src="b\.png"/)
    expect(value).toMatch(/data-move="el-3"[^>]*src="a\.png"/)
    expect(value).toContain('من اللوحة')
    expect(value).not.toContain('built-by-script')
  })

  it('serializes the live DOM when no runtime is running (unchanged behaviour)', () => {
    const root = mount()
    const send = vi.fn<(m: FromFrame) => void>()
    prepareImported(payload(false), send)
    root.querySelector('h1')!.classList.add('custom-live')
    commitHtml(root, send)
    const value = (send.mock.calls.map(([m]) => m).filter((m) => m.type === 'lb-editor:html').at(-1) as { value: string })
      .value
    expect(value).toContain('custom-live')
  })
})
