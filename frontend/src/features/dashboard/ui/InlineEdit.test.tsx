import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InlineEdit } from './InlineEdit'

function setup(props: Partial<React.ComponentProps<typeof InlineEdit>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(<InlineEdit value="الاسم القديم" label="الاسم" onSave={onSave} {...props} />)
  fireEvent.click(screen.getByRole('button'))
  return { onSave, field: screen.getByRole('textbox') as HTMLInputElement }
}

describe('InlineEdit', () => {
  it('turns into a field on click and saves the trimmed value on Enter', async () => {
    const { onSave, field } = setup()
    expect(field).toHaveValue('الاسم القديم')
    fireEvent.change(field, { target: { value: '  اسم جديد ' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('اسم جديد')
  })

  it('saves once even though Enter is followed by a blur', async () => {
    const { onSave, field } = setup()
    fireEvent.change(field, { target: { value: 'جديد' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    fireEvent.blur(field)
    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument())
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('saves on blur', async () => {
    const { onSave, field } = setup()
    fireEvent.change(field, { target: { value: 'من البلر' } })
    fireEvent.blur(field)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('من البلر'))
  })

  it('cancels on Escape without saving', () => {
    const { onSave, field } = setup()
    fireEvent.change(field, { target: { value: 'مش هيتحفظ' } })
    fireEvent.keyDown(field, { key: 'Escape' })
    fireEvent.blur(field)
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toHaveTextContent('الاسم القديم')
  })

  it('does not save an unchanged value', () => {
    const { onSave, field } = setup()
    fireEvent.blur(field)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('refuses an empty value when required', () => {
    const { onSave, field } = setup({ required: true })
    fireEvent.change(field, { target: { value: '   ' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toHaveTextContent('الاسم القديم')
  })

  it('lets an optional value be cleared', async () => {
    const { onSave, field } = setup({ placeholder: 'أضف وصفاً…' })
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''))
  })

  it('stays open with the typed text when saving fails, and can retry', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const { field } = setup({ onSave })
    fireEvent.change(field, { target: { value: 'محاولة' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const stillOpen = await screen.findByRole('textbox')
    expect(stillOpen).toHaveValue('محاولة')
    fireEvent.keyDown(stillOpen, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument())
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('keeps Shift+Enter as a new line in multiline mode', () => {
    const { onSave, field } = setup({ multiline: true })
    fireEvent.change(field, { target: { value: 'سطر' } })
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
