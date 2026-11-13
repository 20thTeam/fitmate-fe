import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import { goalLabel, type FriendRoom, type Participant, type Profile, type Routine, type WorkoutSession } from '../types/domain'
import { PARTY_MAX, PROVISIONAL_REST_SECONDS, provisionalDifficulty } from '../config/provisional'
import { guideOf, ROUTINE_THUMB } from '../config/exercises'
import { amountLabel, shortAmountLabel } from '../lib/format'
import { estimateKcal, estimateMinutes } from '../lib/estimate'
import { useRoom } from '../hooks/useRoom'
import { useCamera, CAMERA_MESSAGE } from '../hooks/useCamera'
import { useWorkout } from '../hooks/useWorkout'
import { useNow } from '../hooks/useNow'
import { useToast } from '../hooks/useToast'
import { useRepCounting } from '../hooks/useRepCounting'
import Scene from '../components/room/Scene'
import ModeTabs from '../components/room/ModeTabs'
import ParticipantPanel, { OnlineCount } from '../components/room/ParticipantPanel'
import { RoutineOrderPanel, RoutineProgressPanel } from '../components/room/RoutinePanels'
import SummaryBar from '../components/room/SummaryBar'
import GuideScreen from '../components/room/GuideScreen'
import WorkoutHud from '../components/room/WorkoutHud'
import PoseStatus from '../components/room/PoseStatus'
import InviteModal from '../components/room/InviteModal'
import { CameraLostDialog, EndConfirmDialog, GuideDialog, LeaveDialog } from '../components/room/WorkoutDialogs'
import CameraCheck from '../components/CameraCheck'
import ConnectionBanner from '../components/room/ConnectionBanner'
import RoomGate, { type RoomActions } from '../components/room/RoomGate'
import EnterLoading from '../components/EnterLoading'
import { CenterMessage, Logo, ProvisionalBadge } from '../components/ui'
import { canUseWebGL } from '../lib/webgl'
import groupIcon from '../assets/icons/group.png'
import userAddIcon from '../assets/icons/user-add.png'
import checkIcon from '../assets/icons/check.png'

// 친구 운동방 · Figma '친구 운동방' → '카메라 확인' → '운동방에 입장하는 중' → '운동 진행'
// F-STRTHT, F-ERSUOK, F-WJAOCO, F-WGMOYG, F-ZGIFAX, F-XNIIJM, F-WLBEFJ, F-EUQUBE, F-JENTLD, F-HEIEZC, F-SZCKIV
// 다음 운동 전환은 사용자가 직접 누른다 (F-SZCKIV 권장안). 참가자마다 시작·종료가 독립이다 (F-WGMOYG).

type Phase = 'lobby' | 'camera' | 'entering' | 'play' | 'rest'

/** 입장 로딩 단계를 하나씩 체크해 보여주는 간격 */
const ENTER_STEP_MS = 400
/** 서버 응답이 이보다 늦으면 기다리는 중이라고 알려 준다 */
const SLOW_RESPONSE_MS = 3000

export default function PartyRoom() {
  const { routineId = '' } = useParams()
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)!
  const setLastRoutineId = useApp((s) => s.setLastRoutineId)
  const [routine, setRoutine] = useState<Routine | null | undefined>(undefined)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    services.routine
      .get(routineId)
      .then((r) => {
        setRoutine(r)
        if (r) setLastRoutineId(r.routineId)
      })
      .catch(() => setRoutine(null))
  }, [routineId, retryKey, setLastRoutineId])

  if (routine === undefined) return <EnterLoading theme="friend" steps={[{ label: '오늘의 루틴 불러오는 중', isDone: false }, { label: '친구 운동방 연결 확인', isDone: false }]} />
  if (routine === null) {
    return (
      <CenterMessage
        title="루틴을 찾을 수 없어요"
        desc="목표를 다시 선택해 추천을 받아 주세요."
        action={<>
          <button className="btn btn-secondary" onClick={() => setRetryKey((k) => k + 1)}>다시 시도</button>
          <button className="btn btn-primary" onClick={() => nav('/goal')}>목표 선택으로</button>
        </>}
      />
    )
  }
  // 방은 여러 개다. 어느 방에 들어갈지는 RoomGate가 정한다 (이슈 #40)
  return (
    <RoomGate
      profile={profile}
      render={(friendRoom, actions) => (
        <Room key={`${routine.routineId}:${friendRoom.roomId}`} routine={routine} profile={profile} friendRoom={friendRoom} roomActions={actions} />
      )}
    />
  )
}

function Room({ routine, profile, friendRoom, roomActions }: { routine: Routine; profile: Profile; friendRoom: FriendRoom; roomActions: RoomActions }) {
  const nav = useNavigate()
  const summary = routine.items.map((i) => i.name).join(' · ')
  const room = useRoom(friendRoom.roomId, profile, {
    maxParticipants: PARTY_MAX,
    initial: { goal: routine.goal, routineSummary: summary, status: 'waiting' },
  })
  const camera = useCamera()
  const workout = useWorkout(routine.items)
  const toast = useToast()

  const [phase, setPhase] = useState<Phase>('lobby')
  const [enterStartedAt, setEnterStartedAt] = useState(0)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false)
  const [restStartedAt, setRestStartedAt] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaveSlow, setIsSaveSlow] = useState(false)
  const [hasSaveError, setHasSaveError] = useState(false)
  // 운동 기록 ID. 입장할 때 받아서 끝낼 때 그 ID로 확정한다 (재접속·중복 저장 방지)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [hasStartError, setHasStartError] = useState(false)
  const now = useNow(phase === 'rest' || phase === 'entering', phase === 'entering' ? 100 : 1000)

  const { item, record } = workout
  const isLast = workout.index + 1 >= routine.items.length
  const isLastSet = item ? workout.setNo >= item.sets : true
  const isWorkingOut = phase === 'play' || phase === 'rest'

  // 카메라로 유효 횟수 세기 (F-XNIIJM). 모델은 카메라 확인 단계부터 미리 받는다
  const poseCanvasRef = useRef<HTMLCanvasElement>(null)
  const counting = useRepCounting({
    exerciseId: item?.exerciseId,
    stream: camera.stream,
    shouldLoad: phase !== 'lobby',
    isActive: phase === 'play' && workout.isRunning,
    workout,
    canvasRef: poseCanvasRef,
  })

  // 운동 중 이탈 확인 (F-SZCKIV)
  const blocker = useBlocker(({ nextLocation }) => isWorkingOut && !isSaving && !nextLocation.pathname.startsWith('/result'))

  // 내 진행 상황을 친구에게 알린다
  useEffect(() => {
    if (phase !== 'play' || !item) return
    room.updateSelf({ status: workout.isRunning ? 'exercising' : 'paused', currentExercise: item.name, validReps: workout.setProgress })
  }, [phase, item, workout.isRunning, workout.setProgress]) // eslint-disable-line react-hooks/exhaustive-deps

  // 카메라가 끊기면 카운트를 멈춘다 (F-SZCKIV exceptions)
  const isCameraBroken = isWorkingOut && camera.state !== 'on'
  useEffect(() => {
    if (isCameraBroken && workout.isRunning) workout.pause()
  }, [isCameraBroken]) // eslint-disable-line react-hooks/exhaustive-deps

  // 입장 로딩: 실제 상태가 준비되면 단계별로 체크한 뒤 운동을 시작한다
  const enterElapsed = now - enterStartedAt
  const enterSteps = [
    { label: '친구 운동방 연결 확인', isDone: room.state === 'joined' && enterElapsed > ENTER_STEP_MS },
    { label: '운동장 불러오는 중', isDone: enterElapsed > ENTER_STEP_MS * 2 },
    { label: '카메라 불러오는 중', isDone: camera.isOn && enterElapsed > ENTER_STEP_MS * 3 },
    // 모델을 못 받아도 운동은 할 수 있게 넘어간다 (운동 화면에서 다시 시도 안내)
    { label: '자세 인식 준비 중', isDone: (counting.modelState === 'ready' || counting.modelState === 'error') && enterElapsed > ENTER_STEP_MS * 4 },
    {
      label: !sessionId && enterElapsed > SLOW_RESPONSE_MS ? '운동 기록 준비 중 · 서버 응답을 기다리고 있어요' : '운동 기록 준비 중',
      isDone: !!sessionId && enterElapsed > ENTER_STEP_MS * 5,
    },
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

  // 입장에 성공한 방을 기억해서 다음에도 이 방으로 바로 들어간다 (이슈 #40)
  useEffect(() => {
    if (room.state === 'joined') services.rooms.remember(profile.userId, friendRoom.roomId).catch(() => {})
  }, [room.state, profile.userId, friendRoom.roomId])

  const startSession = () => {
    setHasStartError(false)
    services.record
      .startSession({ kind: 'party', routineId: routine.routineId, roomId: friendRoom.roomId })
      .then(setSessionId)
      .catch(() => setHasStartError(true))
  }

  const handleCameraConfirmed = () => {
    room.updateSelf({ status: 'ready' })
    setEnterStartedAt(Date.now())
    setPhase('entering')
    if (!sessionId) startSession()
  }

  const handleRetryStart = () => {
    setEnterStartedAt(Date.now())
    startSession()
  }

  const handleNext = () => {
    if (!item) return
    if (!isLastSet) return workout.nextSet()
    workout.endExercise()
    if (isLast) return finish()
    setRestStartedAt(() => Date.now())
    setPhase('rest')
    room.updateSelf({ status: 'resting', validReps: undefined })
  }

  const handleStartNextExercise = () => {
    const nextIndex = workout.index + 1
    workout.goToExercise(nextIndex)
    room.updateSelf({ currentExercise: routine.items[nextIndex].name })
    setPhase('play')
    workout.start()
  }

  const finish = async () => {
    if (!sessionId) return
    setIsSaving(true)
    setHasSaveError(false)
    const slowTimer = setTimeout(() => setIsSaveSlow(true), SLOW_RESPONSE_MS)
    const result = workout.finalize()
    const session: WorkoutSession = {
      sessionId,
      kind: 'party',
      userId: profile.userId,
      roomId: friendRoom.roomId,
      routineId: routine.routineId,
      round: routine.round,
      goal: routine.goal,
      startedAt: result.startedAt,
      endedAt: Date.now(),
      activeMs: result.activeMs,
      records: result.records,
    }
    try {
      await services.record.saveSession(session)
      room.updateSelf({ status: 'done', validReps: undefined })
      camera.stop()
      nav(`/result/${session.sessionId}`)
    } catch {
      setIsSaving(false)
      setHasSaveError(true)
      setIsEndConfirmOpen(true) // 오류 문구와 재시도 버튼이 이 창에 있다
    } finally {
      clearTimeout(slowTimer)
      setIsSaveSlow(false)
    }
  }

  const handleCheer = (p: Participant) => {
    if (room.sendCheer(p.userId)) toast.show(`${p.nickname}님에게 응원을 보냈어요 🔥`)
  }

  // ───── 입장 상태 ─────
  if (room.state === 'joining') return <EnterLoading theme="friend" steps={[{ label: '오늘의 루틴 불러오기', isDone: true }, { label: '친구 운동방 연결 확인', isDone: false }]} />
  if (room.state === 'full') {
    return (
      <CenterMessage
        title={`운동방이 가득 찼어요 (최대 ${PARTY_MAX}명)`}
        desc={`'${friendRoom.name}'에 자리가 없어요. 친구가 나간 뒤 다시 시도하거나 다른 방에 들어가 주세요.`}
        action={<>
          <button className="btn btn-secondary" onClick={() => nav('/home')}>홈으로</button>
          <button className="btn btn-secondary" onClick={roomActions.pick}>다른 방 고르기</button>
          <button className="btn btn-primary" onClick={room.retry}>다시 시도</button>
        </>}
      />
    )
  }
  if (room.state === 'network') {
    return (
      <CenterMessage
        title="운동방에 연결할 수 없어요"
        desc="네트워크를 확인한 뒤 다시 시도해 주세요."
        action={<>
          <button className="btn btn-secondary" onClick={roomActions.pick}>다른 방 고르기</button>
          <button className="btn btn-primary" onClick={room.retry}>다시 시도</button>
        </>}
      />
    )
  }
  if (!item || !record) return null

  if (phase === 'camera') return <CameraCheck camera={camera} theme="friend" onBack={() => setPhase('lobby')} onConfirm={handleCameraConfirmed} />
  if (phase === 'entering' && hasStartError) {
    return (
      <CenterMessage
        title="운동 기록을 시작하지 못했어요"
        desc="서버에 연결되지 않거나 응답이 늦어요. 잠시 뒤 다시 시도해 주세요."
        action={<>
          <button className="btn btn-secondary" onClick={() => { setHasStartError(false); setPhase('lobby') }}>대기실로</button>
          <button className="btn btn-primary" onClick={handleRetryStart}>다시 시도</button>
        </>}
      />
    )
  }
  if (phase === 'entering') return <EnterLoading theme="friend" steps={enterSteps} />

  const others = room.participants.filter((p) => p.userId !== profile.userId)
  const friendTitle = (
    <span className="panel-pill"><img src={groupIcon} alt="" width={18} height={18} />친구</span>
  )
  const friendPanel = (
    <ParticipantPanel
      title={friendTitle}
      headerRight={<OnlineCount participants={room.participants} selfId={profile.userId} />}
      participants={room.participants}
      selfId={profile.userId}
      maxShown={PARTY_MAX}
      onCheer={handleCheer}
      emptyText="아직 친구가 없어요. 혼자 시작해도 되고, 친구가 들어오면 바로 보여요."
      footer={phase === 'lobby' && (
        <>
          <button className="btn btn-dark btn-sm btn-block" style={{ justifyContent: 'space-between', marginTop: 4 }} onClick={() => setIsInviteOpen(true)}>
            <span className="row" style={{ gap: 8 }}><img src={userAddIcon} alt="" width={16} height={16} />친구 초대하기</span>
            <span aria-hidden>&gt;</span>
          </button>
          {/* 방 바꾸기·나가기 (이슈 #40). 운동 중에는 이탈 확인 흐름이 따로 있어서 대기실에서만 보여준다 */}
          <p className="t-xs" style={{ color: 'var(--c-text-dim)', marginTop: 6, wordBreak: 'break-all' }}>지금 방: {friendRoom.name}</p>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-dark btn-sm" style={{ flex: 1 }} onClick={roomActions.pick}>다른 방으로</button>
            <button className="btn btn-dark btn-sm" style={{ flex: 1 }} onClick={roomActions.leave}>방 나가기</button>
          </div>
        </>
      )}
    />
  )

  // 운동 중에는 바로 다음 운동, 휴식 중에는 곧 시작할 운동
  const next = routine.items[workout.index + 1]
  // 휴식 직후 첫 1초는 시계가 이전 값이라 상한을 둔다
  const restLeftSec = Math.min(PROVISIONAL_REST_SECONDS, Math.max(0, Math.ceil((PROVISIONAL_REST_SECONDS * 1000 - (now - restStartedAt)) / 1000)))
  const upcoming = phase === 'rest' ? routine.items[workout.index + 2] : next
  // AI 코치 시범: 운동 중에는 지금 운동, 휴식 중에는 다음 운동을 보여준다. 3D를 못 쓰면 기존 안내 카드
  const coachExerciseId = phase === 'play' ? item.exerciseId : phase === 'rest' ? next?.exerciseId : undefined
  const hasCoach = !!coachExerciseId && canUseWebGL()

  return (
    <Scene
      theme="friend"
      screen={phase === 'lobby'
        ? <GuideScreen idleTitle="친구들이 모이면 함께 시작해요" idleDesc={`지금 ${room.participants.length}명 접속 중 · 준비되면 '시작하기'를 눌러 주세요`} />
        : <GuideScreen exerciseId={phase === 'rest' ? next?.exerciseId : item.exerciseId} name={phase === 'rest' ? next?.name : item.name} hasCoach={hasCoach} />}
      participants={room.participants}
      selfId={profile.userId}
      onCheer={handleCheer}
      view={phase === 'play' || phase === 'rest' ? 'front' : 'tour'}
      coachExerciseId={hasCoach ? coachExerciseId : undefined}
    >
      <Logo />
      <ConnectionBanner state={room.connection} onReconnect={room.reconnect} />

      {phase === 'lobby' && (
        <>
          <ModeTabs active="friend" />
          <div style={{ position: 'absolute', right: 34, top: 150, width: 243 }}>{friendPanel}</div>
          <div style={{ position: 'absolute', left: 44, bottom: 48, width: 243 }}>
            <RoutineOrderPanel items={routine.items} sub={`${routine.round}회차 맞춤 루틴`} />
          </div>
          <div style={{ position: 'absolute', left: 316, right: 240, bottom: 48, display: 'flex', justifyContent: 'center' }}>
            <SummaryBar
              thumb={ROUTINE_THUMB}
              caption={`오늘의 운동 · ${routine.round}회차`}
              title={goalLabel(routine.goal)}
              chip={<span className="chip chip-easy">{provisionalDifficulty(routine.difficultyStep)}</span>}
              stats={[
                { label: '예상 시간', value: `${estimateMinutes(routine.items)}분` },
                { label: '예상 칼로리', value: `${estimateKcal(routine.items)}kcal` },
              ]}
              note={routine.isFallback
                ? <ProvisionalBadge>서버 추천 실패 · 임시 규칙 루틴 (기록은 이 기기에만 저장)</ProvisionalBadge>
                : <ProvisionalBadge />}
              action={
                <button className="btn btn-brown" style={{ minWidth: 168, height: 56, fontSize: 20, justifyContent: 'space-between' }} onClick={() => setPhase('camera')}>
                  시작하기<span aria-hidden>&gt;</span>
                </button>
              }
            />
          </div>
          {others.length === 0 && import.meta.env.DEV && (
            <p className="t-xs" style={{ position: 'absolute', right: 34, top: 120, color: '#5b4a5a' }}>[개발용] 다른 탭에서 같은 흐름으로 들어오면 친구로 보여요</p>
          )}
        </>
      )}

      {isWorkingOut && (
        <>
          <div className="col" style={{ position: 'absolute', right: 20, top: 110, bottom: 220, width: 242, gap: 14 }}>
            {friendPanel}
            <RoutineProgressPanel
              heading={goalLabel(routine.goal)}
              items={routine.items}
              activeIndex={phase === 'rest' ? workout.index + 1 : workout.index}
              guide={guideOf(phase === 'rest' && next ? next.exerciseId : item.exerciseId)}
            />
          </div>

          {phase === 'play' ? (
            <WorkoutHud
              exerciseId={item.exerciseId}
              name={item.name}
              desc={guideOf(item.exerciseId)}
              meta={`세트 ${workout.setNo} / ${item.sets} · 목표 ${amountLabel(item)}`}
              ring={{ value: workout.setProgress, max: item.targetReps ?? item.targetSeconds, unit: item.targetReps ? '회' : '초' }}
              stream={camera.stream}
              isCameraOn={camera.isOn}
              notes={record.postureNotes}
              next={next ? { exerciseId: next.exerciseId, name: next.name, amount: shortAmountLabel(next) } : null}
              cameraOverlay={<>
                <canvas ref={poseCanvasRef} className="pose-overlay" aria-hidden />
                <PoseStatus {...counting} isRunning={workout.isRunning} onRetry={counting.retry} />
              </>}
              controls={<>
                <button className="btn btn-dark btn-sm" onClick={() => setIsGuideOpen(true)}><img src={checkIcon} alt="" width={16} height={16} />자세 가이드 보기</button>
                {workout.isRunning
                  ? <button className="btn btn-dark btn-sm" onClick={workout.pause}>일시정지</button>
                  : <button className="btn btn-dark btn-sm" disabled={!camera.isOn} onClick={workout.start}>다시 시작</button>}
              </>}
              devTools={import.meta.env.DEV && (item.targetReps
                ? <button className="btn btn-sm btn-secondary" onClick={() => workout.countValidRep()}>[개발용] 유효 +1회</button>
                : <button className="btn btn-sm btn-secondary" onClick={() => workout.countValidSeconds(5)}>[개발용] 유효 +5초</button>)}
              nextAction={<>
                <button className="btn btn-brown btn-sm grow" style={{ padding: 0 }} disabled={isSaving} onClick={handleNext}>
                  {!isLastSet ? '다음 세트' : isLast ? '운동 마치기' : '다음 운동'} &gt;
                </button>
                <button className="btn btn-rose btn-sm grow" style={{ padding: 0 }} onClick={() => setIsEndConfirmOpen(true)}>운동 끝내기</button>
              </>}
            />
          ) : next && (
            <WorkoutHud
              exerciseId={next.exerciseId}
              name="잠깐 쉬어요"
              desc={`다음 운동은 ${next.name}(${amountLabel(next)})이에요. 준비되면 시작해요. 시간이 지나도 자동으로 넘어가지 않아요.`}
              meta={<span className="row" style={{ gap: 6 }}>휴식 시간 <ProvisionalBadge /></span>}
              ring={{ value: restLeftSec, max: PROVISIONAL_REST_SECONDS, unit: '초' }}
              stream={camera.stream}
              isCameraOn={camera.isOn}
              notes={record.postureNotes}
              next={upcoming ? { exerciseId: upcoming.exerciseId, name: upcoming.name, amount: shortAmountLabel(upcoming) } : null}
              controls={
                <button className="btn btn-brown btn-sm" disabled={!camera.isOn} onClick={handleStartNextExercise}>{next.name} 시작 &gt;</button>
              }
              nextAction={<button className="btn btn-rose btn-sm btn-block" onClick={() => setIsEndConfirmOpen(true)}>운동 끝내기</button>}
            />
          )}
        </>
      )}

      {isInviteOpen && <InviteModal roomId={friendRoom.roomId} onClose={() => setIsInviteOpen(false)} />}
      {isGuideOpen && <GuideDialog name={item.name} guide={guideOf(item.exerciseId)} onClose={() => setIsGuideOpen(false)} />}

      {isCameraBroken && !isEndConfirmOpen && (
        <CameraLostDialog message={CAMERA_MESSAGE[camera.state]} onEnd={() => setIsEndConfirmOpen(true)} onRetry={() => camera.start(camera.deviceId || undefined)} />
      )}

      {isEndConfirmOpen && (
        <EndConfirmDialog
          desc={isSaveSlow ? '서버 응답이 늦어지고 있어요. 저장이 끝나면 결과 화면으로 이동해요.' : '지금까지 측정된 결과가 저장되고, 결과 화면으로 이동해요.'}
          hasSaveError={hasSaveError}
          isSaving={isSaving}
          onCancel={() => setIsEndConfirmOpen(false)}
          onConfirm={finish}
        />
      )}

      {blocker.state === 'blocked' && <LeaveDialog onStay={() => blocker.reset()} onLeave={() => blocker.proceed()} />}

      {isSaving && !isEndConfirmOpen && (
        <div className="toast" role="status">{isSaveSlow ? '서버 응답이 늦어지고 있어요. 기록을 저장하는 중이니 잠시만 기다려 주세요…' : '기록을 저장하는 중…'}</div>
      )}
      {!isSaving && (room.cheerToast || toast.message) && <div className="toast" role="status">{room.cheerToast ?? toast.message}</div>}
    </Scene>
  )
}
