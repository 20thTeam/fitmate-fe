// 3D 운동방 테마별 색. Figma 배경 그림(1:534 선셋, 공개방 바다)에서 뽑았다.
import sunsetBg from '../../assets/bg/sunset.jpg'
import oceanBg from '../../assets/bg/ocean-blur.jpg'
import type { Theme } from '../Backdrop'

export interface RoomPalette {
  /** 뒤쪽 둥근 벽에 입히는 배경 그림 */
  backdrop: string
  /** 배경 그림 아래쪽(바닥·호수)은 3D 바닥으로 대신해서 잘라낸다 (0~1) */
  backdropCropBottom: number
  sky: string
  ground: string
  platform: string
  frame: string
  panel: string
  lampPost: string
  lampGlow: string
  foliage: [string, string]
  trunk: string
  rock: string
  hemiSky: string
  hemiGround: string
  sun: string
}

export const PALETTES: Record<Theme, RoomPalette> = {
  friend: {
    backdrop: sunsetBg,
    backdropCropBottom: 0.17,
    sky: '#f2b9cf',
    ground: '#e9b3c9',
    platform: '#f7e3ea',
    frame: '#4e3b4d',
    panel: '#f8e8f4',
    lampPost: '#3d2c43',
    lampGlow: '#fff1d0',
    foliage: ['#a5c46c', '#c0d98a'],
    trunk: '#dc8b7b',
    rock: '#d8c6e6',
    hemiSky: '#ffe3ee',
    hemiGround: '#b993b9',
    sun: '#ffe2c6',
  },
  public: {
    backdrop: oceanBg,
    backdropCropBottom: 0.42,
    sky: '#cfe6fb',
    ground: '#57a7de',
    platform: '#f1ebf8',
    frame: '#4a4458',
    panel: '#f6ecfa',
    lampPost: '#3a3340',
    lampGlow: '#fffbe8',
    foliage: ['#5aa847', '#7cc65a'],
    trunk: '#b8875a',
    rock: '#ece6ef',
    hemiSky: '#e4f2ff',
    hemiGround: '#c6b6d6',
    sun: '#fff6e6',
  },
}

