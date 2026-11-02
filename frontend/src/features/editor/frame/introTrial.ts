/**
 * «تجربة الافتتاحية»: المصمّم يجرّب الشاشة الافتتاحية زي الضيف بالظبط (ضغطة على الزرار أو في أي مكان تفتح الدعوة).
 * طول التجربة كل مستمعات التحرير فوق الافتتاحية (تحديد/سحب/كتابة بضغطتين/تلات ضغطات) بتسيب الضغطة تعدّي،
 * والافتتاحية نفسها هي اللي بتتصرّف. بتخلص أول ما الافتتاحية تتفتح، أو بالإنهاء من شريط المعاينة.
 */
let trying = false

export function setIntroTrial(on: boolean): void {
  trying = on
  document.documentElement.toggleAttribute('data-intro-trial', on)
}

/** الهدف جوّه الافتتاحية والتجربة شغّالة: مستمعات المحرر ماتتدخّلش */
export function introTrialAt(target: EventTarget | null): boolean {
  return trying && target instanceof Element && target.closest('.lb-intro') !== null
}
