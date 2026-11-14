// 운동방 장면: 3D 무대(스크린·캐릭터) + 가장자리에 띄우는 패널(HUD).
// WebGL을 못 쓰거나 3D가 실패하면 예전 2D 그림 장면으로 보여준다.
import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react'
import friendBg from '../../assets/bg/room-friend.jpg'
import publicFrontBg from '../../assets/bg/public-room-front.jpg'
import publicAngleBg from '../../assets/bg/public-room-angle.jpg'
import type { Participant } from '../../types/domain'
import type { Theme } from '../Backdrop'
import type { CameraView } from '../three/Room3D'
import ThreeBoundary from '../three/ThreeBoundary'
import { canUseWebGL } from '../../lib/webgl'
import CharacterFloor from './CharacterFloor'
import VideoScreen from './VideoScreen'

// three.js는 무거워서 운동방에 들어올 때만 받는다
const Room3D = lazy(() => import('../three/Room3D'))

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
  /** 있으면 스크린 왼쪽에 AI 코치 시범을 띄운다 (3D에서만. 2D 대체 화면은 기존 안내 카드) */
  coachExerciseId?: string
  /**
   * 있으면 스크린에 이 영상을 소리 없이 반복 재생한다 (#66). 3D에서는 스크린 판에 직접 입혀
   * 앞에 선 캐릭터가 가려지지 않게 한다 (#76). 영상이 안 되면 screen을 보여준다
   */
  screenVideo?: { src: string; label: string }
  children: ReactNode
}

/** 2D 그림 장면 (3D 로딩 중·실패 시). 공개방은 카메라 구도에 맞는 그림을 쓴다 */
function FlatScene({ theme, view = 'tour', screen, participants, selfId, onCheer, maxShown }: Omit<Props, 'children' | 'coachExerciseId'>) {
  const background = theme === 'public'
    ? (view === 'front' ? publicFrontBg : publicAngleBg)
    : friendBg
  const style = { '--bg-image': `url(${background})` } as CSSProperties
  return (
    <div className="scene-art" style={style}>
      {screen && <div className="scene-screen" data-variant={theme} data-view={view}>{screen}</div>}
      {participants && selfId && <CharacterFloor theme={theme} participants={participants} selfId={selfId} maxShown={maxShown} onCheer={onCheer} />}
    </div>
  )
}

export default function Scene({ theme, screen, participants, selfId, onCheer, maxShown, view = 'tour', coachExerciseId, screenVideo, children }: Props) {
  // 2D 그림 장면은 캐릭터가 스크린 밖에 서서 DOM 영상으로 충분하다
  const flatScreen = screenVideo ? <VideoScreen src={screenVideo.src} label={screenVideo.label} fallback={screen} /> : screen
  const flat = <FlatScene theme={theme} view={view} screen={flatScreen} participants={participants} selfId={selfId} onCheer={onCheer} maxShown={maxShown} />
  return (
    <main className="scene" data-theme={theme}>
      <div className="scene-stage">
        {canUseWebGL() ? (
          <ThreeBoundary fallback={flat}>
            {/* 3D를 받는 동안에는 같은 구도의 2D 그림을 보여준다 */}
            <Suspense fallback={<FlatScene theme={theme} view={view} />}>
              <Room3D theme={theme} screen={screen} participants={participants ?? []} selfId={selfId} onCheer={onCheer} maxShown={maxShown} view={view} coachExerciseId={coachExerciseId} screenVideoSrc={screenVideo?.src} />
            </Suspense>
          </ThreeBoundary>
        ) : flat}
      </div>
      <div className="scene-hud">{children}</div>
    </main>
  )
}
