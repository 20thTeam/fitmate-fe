// 운동방 장면: 배경 그림 + 그림 속 스크린 + 가장자리에 띄우는 패널(HUD).
// 스크린 위치는 배경 그림 기준 비율이라 창 크기가 바뀌어도 그림의 화면 틀 안에 맞는다.
import type { CSSProperties, ReactNode } from 'react'
import friendBg from '../../assets/bg/room-friend.jpg'
import publicBg from '../../assets/bg/room-public.jpg'
import type { Theme } from '../Backdrop'

const BG: Record<Theme, string> = { friend: friendBg, public: publicBg }

interface Props {
  theme: Theme
  /** 가운데 스크린 안에 그릴 내용 (따라하기 영상·동작 안내) */
  screen?: ReactNode
  /** 바닥 위 캐릭터 자리 */
  floor?: ReactNode
  children: ReactNode
}

export default function Scene({ theme, screen, floor, children }: Props) {
  const style = { '--bg-image': `url(${BG[theme]})` } as CSSProperties
  return (
    <main className="scene" data-theme={theme}>
      <div className="scene-art" style={style}>
        {screen && <div className="scene-screen" data-variant={theme}>{screen}</div>}
        {floor}
      </div>
      <div className="scene-hud">{children}</div>
    </main>
  )
}
