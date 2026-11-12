import { useTranslation } from 'react-i18next'

import { useEditor } from '../store'
import { useEditorUi } from '../ui'
import { useIntroBus } from './introBus'

/**
 * «الافتتاحية» في شريط المعاينة: يعيد عرض الشاشة الافتتاحية فوق المعاينة (لو مفعّلة في الإعدادات).
 * وطول ما الافتتاحية مغطّية المعاينة بيظهر جنبه «تخطّي الافتتاحية» بدل التلات ضغطات.
 * («تجربة الافتتاحية» اتنقلت للشريط العلوي: ‎IntroTrialButton‎.)
 */
export function IntroButton() {
  const { t } = useTranslation()
  const ui = useEditorUi()
  const show = useIntroBus((s) => s.show)
  const skip = useIntroBus((s) => s.skip)
  const covering = useIntroBus((s) => s.visible)
  return (
    <>
      {covering && (
        <button type="button" className="ed-btn ed-btn--sm ed-btn--primary ed-btn--skip-intro" title={t('editorSettings.intro.skipTitle')} onClick={skip}>
          {t('editorSettings.intro.skip')}
        </button>
      )}
      <button
        type="button"
        className="ed-btn ed-btn--sm"
        title={t('editorSettings.intro.title')}
        onClick={() => (useEditor.getState().doc.settings.intro_enabled ? show() : ui.toast(t('editorSettings.intro.disabled'), 'error'))}
      >
        {t('editorSettings.intro.button')}
      </button>
    </>
  )
}

/**
 * «تجربة الافتتاحية» في الشريط العلوي: ضغطة واحدة تعيد الافتتاحية من الأول وتشغّلها زي الضيف بالظبط
 * (الضغط على الزرار أو في أي مكان يفتح الدعوة، والفيديو مايتخطّاش). وطول التجربة بيبقى «إنهاء التجربة».
 * التجربة بتخلص لوحدها أول ما الافتتاحية تتفتح.
 */
export function IntroTrialButton() {
  const { t } = useTranslation()
  const ui = useEditorUi()
  const trying = useIntroBus((s) => s.trying)
  const setTrying = useIntroBus((s) => s.setTrying)
  return (
    <button
      type="button"
      className={`ed-btn ed-btn--sm ed-intro-trial${trying ? ' is-on' : ''}`}
      aria-pressed={trying}
      title={t(trying ? 'editorSettings.intro.tryEndTitle' : 'editorSettings.intro.tryTitle')}
      onClick={() => {
        if (trying) return setTrying(false)
        if (!useEditor.getState().doc.settings.intro_enabled) return ui.toast(t('editorSettings.intro.disabled'), 'error')
        setTrying(true)
      }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        {trying ? <rect x="6" y="6" width="12" height="12" rx="2" /> : <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />}
      </svg>
      {t(trying ? 'editorSettings.intro.tryEnd' : 'editorSettings.intro.try')}
    </button>
  )
}
