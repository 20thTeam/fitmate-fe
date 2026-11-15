// 스크린 판에 직접 입히는 따라하기 영상 (#76).
// DOM으로 겹치면 스크린 앞에 선 캐릭터까지 가려서, 영상만은 3D 안에서 그려 깊이에 맞게 가려지게 한다.
import { useEffect, useState, type RefObject } from 'react'
import { SRGBColorSpace, VideoTexture } from 'three'
import { SCREEN_CENTER, SCREEN_FACE_Z, SCREEN_H, SCREEN_W } from './layout'

interface Props {
  src: string
  /** 영상을 못 불러오면 부른다. Room3D가 DOM 안내 화면으로 바꾼다 */
  onError: () => void
  /** 스크린 틀 안쪽 너비. 기본은 SCREEN_W */
  width?: number
  /** 재생 중인 영상. 공개 운동방이 지금 동작을 알 때 재생 위치를 읽는다 (#110) */
  videoRef?: RefObject<HTMLVideoElement | null>
}

export default function VideoScreen3D({ src, onError, width = SCREEN_W, videoRef }: Props) {
  const [texture, setTexture] = useState<VideoTexture | null>(null)
  const [size, setSize] = useState<[number, number]>([width, SCREEN_H])

  useEffect(() => {
    const video = document.createElement('video')
    // 브라우저는 소리 있는 영상의 자동 재생을 막아서 muted가 꼭 있어야 한다
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'
    const t = new VideoTexture(video)
    t.colorSpace = SRGBColorSpace
    // 영상이 잘리지 않게 비율을 지켜 스크린 안에 맞춘다 (#79). 남는 양옆·위아래는 검은 판이 채운다
    const handleMeta = () => {
      const videoAspect = video.videoWidth / video.videoHeight
      if (!videoAspect) return
      const screenAspect = width / SCREEN_H
      setSize(videoAspect < screenAspect ? [SCREEN_H * videoAspect, SCREEN_H] : [width, width / videoAspect])
      // 크기를 안 뒤에 판에 입혀서 늘어난 모양이 잠깐 비치지 않게 한다
      setTexture(t)
    }
    if (videoRef) videoRef.current = video
    video.addEventListener('loadedmetadata', handleMeta)
    video.addEventListener('error', onError)
    video.src = src
    video.play().catch(() => {
      /* 자동 재생이 막혀도 첫 장면은 보인다 */
    })
    return () => {
      if (videoRef?.current === video) videoRef.current = null
      video.removeEventListener('loadedmetadata', handleMeta)
      video.removeEventListener('error', onError)
      video.pause()
      video.removeAttribute('src')
      video.load()
      t.dispose()
    }
  }, [src, onError, width, videoRef])

  // 스크린 판(앞면 z = SCREEN_CENTER z + 0.145)보다 아주 조금 앞에 둔다
  const [x, y] = SCREEN_CENTER
  return (
    <group position={[x, y, SCREEN_FACE_Z - 0.012]}>
      <mesh>
        <planeGeometry args={[width, SCREEN_H]} />
        <meshBasicMaterial color="#000" toneMapped={false} fog={false} />
      </mesh>
      {texture && (
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={size} />
          <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
        </mesh>
      )}
    </group>
  )
}
