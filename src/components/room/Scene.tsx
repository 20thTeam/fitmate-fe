// 운동방 장면: 3D 무대(스크린·캐릭터) + 가장자리에 띄우는 패널(HUD).
// WebGL을 못 쓰거나 3D가 실패하면 예전 2D 그림 장면으로 보여준다.
import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react'
import friendBg from '../../assets/bg/room-friend.jpg'
import publicBg from '../../assets/bg/room-public.jpg'
import type { Participant } from '../../types/domain'
import type { Theme } from '../Backdrop'
import type { CameraView } from '../three/Room3D'
import ThreeBoundary from '../three/ThreeBoundary'
import { canUseWebGL } from '../../lib/webgl'
import CharacterFloor from './CharacterFloor'

// three.js는 무거워서 운동방에 들어올 때만 받는다
const Room3D = lazy(() => import('../three/Room3D'))

const BG: Record<Theme, string> = { friend: friendBg, public: publicBg }

interface Props {
  theme: Theme
  /** 가운데 스크린 안에 그릴 내용 (따라하기 영상·동작 안내) */
  screen?: ReactNode
  /** 무대 위에 세울 실제 참가자 */
  participants?: Participant[]
  selfId?: string
  onCheer?: (p: Participant) => void
  maxShown?: number
  /** tour: 대기 중 천천히 둘러보기, front: 운동 중 스크린 정면 */
  view?: CameraView
  children: ReactNode
}

/** 2D 그림 장면 (3D 로딩 중·실패 시) */
function FlatScene({ theme, screen, participants, selfId, onCheer, maxShown }: Omit<Props, 'children' | 'view'>) {
  const style = { '--bg-image': `url(${BG[theme]})` } as CSSProperties
  return (
    <div className="scene-art" style={style}>
      {screen && <div className="scene-screen" data-variant={theme}>{screen}</div>}
      {participants && selfId && <CharacterFloor theme={theme} participants={participants} selfId={selfId} maxShown={maxShown} onCheer={onCheer} />}
    </div>
  )
}

export default function Scene({ theme, screen, participants, selfId, onCheer, maxShown, view = 'tour', children }: Props) {
  const flat = <FlatScene theme={theme} screen={screen} participants={participants} selfId={selfId} onCheer={onCheer} maxShown={maxShown} />
  return (
    <main className="scene" data-theme={theme}>
      <div className="scene-stage">
        {canUseWebGL() ? (
          <ThreeBoundary fallback={flat}>
            {/* 3D를 받는 동안에는 같은 구도의 2D 그림을 보여준다 */}
            <Suspense fallback={<FlatScene theme={theme} />}>
              <Room3D theme={theme} screen={screen} participants={participants ?? []} selfId={selfId} onCheer={onCheer} maxShown={maxShown} view={view} />
            </Suspense>
          </ThreeBoundary>
        ) : flat}
      </div>
      <div className="scene-hud">{children}</div>
    </main>
  )
}
