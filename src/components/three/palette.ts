// 3D 운동방 테마별 색. Figma 배경 그림(1:534 선셋, 공개방 바다)에서 뽑았다.
import sunsetBg from '../../assets/bg/sunset.jpg'
import oceanBg from '../../assets/bg/ocean-blur.jpg'
import type { Theme } from '../Backdrop'

export interface RoomPalette {
  /** 뒤쪽 둥근 벽에 입히는 배경 그림 */
  backdrop: string
  /** 배경 그림 아래쪽(바닥·호수)은 3D 바닥으로 대신해서 잘라낸다 (0~1) */
  backdropCropBottom: number
  /** 배경 벽 아랫변 높이. 그림 속 산·수평선이 무대 뒤 가장자리 바로 위에 오도록 맞춘다 */
  backdropBottom: number
  sky: string
  ground: string
  platform: string
  frame: string
  panel: string
  lampPost: string
  lampGlow: string
  hemiSky: string
  hemiGround: string
  sun: string
}

export const PALETTES: Record<Theme, RoomPalette> = {
  friend: {
    backdrop: sunsetBg,
    backdropCropBottom: 0.25,
    backdropBottom: -5.5,
    sky: '#f3b0cb',
    ground: '#c9b46e',
    platform: '#fbdcd8',
    frame: '#6a4865',
    panel: '#f6cdea',
    lampPost: '#5b3a56',
    lampGlow: '#fff4dc',
    hemiSky: '#ffe6ee',
    hemiGround: '#d9a3b8',
    sun: '#ffe6cf',
  },
  public: {
    backdrop: oceanBg,
    backdropCropBottom: 0.42,
    backdropBottom: -3.4,
    sky: '#cfe6fb',
    ground: '#57a7de',
    platform: '#f1ebf8',
    frame: '#4a4458',
    panel: '#f6ecfa',
    lampPost: '#3a3340',
    lampGlow: '#fffbe8',
    hemiSky: '#e4f2ff',
    hemiGround: '#c6b6d6',
    sun: '#fff6e6',
  },
}

