// 카메라 영상이 너무 어둡지 않은지 잰다 (F-ZGIFAX 카메라 확인).
// 작은 캔버스에 0.5초마다 한 장씩 그려 평균 밝기를 본다. 영상은 브라우저 밖으로 나가지 않는다.
import { useEffect, useState } from 'react'
import { PROVISIONAL_CAMERA_CHECK } from '../config/provisional'

export type Brightness = 'ok' | 'dark' | null

const SAMPLE_W = 32
const SAMPLE_H = 24
const INTERVAL_MS = 500

export function useBrightness(stream: MediaStream | null): Brightness {
  const [brightness, setBrightness] = useState<Brightness>(null)

  useEffect(() => {
    if (!stream) return
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    video.play().catch(() => {})
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_W
    canvas.height = SAMPLE_H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const timer = setInterval(() => {
      if (!ctx || video.readyState < 2) return
      ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H)
      const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data
      let sum = 0
      for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      const mean = sum / (SAMPLE_W * SAMPLE_H)
      setBrightness(mean >= PROVISIONAL_CAMERA_CHECK.minBrightness ? 'ok' : 'dark')
    }, INTERVAL_MS)

    return () => {
      clearInterval(timer)
      video.pause()
      video.srcObject = null
      setBrightness(null)
    }
  }, [stream])

  return stream ? brightness : null
}
