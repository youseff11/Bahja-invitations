import { describe, expect, it } from 'vitest'

import { morphInto } from './morph'

const mount = (html: string) => {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

describe('morphInto', () => {
  it('changes only what differs and keeps the other live nodes', () => {
    const before = '<style>.a{color:red}</style><p class="a">hello</p><p class="b">keep</p>'
    const after = '<style>.a{color:blue}</style><p class="a">hello</p><p class="b">keep</p>'
    const root = mount(before)
    const [style, p1, p2] = Array.from(root.children)
    p2.classList.add('is-in') // حالة غيّرها سكربت: ماتتمسحش
    expect(morphInto(root, before, after)).toBe(true)
    expect(root.querySelector('style')?.textContent).toBe('.a{color:blue}')
    expect(root.children[0]).toBe(style)
    expect(root.children[1]).toBe(p1)
    expect(root.children[2]).toBe(p2)
    expect(p2.classList.contains('is-in')).toBe(true)
  })

  it('updates attributes and text in place', () => {
    const before = '<div style="--f:a" data-x="1">one</div>'
    const after = '<div style="--f:b">two</div>'
    const root = mount(before)
    const div = root.firstElementChild!
    expect(morphInto(root, before, after)).toBe(true)
    expect(root.firstElementChild).toBe(div)
    expect(div.getAttribute('style')).toBe('--f:b')
    expect(div.hasAttribute('data-x')).toBe(false)
    expect(div.textContent).toBe('two')
  })

  it('adds and removes children', () => {
    const before = '<p>1</p><p>2</p>'
    const root = mount(before)
    expect(morphInto(root, before, '<p>1</p><p>2</p><p>3</p>')).toBe(true)
    expect(root.children).toHaveLength(3)
    expect(morphInto(root, '<p>1</p><p>2</p><p>3</p>', '<p>1</p>')).toBe(true)
    expect(root.children).toHaveLength(1)
  })

  it('refuses when a script changed so the caller rebuilds and re-runs it', () => {
    const before = '<p>a</p><script data-lb-section-script="1">var a=1</script>'
    const root = mount(before)
    expect(morphInto(root, before, '<p>a</p><script data-lb-section-script="1">var a=2</script>')).toBe(false)
    expect(root.querySelector('script')?.textContent).toBe('var a=1')
  })

  it('keeps the running script when only markup changed', () => {
    const before = '<p>a</p><script data-lb-section-script="1">var a=1</script>'
    const root = mount(before)
    const script = root.querySelector('script')
    expect(morphInto(root, before, '<p>b</p><script data-lb-section-script="1">var a=1</script>')).toBe(true)
    expect(root.querySelector('script')).toBe(script)
    expect(root.querySelector('p')?.textContent).toBe('b')
  })

  it('refuses without touching anything when a script already changed the live DOM', () => {
    const before = '<div id="c"></div>'
    const root = mount(before)
    root.querySelector('#c')!.appendChild(document.createElement('span')) // سكربت زوّد عقدة
    expect(morphInto(root, before, '<div id="c" class="x"></div><p>x</p>')).toBe(false)
    expect(root.querySelector('p')).toBeNull()
    expect(root.querySelector('#c')?.hasAttribute('class')).toBe(false)
  })
})

describe('morphInto with editor-injected nodes', () => {
  it('ignores the text-width grips the editor adds to the live node', () => {
    const before = '<div data-section-text style="--f:a">hi</div>'
    const root = mount(before)
    const div = root.firstElementChild!
    for (const side of ['start', 'end']) {
      const grip = document.createElement('span')
      grip.className = `lb-section-text__grip lb-section-text__grip--${side}`
      div.appendChild(grip)
    }
    expect(morphInto(root, before, '<div data-section-text style="--f:b">hi</div>')).toBe(true)
    expect(root.firstElementChild).toBe(div)
    expect(div.getAttribute('style')).toBe('--f:b')
    expect(div.querySelectorAll('.lb-section-text__grip')).toHaveLength(2)
  })
  it('a script that rewrapped a text unit: only that unit changes, the rest of the live DOM is kept', () => {
    const before = '<div data-move="ce-1"><h1 data-move="ce-2">زين</h1><p data-move="ce-3">x</p></div>'
    const after = '<div data-move="ce-1"><h1 data-move="ce-2">زين ي</h1><p data-move="ce-3">x</p></div>'
    const root = mount(before)
    const box = root.firstElementChild!
    const h1 = box.querySelector('h1')!
    const p = box.querySelector('p')!
    h1.innerHTML = '<span>ز</span><span>ي</span><span>ن</span>' // سكربت الأنيميشن
    p.classList.add('is-in')
    expect(morphInto(root, before, after)).toBe(true)
    expect(root.firstElementChild).toBe(box)
    expect(box.querySelector('h1')).toBe(h1)
    expect(h1.textContent).toBe('زين ي')
    expect(box.querySelector('p')).toBe(p)
    expect(p.classList.contains('is-in')).toBe(true)
  })

  it('gives up (rebuild) when the live root children no longer match even by position', () => {
    const before = '<div data-move="ce-1"><h1 data-move="ce-2">a</h1></div>'
    const root = mount(before)
    root.querySelector('h1')!.innerHTML = '<i>a</i>'
    root.appendChild(document.createElement('u')) // سكربت زوّد عقدة على مستوى الجذر
    expect(morphInto(root, before, '<div data-move="ce-1"><h1 data-move="ce-2">ab</h1></div>')).toBe(false)
  })
  it('live numbering that lags the text (spans got the numbers, not the heading): matches by position and keeps siblings', () => {
    const before = '<div data-move="ce-1"><h1>زين</h1><p>x</p></div>'
    const after = '<div data-move="ce-1"><h1 data-move="ce-2">زين ab</h1><p data-move="ce-3">x</p></div>'
    const root = mount(before)
    const box = root.firstElementChild!
    const h1 = box.querySelector('h1')!
    const p = box.querySelector('p')!
    h1.innerHTML = '<span data-move="ce-2">ز</span><span data-move="ce-3">ي</span>'
    expect(morphInto(root, before, after)).toBe(true)
    expect(box.querySelector('h1')).toBe(h1)
    expect(box.querySelector('p')).toBe(p)
    expect(h1.textContent).toBe('زين ab')
  })
})
