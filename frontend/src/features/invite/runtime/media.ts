/**
 * فكّ قفل الوسائط — نسخة من ‎invite.js‎ (‎queueMedia/primeVideo/flushMedia‎).
 *
 * أهم فرق بين الموبايل والديسكتوب: وضع توفير الطاقة في iOS بيلغي التشغيل
 * التلقائي بالكامل — حتى الفيديو الصامت ‎playsinline‎. الرفض ده **على مستوى
 * العنصر مش الصفحة**: أول ما عنصر ‎<video>‎ يشتغل مرة واحدة جوّه مكدس لمسة
 * حقيقية، WebKit بيفكّه وبيسمح له يشتغل برمجياً بعد كده.
 *
 * فبدل ما نستنّى الفيديو يوصل للشاشة (واللمسة راحت)، بنسجّل كل فيديو معتمد
 * على التشغيل التلقائي في طابور، وأول لمسة حقيقية على الصفحة — وأهمها لمسة
 * «افتح الدعوة» — بنشغّله ونوقفه فوراً عشان ياخد الإذن ويكمّل بعد كده لوحده.
 */
const queue: HTMLVideoElement[] = []
let bound = false
const primed = new WeakSet<HTMLVideoElement>()
const wanted = new WeakSet<HTMLVideoElement>()
const codeVideos = new WeakSet<HTMLVideoElement>()

export function setWanted(v: HTMLVideoElement, on: boolean) {
  if (on) wanted.add(v)
  else wanted.delete(v)
}

export function resetPrimed(v: HTMLVideoElement) {
  primed.delete(v)
}

/** يشغّل العنصر ويوقفه فوراً — الهدف الإذن مش المشاهدة. */
function primeVideo(v: HTMLVideoElement) {
  if (primed.has(v)) return
  try {
    v.muted = true
    v.playsInline = true
    // التوفير بيخلّي preload فعلياً none، فالعنصر ممكن يكون فاضي لحظة اللمسة
    if (v.readyState === 0) {
      try {
        v.load()
      } catch {
        /* مش حرج */
      }
    }
    const p = v.play()
    const park = () => {
      primed.add(v)
      // لو العنصر ظاهر فعلاً في الشاشة سيبه شغال — ده مش تجهيز، ده عرض
      if (wanted.has(v)) return
      try {
        v.pause()
        // فيديو سكربت المصمّم مانرجّعوش للصفر: seek على فيديو واقف قبل ‎play()‎
        // الجاي بيعلّق ‎currentTime‎ في سفاري iOS 26 (نفس باج الافتتاحية)
        if (!codeVideos.has(v)) v.currentTime = 0
      } catch {
        /* مش حرج */
      }
    }
    if (p && typeof p.then === 'function') p.then(park, () => queueMedia(v))
    else park()
  } catch {
    queueMedia(v)
  }
}

function flush() {
  if (!queue.length) return
  const batch = queue.splice(0)
  batch.forEach(primeVideo)
}

function inView(el: Element) {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth
}

/**
 * فيديو بيبنيه سكربت «كود متقدّم» بنفسه (‎createElement('video')‎ من غير
 * ‎autoplay‎ — زي فيديو العروسين في قسم الصورة بتاع «وردة القصر»). ده مابيدخلش
 * ‎initImportedMedia‎: مكانش موجود وقت ما اشتغلت ومالوش ‎autoplay‎. فوضع التوفير
 * في الآيفون كان بيرفض ‎play()‎ بتاع سكربت المصمّم للأبد والضيف يشوف البوستر
 * واقف. بنفكّه في نفس اللمسة (تشغيل وإيقاف)، وسكربت المصمّم بيشغّله بعدين لما
 * يحب (بعد ‎lb:intro-open‎ أو لما القسم يبان) وده بيعدّي عادي.
 */
function primeCodeVideos(target: EventTarget | null) {
  const hit = target instanceof Node ? target : null
  document.querySelectorAll<HTMLVideoElement>('.lb-extra-html video').forEach((v) => {
    if (primed.has(v) || queue.includes(v) || v.closest('.lb-intro')) return
    // الصوت ماينفعش يطلع ولو لحظة — الفيديو اللي بصوت تشغيله قرار المصمّم
    if (!v.muted && !v.hasAttribute('muted')) return
    if (!v.paused) {
      primed.add(v)
      return
    }
    // اللمسة جوّه صندوق الكود نفسه: سكربت المصمّم غالباً هو اللي هيشغّل/يوقف
    // (فيديو بالضغط) — مانلعبش فيه عشان الإيقاف بتاعنا مايلغيش تشغيله
    const box = v.closest('.lb-extra-html')
    if (hit && box && box.contains(hit)) return
    // لوب صامت ظاهر والدعوة مفتوحة = خلفية متحركة اترفضت قبل كده: يفضل شغال
    if (v.loop && !document.querySelector('.lb-intro:not(.is-open)') && inView(v)) wanted.add(v)
    codeVideos.add(v)
    primeVideo(v)
  })
}

function onGesture(e: Event) {
  primeCodeVideos(e.target)
  flush()
}

function bindGestures() {
  if (bound) return
  bound = true
  // مرحلة الالتقاط عشان نسبق أي مستمع بيوقف الحدث (لمسة فتح الدعوة)
  ;['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => {
    document.addEventListener(ev, onGesture, { capture: true, passive: true })
  })
  // مش لمسة: الطابور بس — فيديوهات الكود هنا سكربت المصمّم بيشغّلها في نفس
  // اللحظة، ولو جهّزناها كنا هنوقفها وراه
  document.addEventListener('lb:intro-open', flush)
}

/**
 * ‎keepPlaying‎: الفيديو ده مالوش مراقب يشغّله بعدين (فيديو المصمّم في «كود
 * متقدّم» أو قسم مستورد) — فالتجهيز بالنسبة له هو التشغيل نفسه.
 */
export function queueMedia(v: HTMLVideoElement, keepPlaying = false) {
  if (!v || primed.has(v)) return
  if (keepPlaying) wanted.add(v)
  if (!queue.includes(v)) queue.push(v)
  bindGestures()
}

/**
 * فيديوهات القوالب المستوردة: القالب المستورد قد يحتوي ‎<video>‎ خاماً بدون
 * ‎data-video‎ — بنفعّل الصامت بأمان من الـruntime بدون تشغيل أي JavaScript
 * مستورد. وفيديو «كود متقدّم» اللي طالب ‎autoplay‎ صراحةً بياخد نفس المعاملة.
 */
const bound$ = new WeakSet<HTMLVideoElement>()

function play(video: HTMLVideoElement) {
  const p = video.play()
  if (p && p.catch) p.catch(() => {})
}

/**
 * فيديو جوّه قسم (مش جوّه الافتتاحية نفسها) بيستنّى الافتتاحية — زي فيديو
 * قسم «فيديو» (‎Video.tsx‎). ‎pause()‎ بيلغي ‎autoplay‎ المكتوب في الـHTML،
 * ومانحطّوش في طابور فكّ القفل دلوقتي — وإلا لمسة الضيف على الافتتاحية
 * بتشغّله على طول (‎keepPlaying‎). ‎start(true)‎ = اتأجّل فلازم نشغّله احنا.
 */
function holdForIntro(video: HTMLVideoElement, start: (held: boolean) => void) {
  if (video.closest('.lb-intro') || !document.querySelector('.lb-intro:not(.is-open)')) {
    start(false)
    return
  }
  try {
    video.pause()
  } catch {
    /* مش حرج */
  }
  document.addEventListener(
    'lb:intro-open',
    () => {
      if (video.isConnected) start(true)
    },
    { once: true },
  )
}

export function initImportedMedia(scope: ParentNode = document) {
  // فيديوهات سكربت المصمّم بتتبني بعد كده (وأقسام بتتحمّل متأخر): اللمسة لازم
  // تبقى متسجّلة من دلوقتي
  bindGestures()
  scope.querySelectorAll<HTMLVideoElement>('.lb-custom video').forEach((video) => {
    if (bound$.has(video)) return
    bound$.add(video)
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.style.visibility = 'visible'
    holdForIntro(video, () => {
      play(video)
      queueMedia(video, true)
    })
  })
  scope
    .querySelectorAll<HTMLVideoElement>('.lb-extra-html video[autoplay], .lb-intro-extra video[autoplay]')
    .forEach((video) => {
      if (bound$.has(video)) return
      bound$.add(video)
      video.playsInline = true
      holdForIntro(video, (held) => {
        if (held) play(video)
        queueMedia(video, true)
      })
    })
}
