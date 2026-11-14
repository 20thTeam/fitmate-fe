// 스크린 판에 직접 입히는 따라하기 영상 (#76).
// DOM으로 겹치면 스크린 앞에 선 캐릭터까지 가려서, 영상만은 3D 안에서 그려 깊이에 맞게 가려지게 한다.
import { useEffect, useState } from 'react'
import { SRGBColorSpace, VideoTexture } from 'three'
import { SCREEN_CENTER, SCREEN_FACE_Z, SCREEN_H, SCREEN_W } from './layout'

interface Props {
  src: string
  /** 영상을 못 불러오면 부른다. Room3D가 DOM 안내 화면으로 바꾼다 */
  onError: () => void
}

export default function VideoScreen3D({ src, onError }: Props) {
  const [texture, setTexture] = useState<VideoTexture | null>(null)

  useEffect(() => {
    const video = document.createElement('video')
    // 브라우저는 소리 있는 영상의 자동 재생을 막아서 muted가 꼭 있어야 한다
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'
    const t = new VideoTexture(video)
    t.colorSpace = SRGBColorSpace
    // 스크린(약 2:1)보다 영상이 덜 넓으면 위아래를 잘라 꽉 채운다 (object-fit: cover와 같음)
    const handleMeta = () => {
      const videoAspect = video.videoWidth / video.videoHeight
      const screenAspect = SCREEN_W / SCREEN_H
      if (!videoAspect) return
      if (videoAspect < screenAspect) {
        t.repeat.set(1, videoAspect / screenAspect)
        t.offset.set(0, (1 - t.repeat.y) / 2)
      } else {
        t.repeat.set(screenAspect / videoAspect, 1)
        t.offset.set((1 - t.repeat.x) / 2, 0)
      }
      // 크기를 안 뒤에 판에 입혀서 잘리기 전 모양이 잠깐 비치지 않게 한다
      setTexture(t)
    }
    video.addEventListener('loadedmetadata', handleMeta)
    video.addEventListener('error', onError)
    video.src = src
    video.play().catch(() => {
      /* 자동 재생이 막혀도 첫 장면은 보인다 */
    })
    return () => {
      video.removeEventListener('loadedmetadata', handleMeta)
      video.removeEventListener('error', onError)
      video.pause()
      video.removeAttribute('src')
      video.load()
      t.dispose()
    }
  }, [src, onError])

  if (!texture) return null
  return (
    // 스크린 판(앞면 z = SCREEN_CENTER z + 0.145)보다 아주 조금 앞에 둔다
    <mesh position={[SCREEN_CENTER[0], SCREEN_CENTER[1], SCREEN_FACE_Z - 0.01]}>
      <planeGeometry args={[SCREEN_W, SCREEN_H]} />
      <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
    </mesh>
  )
}
