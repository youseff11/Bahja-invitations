import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { initI18n } from '@/i18n'
import { EditorUiProvider, useEditorUi } from './ui'

function Asker({ onAnswer, danger }: { onAnswer: (ok: boolean) => void; danger?: boolean }) {
  const ui = useEditorUi()
  return <button onClick={async () => onAnswer(await ui.confirm('حذف قسم «معرض صور»؟', { danger }))}>ask</button>
}

function setup(danger?: boolean) {
  cleanup()
  const onAnswer = vi.fn()
  render(
    <EditorUiProvider>
      <Asker onAnswer={onAnswer} danger={danger} />
    </EditorUiProvider>,
  )
  fireEvent.click(screen.getByText('ask'))
  return onAnswer
}

beforeAll(() => initI18n('ar'))

describe('editor confirm dialog', () => {
  it('shows the message under a delete title and resolves true on confirm', async () => {
    const onAnswer = setup(true)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('تأكيد الحذف')
    expect(dialog).toHaveTextContent('حذف قسم «معرض صور»؟')
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('resolves false on cancel, Escape and a backdrop click', async () => {
    let onAnswer = setup(true)
    fireEvent.click(await screen.findByRole('button', { name: 'إلغاء' }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false))

    onAnswer = setup(true)
    await screen.findByRole('alertdialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false))

    onAnswer = setup(true)
    await screen.findByRole('alertdialog')
    fireEvent.mouseDown(document.querySelector('.ed-confirm') as HTMLElement)
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false))
  })

  it('starts on «cancel» for a destructive action and on «confirm» otherwise', async () => {
    setup(true)
    expect(await screen.findByRole('button', { name: 'إلغاء' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    setup(false)
    expect(await screen.findByRole('button', { name: 'تأكيد' })).toHaveFocus()
  })
})
