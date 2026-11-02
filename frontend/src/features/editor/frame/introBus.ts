import { create } from 'zustand'

/**
 * زراير «الافتتاحية» و«تخطّي الافتتاحية» و«تجربة الافتتاحية» في شريط المعاينة بيزوّدوا العدّادات، و‎PreviewPane‎ بيبعت للإطار.
 * ‎visible‎ جاية من الإطار: الافتتاحية مغطّية المعاينة دلوقتي (زرار التخطّي والتجربة بيظهروا وقتها بس).
 * ‎trying‎: المصمّم بيجرّب الافتتاحية زي الضيف (الضغطات بتشتغل عليها)؛ بتخلص لما الافتتاحية تتفتح أو تتقفل.
 * منفصلة عن ستور المحرر: دي أوامر لحظية للمعاينة مش جزء من حالة المستند.
 */
interface IntroBus {
  count: number
  show: () => void
  skipCount: number
  skip: () => void
  trying: boolean
  tryCount: number
  setTrying: (on: boolean) => void
  visible: boolean
  setVisible: (visible: boolean) => void
}

export const useIntroBus = create<IntroBus>()((set) => ({
  // «الافتتاحية» بتعيدها في وضع التحرير، فبتنهي التجربة لو شغّالة
  count: 0,
  show: () => set((state) => ({ count: state.count + 1, trying: false })),
  skipCount: 0,
  skip: () => set((state) => ({ skipCount: state.skipCount + 1 })),
  trying: false,
  tryCount: 0,
  setTrying: (on) => set((state) => ({ trying: on, tryCount: state.tryCount + 1 })),
  visible: false,
  setVisible: (visible) => set(visible ? { visible } : { visible, trying: false }),
}))
