import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { services } from '../services'
import { SUNSET_ROOM_ID, useApp } from '../store/app'
import type { Participant, Profile, PublicPartySchedule, WorkoutSession } from '../types/domain'
import { SUNSET_EXERCISE } from '../config/provisional'
import { ROUTINE_THUMB } from '../config/exercises'
import { clockLabel } from '../lib/format'
import { isProvisionalSchedule, sunsetHourLabel } from '../lib/sunset'
import { useSunsetStatus } from '../hooks/useSunsetStatus'
import { useRoom } from '../hooks/useRoom'
import { useCamera, CAMERA_MESSAGE } from '../hooks/useCamera'
import { useWorkout } from '../hooks/useWorkout'
import { useNow } from '../hooks/useNow'
import { useToast } from '../hooks/useToast'
import { useRepCounting } from '../hooks/useRepCounting'
import { useCoachVoice } from '../hooks/useCoachVoice'
import Scene from '../components/room/Scene'
import ModeTabs from '../components/room/ModeTabs'
import ParticipantPanel, { FriendStrip } from '../components/room/ParticipantPanel'
import { RoutineOrderPanel } from '../components/room/RoutinePanels'
import SummaryBar from '../components/room/SummaryBar'
import GuideScreen from '../components/room/GuideScreen'
import VideoScreen from '../components/room/VideoScreen'
import WorkoutHud from '../components/room/WorkoutHud'
import CoachBubble from '../components/room/CoachBubble'
import MyCameraPanel from '../components/room/MyCameraPanel'
import VoiceToggle from '../components/room/VoiceToggle'
import { CameraLostDialog, EndConfirmDialog, LeaveDialog } from '../components/room/WorkoutDialogs'
import CameraCheck from '../components/CameraCheck'
import ConnectionBanner from '../components/room/ConnectionBanner'
import EnterLoading from '../components/EnterLoading'
import { CenterMessage, Logo, ProvisionalBadge } from '../components/ui'
import groupIcon from '../assets/icons/group-public.png'
import sunsetVideo from '../assets/video/sunset-aerobic.mp4'

// 공개 운동방 (선셋 에어로빅, F-DXORMB) · Figma '공개 운동방' 시안
// 열려 있는 동안 자유 입장, 입장 후 각자 시작. 인원 제한 없음. 결과는 다음 회차 추천에 반영하지 않는다.

/** 공개 운동방 목록에 그릴 최대 인원 (F-DXORMB 권장안: 일부만 표시 + 실제 인원은 따로) */
const SUNSET_SHOWN = 5
const ENTER_STEP_MS = 400

const SUNSET_ITEMS = [{ ...SUNSET_EXERCISE, sets: 1, tag: '선셋 에어로빅 · 자유 진행' }]

export default function Sunset() {
  const profile = useApp((s) => s.profile)!
  const { status, isChecking } = useSunsetStatus()
  // 한 번 들어온 방은 이후 상태가 닫힘으로 바뀌어도 그대로 둔다 (이미 하던 운동은 마칠 수 있다, F-DXORMB 권장안)
  const [hasEntered, setHasEntered] = useState(false)
  const canEnter = !isChecking && status.isOpen
  if (canEnter && !hasEntered) setHasEntered(true)

  if (hasEntered) return <SunsetRoom profile={profile} closesAt={status.closesAt} schedule={status.schedule} />
  // 임시 운영 시각으로는 열린 시간이라도 서버 확인을 기다린다 (서버 운영 시각이 다를 수 있음)
  if (status.isOpen) return <EnterLoading theme="public" title="공개 운동방 운영 시간을 확인하는 중..." steps={[{ label: '운영 시간 확인', isDone: false }]} />
  return <SunsetClosed nextOpenAt={status.nextOpenAt} schedule={status.schedule} />
}

/** 오픈 전에는 미리보기와 다음 오픈 시각 (F-DXORMB 권장안) */
function SunsetClosed({ nextOpenAt, schedule }: { nextOpenAt: number; schedule: PublicPartySchedule }) {
  const opensAt = new Date(nextOpenAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <Scene theme="public" screen={<GuideScreen idleTitle={`다음 오픈: ${opensAt}`} idleDesc="공개 운동방이 열리면 다른 참가자들과 자유롭게 에어로빅을 즐길 수 있어요." />}>
      <Logo />
      <ModeTabs active="public" />
      <div style={{ position: 'absolute', left: 44, bottom: 48, width: 243 }}>
        <RoutineOrderPanel items={SUNSET_ITEMS} sub="선셋 에어로빅" />
      </div>
      <div style={{ position: 'absolute', left: 316, right: 240, bottom: 48, display: 'flex', justifyContent: 'center' }}>
        <SummaryBar
          thumb={ROUTINE_THUMB}
          caption="오늘의 운동"
          title="선셋 에어로빅"
          chip={<span className="chip chip-ghost">오픈 전</span>}
          stats={[{ label: '운영 시간', value: sunsetHourLabel(schedule) }]}
          note={isProvisionalSchedule(schedule) && <ProvisionalBadge>운영 시각 임시</ProvisionalBadge>}
          action={<button className="btn btn-brown" style={{ minWidth: 168, height: 56, fontSize: 20 }} disabled>오픈 전</button>}
        />
      </div>
      {import.meta.env.DEV && (
        <a className="t-xs" href="/sunset?sunset=open" style={{ position: 'absolute', right: 34, top: 120, color: '#24405f' }}>[개발용] 오픈 상태로 보기</a>
      )}
    </Scene>
  )
}

type Phase = 'lobby' | 'camera' | 'entering' | 'play'

function SunsetRoom({ profile, closesAt, schedule }: { profile: Profile; closesAt: number | null; schedule: PublicPartySchedule }) {
  const nav = useNavigate()
  const room = useRoom(SUNSET_ROOM_ID, profile, { maxParticipants: null, initial: { status: 'waiting' } })
  const camera = useCamera()
  const items = useMemo(() => [{ ...SUNSET_EXERCISE, sets: 1 }], [])
  const workout = useWorkout(items)
  const toast = useToast()
  const voice = useCoachVoice()

  const [phase, setPhase] = useState<Phase>('lobby')
  const [enterStartedAt, setEnterStartedAt] = useState(0)
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasSaveError, setHasSaveError] = useState(false)
  // 공개 파티 기록 ID를 미리 받아 둔다. 실패하면 끝낼 때 다시 받는다 (서버는 진행 중인 기록을 돌려줘 중복되지 않는다)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const now = useNow(phase === 'play' || phase === 'entering', phase === 'entering' ? 100 : 1000)

  const blocker = useBlocker(({ nextLocation }) => phase === 'play' && !isSaving && !nextLocation.pathname.startsWith('/result'))

  useEffect(() => {
    if (phase !== 'play') return
    room.updateSelf({ status: workout.isRunning ? 'exercising' : 'paused', currentExercise: SUNSET_EXERCISE.name, validReps: workout.record?.validReps })
  }, [phase, workout.isRunning, workout.record?.validReps]) // eslint-disable-line react-hooks/exhaustive-deps

  // 카메라로 유효 횟수 세기 (F-XNIIJM). 모델은 카메라 확인 단계부터 미리 받는다
  const poseCanvasRef = useRef<HTMLCanvasElement>(null)
  const counting = useRepCounting({
    exerciseId: SUNSET_EXERCISE.exerciseId,
    stream: camera.stream,
    shouldLoad: phase !== 'lobby',
    isActive: phase === 'play' && workout.isRunning,
    workout,
    canvasRef: poseCanvasRef,
  })

  const isCameraBroken = phase === 'play' && camera.state !== 'on'
  useEffect(() => {
    if (isCameraBroken && workout.isRunning) workout.pause()
  }, [isCameraBroken]) // eslint-disable-line react-hooks/exhaustive-deps

  // 파티가 닫혀도 이미 운동 중인 사람은 마칠 수 있다 (F-DXORMB 권장안)
  const isClosed = closesAt !== null && now > closesAt

  const enterElapsed = now - enterStartedAt
  const enterSteps = [
    { label: '공개 운동방 연결 확인', isDone: room.state === 'joined' && enterElapsed > ENTER_STEP_MS },
    { label: '운동장 불러오는 중', isDone: enterElapsed > ENTER_STEP_MS * 2 },
    { label: '카메라 불러오는 중', isDone: camera.isOn && enterElapsed > ENTER_STEP_MS * 3 },
    // 모델을 못 받아도 운동은 할 수 있게 넘어간다 (운동 화면에서 다시 시도 안내)
    { label: '자세 인식 준비 중', isDone: (counting.modelState === 'ready' || counting.modelState === 'error') && enterElapsed > ENTER_STEP_MS * 4 },
  ]
  const isEnterReady = enterSteps.every((s) => s.isDone)
  useEffect(() => {
    if (phase !== 'entering' || !isEnterReady) return
    const t = setTimeout(() => {
      setPhase('play')
      workout.start()
    }, ENTER_STEP_MS)
    return () => clearTimeout(t)
  }, [phase, isEnterReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCameraConfirmed = () => {
    setEnterStartedAt(Date.now())
    setPhase('entering')
    if (!sessionId) services.record.startSession({ kind: 'sunset', routineId: null, roomId: null }).then(setSessionId).catch(() => {})
  }

  const finish = async () => {
    setIsSaving(true)
    const result = workout.finalize()
    const id = sessionId ?? (await services.record.startSession({ kind: 'sunset', routineId: null, roomId: null }).catch(() => null))
    if (!id) {
      setIsSaving(false)
      setHasSaveError(true)
      return
    }
    const session: WorkoutSession = {
      sessionId: id,
      kind: 'sunset',
      userId: profile.userId,
      roomId: SUNSET_ROOM_ID,
      routineId: null,
      round: null,
      goal: null,
      startedAt: result.startedAt,
      endedAt: Date.now(),
      activeMs: result.activeMs,
      // 에어로빅은 목표 수행량이 없어 실제로 인정된 동작이 있으면 완료로 본다
      records: result.records.map((r) => ({ ...r, completed: r.validReps > 0 })),
    }
    try {
      await services.record.saveSession(session)
      room.updateSelf({ status: 'done' })
      camera.stop()
      nav(`/result/${session.sessionId}`)
    } catch {
      setIsSaving(false)
      setHasSaveError(true)
    }
  }

  const handleCheer = (p: Participant) => {
    if (room.sendCheer(p.userId)) toast.show(`${p.nickname}님에게 응원을 보냈어요 🔥`)
  }

  if (room.state === 'joining') return <EnterLoading theme="public" title="공개 운동방에 입장하는 중..." steps={[{ label: '공개 운동방 연결 확인', isDone: false }]} />
  if (room.state !== 'joined') {
    // 연결 실패 시 재시도 (F-DXORMB 권장안)
    return (
      <CenterMessage
        theme="public"
        title="공개 운동방에 연결할 수 없어요"
        desc="잠시 후 다시 시도해 주세요."
        action={<>
          <button className="btn btn-secondary" onClick={() => nav('/home')}>홈으로</button>
          <button className="btn btn-primary" onClick={room.retry}>다시 시도</button>
        </>}
      />
    )
  }

  const record = workout.record
  if (!record) return null

  if (phase === 'camera') return <CameraCheck camera={camera} theme="public" onBack={() => setPhase('lobby')} onConfirm={handleCameraConfirmed} confirmLabel="에어로빅 시작하기" />
  if (phase === 'entering') return <EnterLoading theme="public" title="공개 운동방에 입장하는 중..." steps={enterSteps} />

  const isPartial = room.participants.length > SUNSET_SHOWN
  const panel = (
    <ParticipantPanel
      title={<span className="row panel-title" style={{ gap: 8 }}><img src={groupIcon} alt="" width={20} height={20} />현재 참가자</span>}
      headerRight={isPartial ? <span className="t-xs" style={{ color: '#d6e4ff' }}>일부만 표시중</span> : undefined}
      participants={room.participants}
      selfId={profile.userId}
      maxShown={SUNSET_SHOWN}
      onCheer={handleCheer}
      emptyText="지금은 나 혼자 있어요. 다른 참가자가 들어오면 바로 보여요."
    />
  )

  return (
    <Scene
      theme="public"
      // 공개방은 동작 안내 카드 대신 에어로빅 영상을 계속 반복해서 틀어 둔다 (#66). 영상이 안 되면 안내 카드
      screen={
        <VideoScreen
          src={sunsetVideo}
          label="선셋 에어로빅 따라하기 영상"
          fallback={<GuideScreen exerciseId={phase === 'play' ? SUNSET_EXERCISE.exerciseId : undefined} name={SUNSET_EXERCISE.name} idleTitle="선셋 에어로빅이 열렸어요!" idleDesc={`지금 ${room.participants.length}명 참가 중 · 준비되면 각자 시작해요`} />}
        />
      }
      participants={room.participants}
      selfId={profile.userId}
      maxShown={SUNSET_SHOWN}
      onCheer={handleCheer}
      view={phase === 'play' ? 'front' : 'tour'}
    >
      <Logo />
      <ConnectionBanner state={room.connection} onReconnect={room.reconnect} />
      <ModeTabs active="public" />

      {phase === 'lobby' && (
        <>
          <div style={{ position: 'absolute', right: 30, top: 145, width: 243 }}>{panel}</div>
          <div style={{ position: 'absolute', left: 44, bottom: 48, width: 243 }}>
            <RoutineOrderPanel items={SUNSET_ITEMS} sub="선셋 에어로빅" />
          </div>
          <div style={{ position: 'absolute', left: 316, right: 240, bottom: 48, display: 'flex', justifyContent: 'center' }}>
            <SummaryBar
              thumb={ROUTINE_THUMB}
              caption="오늘의 운동"
              title="선셋 에어로빅"
              chip={<span className="chip chip-easy">{isClosed ? '마감' : '오픈 중'}</span>}
              stats={[
                { label: '운영 시간', value: sunsetHourLabel(schedule) },
                { label: '현재 참가자', value: `${room.participants.length}명` },
              ]}
              note={isProvisionalSchedule(schedule) && <ProvisionalBadge>운영 시각 임시</ProvisionalBadge>}
              action={
                <button className="btn btn-brown" style={{ minWidth: 168, height: 56, fontSize: 20, justifyContent: 'space-between' }} disabled={isClosed} onClick={() => setPhase('camera')}>
                  {isClosed ? '운영 끝' : <>시작하기<span aria-hidden>&gt;</span></>}
                </button>
              }
            />
          </div>
        </>
      )}

      {phase === 'play' && (
        <>
          {/* 선셋은 동작이 하나뿐이고 위쪽에 방 전환 탭이 있어서 진행 바 없이 코치 말풍선만 둔다 */}
          <MyCameraPanel
            stream={camera.stream}
            isCameraOn={camera.isOn}
            overlay={<canvas ref={poseCanvasRef} className="pose-overlay" aria-hidden />}
            footer={<VoiceToggle voice={voice} />}
          />
          <CoachBubble notes={record.postureNotes} {...counting} isRunning={workout.isRunning} onRetry={counting.retry} onSpeak={voice.speak} />
          <WorkoutHud
            exerciseId={SUNSET_EXERCISE.exerciseId}
            name={SUNSET_EXERCISE.name}
            meta={`경과 ${clockLabel(workout.elapsedMs(now))}${isClosed ? ' · 운영은 끝났지만 지금 운동은 마칠 수 있어요' : ''}`}
            ring={{ value: record.validReps, unit: '회' }}
            friendsTitle={<span className="row between">현재 참가자{isPartial && <span className="t-xs" style={{ color: '#d6e4ff' }}>일부만 표시중</span>}</span>}
            friends={
              <FriendStrip
                participants={room.participants}
                selfId={profile.userId}
                maxShown={SUNSET_SHOWN - 1}
                onCheer={handleCheer}
                emptyText="지금은 나 혼자 있어요. 다른 참가자가 들어오면 바로 보여요."
              />
            }
            controls={<>
              {workout.isRunning
                ? <button className="btn btn-dark btn-sm" onClick={workout.pause}>일시정지</button>
                : <button className="btn btn-dark btn-sm" disabled={!camera.isOn} onClick={workout.start}>다시 시작</button>}
            </>}
            devTools={import.meta.env.DEV && <button className="btn btn-sm btn-secondary" onClick={() => workout.countValidRep()}>[개발용] 유효 +1회</button>}
            // 선셋은 동작 하나를 자유롭게 하므로 다음 단계 대신 마치기만 둔다
            action={<button className="btn btn-brown hud-action" disabled={isSaving} onClick={() => setIsEndConfirmOpen(true)}>운동 마치기<span aria-hidden>&gt;</span></button>}
            subAction={<span className="hud-sub" style={{ textDecoration: 'none' }}>기록은 마칠 때 저장돼요</span>}
          />
        </>
      )}

      {isCameraBroken && !isEndConfirmOpen && (
        <CameraLostDialog message={CAMERA_MESSAGE[camera.state]} onEnd={() => setIsEndConfirmOpen(true)} onRetry={() => camera.start(camera.deviceId || undefined)} />
      )}

      {isEndConfirmOpen && (
        <EndConfirmDialog
          desc="지금까지 측정된 결과가 저장돼요. 공개 운동방 결과는 다음 회차 추천에는 반영되지 않아요."
          hasSaveError={hasSaveError}
          isSaving={isSaving}
          onCancel={() => setIsEndConfirmOpen(false)}
          onConfirm={finish}
        />
      )}

      {blocker.state === 'blocked' && <LeaveDialog onStay={() => blocker.reset()} onLeave={() => blocker.proceed()} />}

      {(room.cheerToast || toast.message) && <div className="toast" role="status">{room.cheerToast ?? toast.message}</div>}
    </Scene>
  )
}
