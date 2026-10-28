import { afterEach, describe, expect, it, vi } from 'vitest'

import { restartTemplateRuntime, stopTemplateRuntime } from './templateRuntime'

// jsdom مابينفّذش السكربتات المضافة، فبنتأكد من الوسوم نفسها (الترتيب والتغليف) وإيقاف المؤقتات
const tags = () => Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-lb-template-runtime]'))

afterEach(() => {
  vi.restoreAllMocks()
  stopTemplateRuntime()
  document.body.innerHTML = ''
})

describe('template runtime in the preview frame', () => {
  it('appends the scripts in order and replaces them on restart', async () => {
    await restartTemplateRuntime([{ code: 'window.a=1' }, { code: 'window.b=2' }])
    expect(tags().map((s) => s.text)).toEqual(['window.a=1', 'window.b=2'])
    await restartTemplateRuntime([{ code: 'window.c=3' }])
    expect(tags().map((s) => s.text)).toEqual(['window.c=3'])
  })

  it('wraps scripts with top-level const only when they run again', async () => {
    const code = 'const eventDate = new Date(1);'
    await restartTemplateRuntime([{ code }])
    await restartTemplateRuntime([{ code }])
    expect(tags()[0].text).toContain('(function(){')
    expect(tags()[0].text).toContain(code)
    await restartTemplateRuntime([{ code: 'window.a=1' }])
    expect(tags()[0].text).toBe('window.a=1') // من غير تعريفات على مستوى الملف: زي ما هو
  })

  it('stops intervals created by the previous run', async () => {
    const clear = vi.spyOn(window, 'clearInterval')
    await restartTemplateRuntime([])
    const id = window.setInterval(() => {}, 1000)
    await restartTemplateRuntime([])
    expect(clear).toHaveBeenCalledWith(id)
  })

  it('gives modules a fresh url on restart so they run on the new DOM', async () => {
    const item = { src: '/media/app.js', type: 'module' }
    const pending = restartTemplateRuntime([item])
    tags()[0].dispatchEvent(new Event('load'))
    await pending
    const again = restartTemplateRuntime([item])
    expect(tags()[0].getAttribute('src')).toMatch(/^\/media\/app\.js\?lbr=\d+$/)
    tags()[0].dispatchEvent(new Event('load'))
    await again
  })
})
