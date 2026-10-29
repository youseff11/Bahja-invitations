import { afterEach, describe, expect, it } from 'vitest'

import { overlayStyle, patchOverlays } from './overlayStyle'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('overlayStyle', () => {
  it('matches the server output for a plain text item', () => {
    expect(overlayStyle({ text: 'x', font: "'Cairo', sans-serif" })).toBe(
      "--video-text-x:0%;--video-text-y:0%;--video-text-color:#ffffff;--video-text-font:'Cairo', sans-serif",
    )
  })

  it('adds width, fluid size and shadow when set', () => {
    const style = overlayStyle({ x: 5.5, y: -3, color: '#112233', font: 'Tajawal', width: 60, size: 38, shadow: true })
    expect(style).toBe(
      '--video-text-x:5.5%;--video-text-y:-3%;--video-text-color:#112233;--video-text-font:Tajawal' +
        ';--section-text-w:60%;--section-text-size:clamp(19.8px, 5cqw, 38px);--ovl-text-shadow:0 1px 5px rgba(0,0,0,.5)',
    )
  })

  it('rejects unsafe colors and fonts like the server does', () => {
    const style = overlayStyle({ color: 'red; background:url(x)', font: 'a{b}' })
    expect(style).toContain('--video-text-color:#ffffff')
    expect(style).toContain('--video-text-font:inherit')
  })

  it('layers: behind goes under the content, z lifts above', () => {
    expect(overlayStyle({ behind: true, z: 3 })).toContain('--ovl-z:-97')
    expect(overlayStyle({ z: 3 })).toContain('--ovl-z:7')
  })
})

describe('patchOverlays', () => {
  const section = (inner: string) => {
    document.body.innerHTML = `<section data-block="b1">${inner}</section><section data-block="b2"><div data-section-text data-section-text-index="0">other</div></section>`
  }

  it('restyles the live node and updates plain text in place', () => {
    section('<div class="lb-section-text" data-section-text data-section-text-index="0" style="--video-text-font:inherit">old<span class="g"></span></div>')
    const node = document.querySelector('[data-block="b1"] [data-section-text]')!
    const grip = node.querySelector('.g')
    expect(patchOverlays('b1', [{ text: 'new', font: "'Cairo', sans-serif" }])).toBe(true)
    expect(node.getAttribute('style')).toContain("--video-text-font:'Cairo', sans-serif")
    expect(node.firstChild?.nodeValue).toBe('new')
    expect(node.querySelector('.g')).toBe(grip)
    // قسم تاني ماتلمسش
    expect(document.querySelector('[data-block="b2"] [data-section-text]')?.textContent).toBe('other')
  })

  it('leaves text with markup to the server render', () => {
    section('<div data-section-text data-section-text-index="0">old</div>')
    patchOverlays('b1', [{ text: '<b>x</b>' }])
    expect(document.querySelector('[data-block="b1"] [data-section-text]')?.textContent).toBe('old')
  })

  it('does nothing when the section has no overlay nodes', () => {
    section('')
    expect(patchOverlays('b1', [{ text: 'x' }])).toBe(false)
  })
})
