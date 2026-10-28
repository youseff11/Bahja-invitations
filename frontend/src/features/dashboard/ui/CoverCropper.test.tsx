import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { initI18n } from '@/i18n'
import { CoverCropper } from './CoverCropper'

const drawImage = vi.fn()

beforeAll(() => {
  initI18n('ar')
})

beforeEach(() => {
  drawImage.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:cover')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    fillRect: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
    callback(new Blob(['x'], { type: type ?? 'image/jpeg' }))
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function loadImage(width: number, height: number) {
  const img = document.querySelector('.cover-cropper-frame img') as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: width })
  Object.defineProperty(img, 'naturalHeight', { value: height })
  fireEvent.load(img)
}

describe('CoverCropper', () => {
  it('exports a square crop covering the whole image at zoom 1', async () => {
    const onDone = vi.fn()
    render(<CoverCropper file={new File(['x'], 'bg.jpg', { type: 'image/jpeg' })} onCancel={vi.fn()} onDone={onDone} />)
    loadImage(2000, 1000) // أفقية: القص بياخد النص الأوسط بعرض ١٠٠٠ (مربع من ارتفاع ١٠٠٠)
    fireEvent.click(await screen.findByRole('button', { name: 'قص وحفظ' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    const [sx, sy, sw, sh, dx, dy, dw, dh] = drawImage.mock.calls[0].slice(1)
    expect([sx, sy, sw, sh]).toEqual([500, 0, 1000, 1000])
    expect([dx, dy, dw, dh]).toEqual([0, 0, 1000, 1000])
    expect(onDone.mock.calls[0][0]).toMatchObject({ name: 'bg-cover.jpg', type: 'image/jpeg' })
  })

  it('keeps the dragged crop inside the image and cancels on Escape', async () => {
    const onCancel = vi.fn()
    render(<CoverCropper file={new File(['x'], 'bg.png', { type: 'image/png' })} onCancel={onCancel} onDone={vi.fn()} />)
    loadImage(2000, 1000)
    const frame = screen.getByLabelText(/إطار القص/)
    for (let i = 0; i < 100; i++) fireEvent.keyDown(frame, { key: 'ArrowRight' }) // أكتر من الحد
    fireEvent.click(await screen.findByRole('button', { name: 'قص وحفظ' }))

    await waitFor(() => expect(drawImage).toHaveBeenCalled())
    const [sx, , sw] = drawImage.mock.calls[0].slice(1)
    expect(Math.abs(sx)).toBe(0) // وقف عند حافة الصورة
    expect(sw).toBe(1000)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
