import { useEffect, useRef, type CSSProperties } from 'react'

import { useInvite } from '../context'
import { queueMedia, resetPrimed, setWanted } from '../runtime/media'
import { text } from '../style'
import type { BlockData } from '../types'
import { Frame } from './Frame'

interface CoverVideoProps {
  url?: string
  poster?: string
  position?: string
  loop?: boolean
}

/** فيديو الغلاف: صامت ومتكرر، بيشتغل لما القسم يظهر ويقف لما يعدّي (زي الفيديو التلقائي). */
function CoverFile({ url, poster, loop }: { url: string; poster: string; loop: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.autoplay = true
    v.preload = 'auto'
    v.disablePictureInPicture = true
    queueMedia(v)

    const tryPlay = () => {
      const p = v.play()
      if (!p || !p.catch) return
      p.catch(() => {
        resetPrimed(v)
        queueMedia(v)
      })
    }
    if (typeof IntersectionObserver !== 'function') {
      setWanted(v, true)
      tryPlay()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            setWanted(v, true)
            tryPlay()
          } else {
            setWanted(v, false)
            if (!v.paused) v.pause()
          }
        })
      },
      { threshold: 0.2 },
    )
    io.observe(v)
    return () => io.disconnect()
  }, [])

  return <video ref={ref} src={url} loop={loop} muted playsInline poster={poster || undefined} />
}

export function CoverVideo({ block }: { block: BlockData }) {
  const { t } = useInvite()
  const p = block.props as CoverVideoProps
  const vars = { '--cover-pos': text(p.position) || 'center' } as unknown as CSSProperties
  return (
    <Frame block={block} ornaments={false} innerClass="lb-cover" style={vars}>
      {p.url ? (
        <CoverFile url={p.url} poster={p.poster || ''} loop={p.loop !== false} />
      ) : (
        <div className="lb-gempty">{t('empty.coverVideo')}</div>
      )}
    </Frame>
  )
}
