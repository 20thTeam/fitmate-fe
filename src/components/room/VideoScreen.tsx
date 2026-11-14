// 운동방 가운데 스크린에 띄우는 따라하기 영상. 소리 없이 자동 재생하고 끝나면 처음부터 다시 튼다 (#66).
import { useState, type ReactNode } from 'react'

interface Props {
  src: string
  /** 영상을 못 불러오면 대신 보여줄 화면 */
  fallback: ReactNode
  label: string
}

export default function VideoScreen({ src, fallback, label }: Props) {
  const [hasError, setHasError] = useState(false)
  if (hasError) return <>{fallback}</>
  return (
    <video
      src={src}
      aria-label={label}
      // 브라우저는 소리 있는 영상의 자동 재생을 막아서 muted가 꼭 있어야 한다
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      onError={() => setHasError(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000', pointerEvents: 'none' }}
    />
  )
}
