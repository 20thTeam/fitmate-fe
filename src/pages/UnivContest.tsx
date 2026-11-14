// 학교 대항 스쿼트 20초 챌린지 (/univ-contest). manyfast 기획에 없는 시연 당일 이벤트 화면이라 기능 ID가 없다.
// 노트북 4대(1인 1대)가 서버의 같은 판에 들어와, 누가 시작을 누르면 서버 시각 기준으로 동시에 20초 스쿼트를 한다.
// 횟수는 기존 운동 판정(PL-OEFFCN 임시 기준)으로 세고, 자세가 한 번도 인식되지 않으면 '측정 안 됨'으로 내서 합계에 넣지 않는다.
// 대기·운동 중에는 친구 운동방과 같은 3D 무대에 판 참가자를 캐릭터로 세운다. 카메라 영상은 보내지 않고 관절 좌표만 주고받는다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { services } from '../services'
import { useApp } from '../store/app'
import { CONTEST_RULES, CONTEST_SCHOOLS, schoolLogo } from '../config/contest'
import { contestStatusAt, rankContestPlayers } from '../lib/contest'
import { createRepCounter, type CounterEvent, type PoseInput } from '../lib/pose/repCounter'
import { useCamera, CAMERA_MESSAGE } from '../hooks/useCamera'
import { usePose } from '../hooks/usePose'
import { useNow } from '../hooks/useNow'
import { useRoom } from '../hooks/useRoom'
import { CHARACTERS } from '../config/characters'
import type { ContestGame, ContestStandings, Participant, ParticipantStatus, Profile } from '../types/domain'
import Backdrop from '../components/Backdrop'
import PoseStatus from '../components/room/PoseStatus'
import Scene from '../components/room/Scene'
import ParticipantPanel from '../components/room/ParticipantPanel'
import { CameraPreview, Logo } from '../components/ui'

type Phase = 'board' | 'join' | 'game'

type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; data: T }

const schoolName = (id: string) => CONTEST_SCHOOLS.find((s) => s.schoolId === id)?.name ?? id
const errorText = (e: unknown) => (e instanceof Error ? e.message : '알 수 없는 오류가 났어요')
const NICKNAME_MAX = 10
/** 현황 화면은 스크린에 띄워 둘 수 있게 주기적으로 새로 받는다 */
const BOARD_REFRESH_MS = 5000
/** 결과 제출이 실패하면 이 간격으로 다시 보낸다 */
const SUBMIT_RETRY_MS = 1500
type Hurry = 'none' | 'hurry' | 'final'
const HURRY_COLOR: Record<Hurry, string> = { none: '#5a4757', hurry: '#e8833a', final: '#e5484d' }

/** 짧은 알림음. 브라우저는 클릭한 뒤에 만든 소리만 내게 해서 참가·시작 버튼을 누를 때 AudioContext를 연다 */
function playBeep(ctx: AudioContext | null, freq: number, durationSec: number) {
  if (!ctx || ctx.state !== 'running') return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const t = ctx.currentTime
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + durationSec + 0.02)
}

/** 판에 들어온 순서대로 캐릭터를 나눠 준다. 모든 노트북이 같은 판 순서를 보므로 같은 사람은 어디서나 같은 캐릭터다 */
const characterIdAt = (index: number) => CHARACTERS[index % CHARACTERS.length].id

export default function UnivContest() {
  const profile = useApp((s) => s.profile)
  const [phase, setPhase] = useState<Phase>('board')
  const [standings, setStandings] = useState<Load<ContestStandings>>({ state: 'loading' })
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [schoolId, setSchoolId] = useState('')
  const [game, setGame] = useState<ContestGame | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [actionError, setActionError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [reps, setReps] = useState(0)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  /** 서버 시각 - 브라우저 시각. 노트북마다 시계가 달라도 같은 순간에 시작하게 한다 */
  const [clockOffset, setClockOffset] = useState(0)

  const receiveGame = useCallback((g: ContestGame) => {
    setClockOffset(g.serverNow - Date.now())
    setGame(g)
  }, [])

  // ── 판 상태 (서버 시각 기준으로 화면에서 계산해 폴링을 기다리지 않고 넘어간다) ──
  const now = useNow(phase === 'game', 200)
  const serverNow = now + clockOffset
  const status = game ? (game.status === 'FINISHED' ? 'FINISHED' : contestStatusAt(game, serverNow)) : 'WAITING'
  const view = phase !== 'game' || !game ? phase : status === 'FINISHED' ? 'result' : status === 'WAITING' ? 'lobby' : 'play'
  const endAt = game?.startAt != null ? game.startAt + game.durationMs : null
  const isTimeUp = endAt !== null && serverNow >= endAt

  // ── 현황 ──
  const loadStandings = useCallback(() => {
    services.contest.getStandings().then(
      (data) => setStandings({ state: 'ok', data }),
      // 이미 보여주던 현황이 있으면 한 번 실패로 지우지 않는다
      (e: unknown) => setStandings((prev) => (prev.state === 'ok' ? prev : { state: 'error', message: errorText(e) })),
    )
  }, [])

  const isStandingsShown = view === 'board' || view === 'result'
  useEffect(() => {
    if (!isStandingsShown) return
    loadStandings()
    const t = setInterval(loadStandings, BOARD_REFRESH_MS)
    return () => clearInterval(t)
  }, [isStandingsShown, loadStandings])

  // ── 카메라 · 자세 인식 ──
  const camera = useCamera()
  const poseCanvasRef = useRef<HTMLCanvasElement>(null)
  const counter = useMemo(() => createRepCounter(CONTEST_RULES.exerciseId), [])
  /** 운동 시간 안에서만 센다. 매 프레임 읽으므로 상태가 아닌 ref */
  const isCountingRef = useRef(false)
  /** 운동 시간 안에 자세가 한 번이라도 잡혔는지. 아니면 '측정 안 됨'으로 낸다 */
  const isMeasuredRef = useRef(false)

  const emit = useCallback((e: CounterEvent) => {
    if (e.kind === 'rep' && isCountingRef.current) setReps((n) => n + 1)
  }, [])
  const onFrame = useCallback((input: PoseInput) => {
    const isOk = counter ? counter.update(input, emit) : false
    if (isOk && isCountingRef.current) isMeasuredRef.current = true
    return isOk
  }, [counter, emit])
  const isCameraNeeded = view === 'join' || view === 'lobby' || view === 'play'
  const pose = usePose({ stream: camera.stream, shouldLoad: isCameraNeeded, isActive: isCameraNeeded && camera.isOn, onFrame, canvasRef: poseCanvasRef })

  const { state: cameraState, start: startCamera, stop: stopCamera } = camera
  useEffect(() => {
    if (isCameraNeeded && cameraState === 'off') startCamera()
    if (!isCameraNeeded && cameraState !== 'off') stopCamera()
  }, [isCameraNeeded, cameraState, startCamera, stopCamera])

  // 대기·진행 중에는 다른 노트북의 입장·시작·결과를 받아 온다
  const gameId = game?.gameId
  const isPolling = view === 'lobby' || view === 'play'
  useEffect(() => {
    if (!gameId || !isPolling) return
    const t = setInterval(() => {
      services.contest.getGame(gameId).then(receiveGame).catch(() => {})
    }, CONTEST_RULES.pollMs)
    return () => clearInterval(t)
  }, [gameId, isPolling, receiveGame])

  useEffect(() => {
    const isRunning = view === 'play' && status === 'RUNNING' && !isTimeUp && !hasSubmitted
    // 운동이 시작되는 순간 대기 중에 하던 동작은 버린다
    if (isRunning && !isCountingRef.current) counter?.reset()
    isCountingRef.current = isRunning
  }, [view, status, isTimeUp, hasSubmitted, counter])

  // 20초가 지나면 내 결과를 낸다. 실패하면 다음 화면 갱신 때 다시 보낸다
  const submitTriedAt = useRef(0)
  useEffect(() => {
    if (view !== 'play' || !gameId || hasSubmitted || !isTimeUp) return
    if (Date.now() - submitTriedAt.current < SUBMIT_RETRY_MS) return
    submitTriedAt.current = Date.now()
    isCountingRef.current = false
    services.contest
      .submitResult(gameId, playerId, isMeasuredRef.current ? reps : null)
      .then((g) => {
        setHasSubmitted(true)
        receiveGame(g)
      })
      .catch(() => {})
  }, [view, gameId, hasSubmitted, isTimeUp, now, playerId, reps, receiveGame])

  // 시작 전에 화면을 떠나면 자리를 비운다
  const lobbyRef = useRef<{ gameId: string; playerId: string } | null>(null)
  useEffect(() => {
    lobbyRef.current = view === 'lobby' && gameId ? { gameId, playerId } : null
  }, [view, gameId, playerId])
  useEffect(() => () => {
    const l = lobbyRef.current
    if (l) services.contest.leaveGame(l.gameId, l.playerId).catch(() => {})
  }, [])

  // ── 3D 무대: 판 참가자끼리 관절 좌표·횟수를 주고받는다 ──
  const isStageView = (view === 'lobby' || view === 'play') && !!game
  // 서버 저장이면 아직 판 실시간 경로가 없어 null (내 캐릭터만 내 자세로 움직인다)
  const live = isStageView ? services.contest.liveRealtime() : null
  const me = useMemo<Profile>(() => ({ userId: playerId, nickname: nickname.trim(), characterId: characterIdAt(0) }), [playerId, nickname])
  const room = useRoom(live && gameId ? `contest-${gameId}` : null, me, { maxParticipants: CONTEST_RULES.maxPlayers, initial: { status: 'waiting' } }, live ?? services.realtime)
  const isRunningNow = view === 'play' && status === 'RUNNING' && !isTimeUp && !hasSubmitted
  // ── 남은 10초·5초 긴박감 (화면 색·깜빡임·알림음) ──
  const leftSec = isRunningNow && endAt !== null ? Math.ceil((endAt - serverNow) / 1000) : null
  const hurry: Hurry = leftSec === null ? 'none' : leftSec <= CONTEST_RULES.finalSeconds ? 'final' : leftSec <= CONTEST_RULES.hurrySeconds ? 'hurry' : 'none'
  const audioRef = useRef<AudioContext | null>(null)
  const unlockAudio = () => {
    try {
      audioRef.current ??= new AudioContext()
      void audioRef.current.resume()
    } catch {
      // 소리를 못 내도 화면 연출은 그대로 둔다
    }
  }
  useEffect(() => {
    // 10초 남았을 때 한 번, 마지막 5초는 매초
    if (leftSec === CONTEST_RULES.hurrySeconds) playBeep(audioRef.current, 660, 0.15)
    else if (leftSec !== null && leftSec <= CONTEST_RULES.finalSeconds) playBeep(audioRef.current, 880, 0.12)
  }, [leftSec])
  const isEnded = view === 'play' && isTimeUp
  useEffect(() => {
    if (isEnded) playBeep(audioRef.current, 1046, 0.6)
  }, [isEnded])
  const myStatus: ParticipantStatus = isRunningNow ? 'exercising' : view === 'play' && status === 'RUNNING' ? 'done' : 'waiting'
  const { updateSelf, state: roomState } = room
  useEffect(() => {
    if (roomState === 'joined') updateSelf({ status: myStatus, validReps: reps })
  }, [roomState, myStatus, reps, updateSelf])

  const join = async () => {
    unlockAudio()
    setIsBusy(true)
    setActionError('')
    try {
      const r = await services.contest.joinGame({ nickname: nickname.trim(), schoolId })
      setPlayerId(r.playerId)
      setReps(0)
      setHasSubmitted(false)
      isMeasuredRef.current = false
      submitTriedAt.current = 0
      receiveGame(r.game)
      setPhase('game')
    } catch (e) {
      setActionError(`판에 들어가지 못했어요. ${errorText(e)}`)
    } finally {
      setIsBusy(false)
    }
  }

  const start = async () => {
    unlockAudio()
    if (!game) return
    setIsBusy(true)
    setActionError('')
    try {
      receiveGame(await services.contest.startGame(game.gameId, playerId))
    } catch (e) {
      setActionError(`시작하지 못했어요. ${errorText(e)}`)
    } finally {
      setIsBusy(false)
    }
  }

  const backToBoard = () => {
    setGame(null)
    setActionError('')
    setPhase('board')
  }

  const leave = async () => {
    if (game) await services.contest.leaveGame(game.gameId, playerId).catch(() => {})
    backToBoard()
  }

  const storage = services.contest.storage()

  if (isStageView && game) {
    const stage = stagePeople(game, status, playerId, room.participants, !!live, { status: myStatus, reps }, now)
    const linkNote = !live
      ? '다른 참가자 캐릭터 동작은 서버 연결 준비 중이에요. 내 캐릭터만 내 자세로 움직여요.'
      : room.state === 'full' || room.state === 'network' ? '캐릭터 동작을 주고받지 못했어요. 횟수 집계는 그대로 돼요.' : ''
    return (
      <Scene
        theme="public"
        view={view === 'play' ? 'front' : 'tour'}
        screen={<StageScreen view={view} status={status} game={game} serverNow={serverNow} hasSubmitted={hasSubmitted} reps={reps} hurry={hurry} />}
        participants={stage.figures}
        selfId={playerId}
        maxShown={CONTEST_RULES.maxPlayers}
      >
        {hurry !== 'none' && <div className={`contest-vignette is-${hurry}`} aria-hidden />}
        <Logo isLight />
        <div className="row center wrap" style={{ position: 'absolute', left: 0, right: 0, top: 28, gap: 8, pointerEvents: 'none' }}>
          <span className="chip chip-ghost">학교 대항 스쿼트 20초 챌린지</span>
          {storage === 'device' && <span className="chip chip-provisional">서버 연결 안 됨 · 이 컴퓨터에만 저장돼서 다른 컴퓨터와 같은 판에 못 들어가요</span>}
        </div>

        <div className="col" style={{ position: 'absolute', right: 28, top: 90, width: 280, gap: 10 }}>
          <ParticipantPanel
            title={<strong>참가자 {game.players.length}/{game.maxPlayers}</strong>}
            participants={stage.panel}
            selfId={playerId}
            maxShown={CONTEST_RULES.maxPlayers}
          />
          {linkNote && (
            <div className="glass col" style={{ gap: 8, padding: 12 }} role="status">
              <span className="t-xs" style={{ lineHeight: 1.5 }}>{linkNote}</span>
              {live && <button className="btn btn-dark btn-sm" onClick={room.retry}>다시 연결</button>}
            </div>
          )}
          {import.meta.env.DEV && live && (
            <p className="t-xs" style={{ color: '#fff' }}>[개발용] 다른 탭에서 /univ-contest로 같은 판에 들어오면 캐릭터가 보여요</p>
          )}
        </div>

        <div className="glass col" style={{ position: 'absolute', left: 28, bottom: 28, gap: 8, padding: 12 }}>
          <CameraPanel camera={camera} pose={pose} isSupported={!!counter} setupHint={counter?.setupHint ?? ''} canvasRef={poseCanvasRef} size="sm" />
        </div>

        <div className="col center" style={{ position: 'absolute', left: 360, right: 330, bottom: 28, gap: 10 }}>
          {view === 'lobby' ? (
            <>
              {actionError && <p className="glass t-small" role="alert" style={{ padding: '8px 14px' }}>{actionError}</p>}
              <div className="row center" style={{ gap: 12 }}>
                <button className="btn btn-secondary" onClick={leave}>나가기</button>
                <button className="btn btn-plum btn-lg" style={{ minWidth: 200 }} disabled={isBusy} onClick={start}>{isBusy ? '시작하는 중…' : '시작'}</button>
              </div>
            </>
          ) : (
            <div className="glass col center" style={{ gap: 0, padding: '12px 32px', outline: hurry === 'none' ? undefined : `3px solid ${HURRY_COLOR[hurry]}` }}>
              <span className="t-small">내 스쿼트</span>
              <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1 }} aria-live="polite">{reps}</span>
            </div>
          )}
        </div>
      </Scene>
    )
  }

  return (
    <Backdrop theme="public" isDim>
      <Logo isLight />
      <div className="backdrop-body is-center" style={{ gap: 24 }}>
        <header className="col center" style={{ gap: 8 }}>
          <h1 className="t-display">학교 대항 스쿼트 20초 챌린지</h1>
          <div className="row center wrap" style={{ gap: 8 }}>
            <span className="chip chip-ghost">한 판 최대 {CONTEST_RULES.maxPlayers}명 · 20초 동안 많이 한 사람이 1등</span>
            {storage === 'device' && <span className="chip chip-provisional">서버 연결 안 됨 · 이 컴퓨터에만 저장돼서 다른 컴퓨터와 같은 판에 못 들어가요</span>}
          </div>
        </header>

        {view === 'board' && (
          <Board standings={standings} onRetry={loadStandings} onJoin={() => setPhase('join')} />
        )}

        {view === 'join' && (
          <section className="card col" style={{ width: 'min(960px, 100%)', gap: 20 }} aria-label="참가 준비">
            <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
              <div className="col" style={{ flex: 1, gap: 18 }}>
                <label className="col" style={{ gap: 8 }}>
                  <span className="t-h3">이름</span>
                  <input className="input" value={nickname} maxLength={NICKNAME_MAX} placeholder="순위에 보일 이름" onChange={(e) => setNickname(e.target.value)} />
                </label>
                <div className="col" style={{ gap: 8 }}>
                  <span className="t-h3">학교</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} role="radiogroup" aria-label="학교 선택">
                    {CONTEST_SCHOOLS.map((s) => (
                      <button
                        key={s.schoolId}
                        type="button"
                        role="radio"
                        aria-checked={schoolId === s.schoolId}
                        className={`btn btn-square ${schoolId === s.schoolId ? 'btn-plum' : 'btn-dark'}`}
                        onClick={() => setSchoolId(s.schoolId)}
                        style={{ gap: 10, justifyContent: 'space-between', paddingLeft: 12, paddingRight: 16 }}
                      >
                        {schoolLogo(s.schoolId) && (
                          // 어두운 버튼 위에서도 로고가 보이게 흰 바탕을 깐다
                          <img src={schoolLogo(s.schoolId)} alt="" width={28} height={28} style={{ flex: 'none', objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 2 }} />
                        )}
                        {/* 로고 파일이 없는 학교도 이름은 오른쪽에 붙인다 */}
                        <span style={{ marginLeft: 'auto', textAlign: 'right' }}>{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <CameraPanel camera={camera} pose={pose} isSupported={!!counter} setupHint={counter?.setupHint ?? ''} canvasRef={poseCanvasRef} />
            </div>
            {actionError && <p className="t-danger" role="alert">{actionError}</p>}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={backToBoard}>현황으로</button>
              <button className="btn btn-primary btn-lg" disabled={isBusy || !nickname.trim() || !schoolId} onClick={join}>
                {isBusy ? '들어가는 중…' : '판에 들어가기'}
              </button>
            </div>
          </section>
        )}

        {view === 'result' && game && (
          <GameResult game={game} playerId={playerId} standings={standings} onNext={() => { setGame(null); setPhase('join') }} onBoard={backToBoard} />
        )}
      </div>
    </Backdrop>
  )
}

// ── 화면 조각 ──

function Board({ standings, onRetry, onJoin }: { standings: Load<ContestStandings>; onRetry: () => void; onJoin: () => void }) {
  return (
    <section className="col center" style={{ width: 'min(960px, 100%)', gap: 20 }} aria-label="현재 순위">
      {standings.state === 'loading' && <div className="card" role="status" style={{ width: '100%', textAlign: 'center' }}>현황을 불러오는 중…</div>}
      {standings.state === 'error' && (
        <div className="card col center" role="alert" style={{ width: '100%' }}>
          <p>현황을 불러오지 못했어요. {standings.message}</p>
          <button className="btn btn-dark btn-sm" onClick={onRetry}>다시 시도</button>
        </div>
      )}
      {standings.state === 'ok' && <StandingsView standings={standings.data} />}
      <button className="btn btn-plum btn-xl" onClick={onJoin}>
        <span style={{ flex: 1, textAlign: 'center' }}>챌린지 참가하기</span>
        <span aria-hidden>&gt;</span>
      </button>
    </section>
  )
}

function StandingsView({ standings }: { standings: ContestStandings }) {
  if (standings.gameCount === 0) {
    return (
      <div className="card col center" style={{ width: '100%', gap: 8 }}>
        <h2 className="t-h2">아직 끝난 판이 없어요</h2>
        <p className="t-soft">첫 판을 시작해 우리 학교 기록을 남겨 보세요.</p>
      </div>
    )
  }
  const max = Math.max(...standings.schools.map((s) => s.totalReps), 1)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 20, width: '100%' }}>
      <div className="card col" style={{ gap: 14 }}>
        <h2 className="t-h2">학교별 누적 스쿼트</h2>
        <ol className="col" style={{ gap: 12, listStyle: 'none', padding: 0, margin: 0 }}>
          {standings.schools.map((s, i) => (
            <li key={s.schoolId} className="col" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{i + 1}. {schoolName(s.schoolId)}</strong>
                <span><strong style={{ fontSize: 22 }}>{s.totalReps}</strong>회 <span className="t-soft t-small">· {s.entryCount}명 참가</span></span>
              </div>
              <div className="bar"><div className="bar-fill" style={{ width: `${(s.totalReps / max) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
        <p className="t-small t-soft">끝난 판 {standings.gameCount}개 기준 · 자세가 인식되지 않은 기록은 빼고 더해요</p>
      </div>
      <div className="card col" style={{ gap: 14 }}>
        <h2 className="t-h2">한 판 최고 기록</h2>
        <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }}>
          {standings.topPlayers.map((p, i) => (
            <li key={`${p.nickname}-${i}`} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{i + 1}. <strong>{p.nickname}</strong> <span className="t-soft t-small">{schoolName(p.schoolId)}</span></span>
              <strong>{p.reps}회</strong>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

interface CameraPanelProps {
  camera: ReturnType<typeof useCamera>
  pose: ReturnType<typeof usePose>
  isSupported: boolean
  setupHint: string
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  size?: 'sm' | 'md'
}

function CameraPanel({ camera, pose, isSupported, setupHint, canvasRef, size: sizeName = 'md' }: CameraPanelProps) {
  const size = sizeName === 'sm' ? { width: 300, height: 225 } : { width: 400, height: 300 }
  const isBroken = camera.state === 'denied' || camera.state === 'unavailable'
  return (
    <div className="col" style={{ gap: 8, width: size.width }}>
      <div className="camera-box is-whole" style={size}>
        {isBroken ? (
          <div className="col center" style={{ padding: 20, height: '100%' }} role="alert">
            <p className="t-small" style={{ lineHeight: 1.5 }}>{CAMERA_MESSAGE[camera.state]}</p>
            <button className="btn btn-dark btn-sm" onClick={() => camera.start()}>다시 시도</button>
          </div>
        ) : (
          <>
            <CameraPreview stream={camera.stream} emptyText={CAMERA_MESSAGE[camera.state]} />
            {camera.isOn && <canvas ref={canvasRef} className="pose-overlay" aria-hidden />}
          </>
        )}
      </div>
      {camera.isOn && (
        <PoseStatus modelState={pose.modelState} isTracking={pose.isTracking} isSupported={isSupported} setupHint={setupHint} isRunning onRetry={pose.retry} />
      )}
      {camera.isOn && pose.isTracking && <p className="t-small" style={{ color: 'var(--c-good)' }}>자세가 잘 보여요</p>}
    </div>
  )
}

/** 무대 캐릭터와 오른쪽 패널에 쓸 참가자. 판 순서(=캐릭터)는 서버 판 기준이고, 상태·횟수는 실시간으로 받은 값을 쓴다 */
function stagePeople(game: ContestGame, gameStatus: string, playerId: string, liveList: Participant[], hasLink: boolean, mine: { status: ParticipantStatus; reps: number }, now: number) {
  const isRunning = gameStatus === 'RUNNING'
  const figures: Participant[] = game.players.map((p, i) => {
    const isSelf = p.playerId === playerId
    const live = liveList.find((l) => l.userId === p.playerId)
    return {
      userId: p.playerId,
      nickname: p.nickname,
      characterId: characterIdAt(i),
      // 실시간 연결이 없으면 판 상태만 반영한다 (운동 중이면 통통 튀고, 자세는 따라 하지 않는다)
      status: isSelf ? mine.status : live?.status ?? (isRunning ? 'exercising' : 'waiting'),
      validReps: isSelf ? mine.reps : live?.validReps ?? p.reps ?? undefined,
      // 연결은 있는데 이 사람만 안 보이면 '연결 불안정'으로 보이게 오래된 시각을 둔다
      lastSeenAt: isSelf || !hasLink ? now : live?.lastSeenAt ?? 0,
    }
  })
  const panel = figures.map((f) => {
    const school = game.players.find((p) => p.playerId === f.userId)?.schoolId ?? ''
    return { ...f, nickname: `${f.nickname} · ${schoolName(school)}` }
  })
  return { figures, panel }
}

const SCREEN_TEXT = HURRY_COLOR.none

/** 3D 스크린 안 내용 (640×313 px 판에 그려서 원근으로 늘린다) */
function StageScreen({ view, status, game, serverNow, hasSubmitted, reps, hurry }: { view: string; status: string; game: ContestGame; serverNow: number; hasSubmitted: boolean; reps: number; hurry: Hurry }) {
  // 캐릭터 머리와 이름표가 스크린 아래쪽을 가려서 글자는 위쪽에 모은다
  const box = { color: SCREEN_TEXT, gap: 6, width: '100%', height: '100%', padding: '26px 24px', textAlign: 'center' as const, justifyContent: 'flex-start' }
  if (view === 'lobby') {
    return (
      <div className="col center" style={box}>
        <strong style={{ fontSize: 34 }}>참가자 {game.players.length}/{game.maxPlayers}명 모였어요</strong>
        <span style={{ fontSize: 17, lineHeight: 1.5 }}>
          온몸이 카메라에 보이게 선 뒤 아무나 '시작'을 누르세요.<br />
          {CONTEST_RULES.countdownMs / 1000}초 뒤 모든 노트북에서 동시에 20초 스쿼트를 시작해요.
        </span>
      </div>
    )
  }
  const startAt = game.startAt ?? serverNow
  if (status === 'COUNTDOWN') {
    return (
      <div className="col center" style={box} role="status">
        <strong style={{ fontSize: 26 }}>곧 시작해요</strong>
        <span style={{ fontSize: 150, fontWeight: 800, lineHeight: 1 }}>{Math.max(1, Math.ceil((startAt - serverNow) / 1000))}</span>
      </div>
    )
  }
  const leftMs = Math.max(0, startAt + game.durationMs - serverNow)
  if (leftMs > 0 && !hasSubmitted) {
    const sec = Math.ceil(leftMs / 1000)
    const label = hurry === 'final' ? '마지막 스퍼트!' : hurry === 'hurry' ? '조금만 더! 끝까지 가요' : '남은 시간'
    return (
      <div className="col center" style={{ ...box, color: HURRY_COLOR[hurry] }}>
        <span style={{ fontSize: hurry === 'none' ? 22 : 28, fontWeight: 800 }}>{label}</span>
        {/* 마지막 5초는 key를 바꿔 매초 튀는 효과를 다시 시작한다 */}
        <span key={hurry === 'final' ? sec : 'n'} className={hurry === 'final' ? 'contest-tick' : undefined} style={{ fontSize: hurry === 'final' ? 170 : 150, fontWeight: 800, lineHeight: 1 }}>{sec}</span>
      </div>
    )
  }
  const waiting = game.players.filter((p) => !p.hasSubmitted).length
  return (
    <div className="col center" style={box} role="status">
      <strong style={{ fontSize: 44 }}>끝! 내 기록 {reps}회</strong>
      <span style={{ fontSize: 18 }}>{hasSubmitted ? (waiting > 0 ? `다른 참가자 ${waiting}명의 결과를 기다리는 중…` : '순위를 계산하는 중…') : '결과를 보내는 중…'}</span>
    </div>
  )
}

function GameResult({ game, playerId, standings, onNext, onBoard }: { game: ContestGame; playerId: string; standings: Load<ContestStandings>; onNext: () => void; onBoard: () => void }) {
  const ranked = rankContestPlayers(game.players)
  const unranked = game.players.filter((p) => p.reps === null)
  const winner = ranked[0]
  return (
    <section className="col center" style={{ width: 'min(960px, 100%)', gap: 20 }} aria-label="이번 판 결과">
      <div className="card col center" style={{ width: '100%', gap: 10 }}>
        {winner ? (
          <>
            <span className="t-h3">이번 판 1등</span>
            <span style={{ fontSize: 48, fontWeight: 800 }}>{winner.nickname} · {winner.reps}회</span>
            <span className="t-soft">{schoolName(winner.schoolId)}</span>
          </>
        ) : (
          <h2 className="t-h2">이번 판은 자세가 인식된 기록이 없어요</h2>
        )}
        <ol className="col" style={{ gap: 8, listStyle: 'none', padding: 0, margin: '8px 0 0', width: 520 }}>
          {ranked.map((p, i) => (
            <li key={p.playerId} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{i + 1}. <strong>{p.nickname}{p.playerId === playerId && ' (나)'}</strong> <span className="t-soft t-small">{schoolName(p.schoolId)}</span></span>
              <strong>{p.reps}회</strong>
            </li>
          ))}
          {unranked.map((p) => (
            <li key={p.playerId} className="row t-soft" style={{ justifyContent: 'space-between' }}>
              <span>- {p.nickname}{p.playerId === playerId && ' (나)'} <span className="t-small">{schoolName(p.schoolId)}</span></span>
              <span>{p.hasSubmitted ? '자세 인식 안 됨' : '결과 없음'}</span>
            </li>
          ))}
        </ol>
      </div>
      {standings.state === 'ok' && <StandingsView standings={standings.data} />}
      <div className="row center">
        <button className="btn btn-secondary" onClick={onBoard}>현황 보기</button>
        <button className="btn btn-primary btn-lg" onClick={onNext}>다음 판 참가</button>
      </div>
    </section>
  )
}
