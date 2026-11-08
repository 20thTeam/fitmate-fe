// 일반 화면 배경. friend = 선셋 풍경, public = 흐린 바다 (Figma 결과·기록·카메라 확인 시안).
import type { CSSProperties, ReactNode } from 'react'
import sunsetBg from '../assets/bg/sunset.jpg'
import oceanBg from '../assets/bg/ocean-blur.jpg'

export type Theme = 'friend' | 'public'

const BG: Record<Theme, string> = { friend: sunsetBg, public: oceanBg }

interface Props {
  theme?: Theme
  /** 결과·기록처럼 글이 많은 화면은 배경을 어둡게 덮는다 */
  isDim?: boolean
  children: ReactNode
}

export default function Backdrop({ theme = 'friend', isDim = false, children }: Props) {
  const style = { '--bg-image': `url(${BG[theme]})` } as CSSProperties
  return (
    <main className={`backdrop ${isDim ? 'is-dim' : ''}`} data-theme={theme} style={style}>
      {children}
    </main>
  )
}
