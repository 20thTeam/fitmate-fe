// 학교 대항 스쿼트 20초 챌린지 (/univ-contest). manyfast 기획에 없는 시연 당일 이벤트 화면이라 기능 ID가 없다.
// 노트북 4대(1인 1대)가 서버의 같은 판에 들어와, 누가 시작을 누르면 서버 시각 기준으로 동시에 20초 스쿼트를 한다.
// 횟수는 기존 운동 판정(PL-OEFFCN 임시 기준)으로 세고, 자세가 한 번도 인식되지 않으면 '측정 안 됨'으로 내서 합계에 넣지 않는다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { services } from '../services'
import { useApp } from '../store/app'
import { CONTEST_RULES, CONTEST_SCHOOLS } from '../config/contest'
import { contestStatusAt, rankContestPlayers } from '../lib/contest'
import { createRepCounter, type CounterEvent, type PoseInput } from '../lib/pose/repCounter'
import { useCamera, CAMERA_MESSAGE } from '../hooks/useCamera'
import { usePose } from '../hooks/usePose'
import { useNow } from '../hooks/useNow'
import type { ContestGame, ContestStandings } from '../types/domain'
import Backdrop from '../components/Backdrop'
import PoseStatus from '../components/room/PoseStatus'
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

  const join = async () => {
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

  return (
    <Backdrop theme="public" isDim>
      <Logo isLight />
      <div className="backdrop-body" style={{ alignItems: 'center', gap: 24, paddingTop: 72 }}>
        <header className="col center" style={{ gap: 8 }}>
          <h1 className="t-display">학교 대항 스쿼트 20초 챌린지</h1>
          <div className="row center wrap" style={{ gap: 8 }}>
            <span className="chip chip-ghost">한 판 최대 {CONTEST_RULES.maxPlayers}명 · 20초 동안 많이 한 사람이 1등</span>
            {storage === 'device' && <span className="chip chip-provisional">서버 준비 중 · 이 브라우저에만 저장돼요</span>}
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
                      >
                        {s.name}
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

        {view === 'lobby' && game && (
          <section className="card col" style={{ width: 'min(960px, 100%)', gap: 20 }} aria-label="참가자 대기">
            <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
              <div className="col" style={{ flex: 1, gap: 12 }}>
                <h2 className="t-h2">참가자 {game.players.length}/{game.maxPlayers}</h2>
                <ul className="col" style={{ gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
                  {game.players.map((p) => (
                    <li key={p.playerId} className="row" style={{ justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.12)' }}>
                      <strong>{p.nickname}{p.playerId === playerId && ' (나)'}</strong>
                      <span className="t-soft">{schoolName(p.schoolId)}</span>
                    </li>
                  ))}
                </ul>
                <p className="t-soft" style={{ lineHeight: 1.5 }}>
                  모두 카메라에 온몸이 보이게 선 뒤, 아무나 시작을 누르세요. {CONTEST_RULES.countdownMs / 1000}초 뒤 모든 노트북에서 동시에 시작해요.
                </p>
              </div>
              <CameraPanel camera={camera} pose={pose} isSupported={!!counter} setupHint={counter?.setupHint ?? ''} canvasRef={poseCanvasRef} />
            </div>
            {actionError && <p className="t-danger" role="alert">{actionError}</p>}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={leave}>나가기</button>
              <button className="btn btn-primary btn-lg" disabled={isBusy} onClick={start}>{isBusy ? '시작하는 중…' : '시작'}</button>
            </div>
          </section>
        )}

        {view === 'play' && game && (
          <section className="card col center" style={{ width: 'min(960px, 100%)', gap: 16 }} aria-label="운동 중">
            <PlayHeader status={status} hasSubmitted={hasSubmitted} game={game} serverNow={serverNow} reps={reps} />
            <CameraPanel camera={camera} pose={pose} isSupported={!!counter} setupHint={counter?.setupHint ?? ''} canvasRef={poseCanvasRef} isLarge />
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
  isLarge?: boolean
}

function CameraPanel({ camera, pose, isSupported, setupHint, canvasRef, isLarge = false }: CameraPanelProps) {
  const size = isLarge ? { width: 640, height: 400 } : { width: 400, height: 300 }
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

function PlayHeader({ status, hasSubmitted, game, serverNow, reps }: { status: string; hasSubmitted: boolean; game: ContestGame; serverNow: number; reps: number }) {
  const startAt = game.startAt ?? serverNow
  if (status === 'COUNTDOWN') {
    return (
      <div className="col center" style={{ gap: 4 }} role="status">
        <span className="t-h3">곧 시작해요</span>
        <span style={{ fontSize: 96, fontWeight: 800, lineHeight: 1 }}>{Math.max(1, Math.ceil((startAt - serverNow) / 1000))}</span>
      </div>
    )
  }
  const leftMs = Math.max(0, startAt + game.durationMs - serverNow)
  if (leftMs > 0 && !hasSubmitted) {
    return (
      <div className="row center" style={{ gap: 48 }}>
        <div className="col center" style={{ gap: 0 }}>
          <span className="t-soft">남은 시간</span>
          <span style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }}>{Math.ceil(leftMs / 1000)}</span>
        </div>
        <div className="col center" style={{ gap: 0 }}>
          <span className="t-soft">내 스쿼트</span>
          <span style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }} aria-live="polite">{reps}</span>
        </div>
      </div>
    )
  }
  const waiting = game.players.filter((p) => !p.hasSubmitted).length
  return (
    <div className="col center" style={{ gap: 6 }} role="status">
      <h2 className="t-h2">끝! 내 기록 {reps}회</h2>
      <p className="t-soft">{hasSubmitted ? (waiting > 0 ? `다른 참가자 ${waiting}명의 결과를 기다리는 중…` : '순위를 계산하는 중…') : '결과를 보내는 중…'}</p>
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
