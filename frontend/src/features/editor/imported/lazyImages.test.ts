import { afterEach, describe, expect, it } from 'vitest'

import { restoreThumb, savedSrc, THUMB_ATTR, upgradeLazyImages } from './lazyImages'
import { cleanCopy, serializeCustom } from './serialize'

const ORIGINAL = 'https://static.tildacdn.net/tild1/a.png'

function mount(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.append(root)
  return root
}

/** ‎jsdom‎ مابيحمّلش صور: نحاكي الأبعاد والتحميل. */
function loaded(img: HTMLImageElement, width: number) {
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(img, 'complete', { value: true, configurable: true })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('upgradeLazyImages', () => {
  it('swaps a tiny thumbnail for its allowed original, and the save path puts the thumbnail back', () => {
    const root = mount(`<div class="lb-custom"><img src="/media/a/thumb.png" data-original="${ORIGINAL}"></div>`)
    const img = root.querySelector('img')!
    loaded(img, 20)
    upgradeLazyImages(root)
    expect(img.getAttribute('src')).toBe(ORIGINAL)
    expect(savedSrc(img)).toBe('/media/a/thumb.png')

    const html = serializeCustom(root.firstElementChild!)
    expect(html).toContain('src="/media/a/thumb.png"')
    expect(html).not.toContain('src="https://')
    expect(html).not.toContain(THUMB_ATTR)
    // الـDOM الحي سايب على الأصل
    expect(img.getAttribute('src')).toBe(ORIGINAL)

    const copy = cleanCopy(root.firstElementChild!)
    expect(copy.querySelector('img')!.getAttribute('src')).toBe('/media/a/thumb.png')
  })

  it('leaves real (already downloaded) images, unknown hosts and non-https originals alone', () => {
    const root = mount(
      `<img id="big" src="/media/a/full.png" data-original="${ORIGINAL}">` +
        '<img id="evil" src="/media/a/t.png" data-original="https://evil.example/x.png">' +
        '<img id="http" src="/media/a/t2.png" data-original="http://static.tildacdn.net/x.png">',
    )
    root.querySelectorAll('img').forEach((img) => loaded(img, img.id === 'big' ? 800 : 20))
    upgradeLazyImages(root)
    expect(root.querySelector('#big')!.getAttribute('src')).toBe('/media/a/full.png')
    expect(root.querySelector('#evil')!.getAttribute('src')).toBe('/media/a/t.png')
    expect(root.querySelector('#http')!.getAttribute('src')).toBe('/media/a/t2.png')
  })

  it('waits for the thumbnail to load, and falls back to it if the original fails', () => {
    const root = mount(`<img src="/media/a/thumb.png" data-original="${ORIGINAL}">`)
    const img = root.querySelector('img')!
    upgradeLazyImages(root)
    expect(img.getAttribute('src')).toBe('/media/a/thumb.png') // لسه ماتحمّلتش
    loaded(img, 20)
    img.dispatchEvent(new Event('load'))
    expect(img.getAttribute('src')).toBe(ORIGINAL)

    img.dispatchEvent(new Event('error'))
    expect(img.getAttribute('src')).toBe('/media/a/thumb.png')
    expect(img.hasAttribute(THUMB_ATTR)).toBe(false)
  })

  it('restoreThumb removes src when the saved one was empty', () => {
    const root = mount(`<img data-original="${ORIGINAL}">`)
    const img = root.querySelector('img')!
    img.setAttribute(THUMB_ATTR, '')
    img.setAttribute('src', ORIGINAL)
    restoreThumb(img)
    expect(img.hasAttribute('src')).toBe(false)
  })
})
