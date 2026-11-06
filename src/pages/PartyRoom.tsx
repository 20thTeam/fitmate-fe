import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { services, type RoomConnection } from '../services'
import { isStale } from '../services/local/realtime'
import { DEMO_ROOM_ID, useApp } from '../store/app'
import type { ExerciseRecord, Participant, Routine } from '../types/domain'
import { amountLabel } from '../lib/format'
import { characterColor } from '../config/characters'
import { useCamera } from '../hooks/useCamera'

// 파티 운동방: F-STRTHT, F-ERSUOK, F-WJAOCO, F-WGMOYG, F-ZGIFAX, F-XNIIJM, F-WLBEFJ,
// F-EUQUBE, F-JENTLD, F-HEIEZC, F-SZCKIV
//
// 다음 운동 전환은 '직접 조작' (F-SZCKIV 권장안), 휴식 시간은 미정이라 타이머 없음.

type Phase = 'joining' | 'full' | 'network' | 'ready' | 'exercising' | 'rest'

const STATUS_LABEL: Record<Participant['status'], string> = {
  waiting: '대기 중',
  exercising: '운동 중',
  resting: '휴식 중',
  done: '완료',
}

const emptyRecord = (exerciseId: string): ExerciseRecord => ({
  exerciseId,
  validReps: 0,
  validSeconds: 0,
  durationMs: 0,
  completed: false,
  postureNotes: [],
})

export default function PartyRoom() {
  const { routineId = '' } = useParams()
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)!

  const [routine, setRoutine] = useState<Routine | null>(null)
  const [phase, setPhase] = useState<Phase>('joining')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [cheerToast, setCheerToast] = useState<string | null>(null)
  const connRef = useRef<RoomConnection | null>(null)
  const participantsRef = useRef<Participant[]>([])
  participantsRef.current = participants

  // 진행 상태
  const [idx, setIdx] = useState(0)
  const [setNo, setSetNo] = useState(1)
  const [records, setRecords] = useState<ExerciseRecord[]>([])
  const startedAt = useRef(0)
  const exerciseStart = useRef(0)

  const camera = useCamera()

  // 루틴 로드 + 방 입장
  useEffect(() => {
    let conn: RoomConnection | null = null
    let alive = true
    ;(async () => {
      const r = await services.routine.get(routineId)
      if (!alive) return
      if (!r) return nav('/goal', { replace: true })
      setRoutine(r)
      setRecords(r.items.map((it) => emptyRecord(it.exerciseId)))

      const res = await services.realtime.join(DEMO_ROOM_ID, profile)
      if (!alive) return res.ok && res.conn.leave()
      if (!res.ok) return setPhase(res.reason)
      conn = res.conn
      connRef.current = conn
      conn.onParticipants(setParticipants)
      conn.onCheer((e) => {
        const from = participantsRef.current.find((p) => p.userId === e.fromUserId)
        setCheerToast(`${from?.nickname ?? '친구'}님이 응원을 보냈어요 ${e.reaction}`)
        setTimeout(() => setCheerToast(null), 2500)
      })
      setPhase('ready')
    })()
    return () => {
      alive = false
      conn?.leave()
    }
  }, [routineId, profile, nav])

  const item = routine?.items[idx]
  const rec = records[idx]

  const addValidRep = useCallback(() => {
    // 카메라 오류 중에는 카운트하지 않는다 (F-SZCKIV)
    if (camera.state !== 'on') return
    setRecords((rs) => rs.map((r, i) => (i === idx ? { ...r, validReps: r.validReps + 1 } : r)))
  }, [camera.state, idx])

  function start() {
    if (!item) return
    startedAt.current ||= Date.now()
    exerciseStart.current = Date.now()
    setPhase('exercising')
    connRef.current?.updateSelf({ status: 'exercising', currentExercise: item.name })
  }

  function closeExercise(): ExerciseRecord[] {
    const it = routine!.items[idx]
    const updated = records.map((r, i) => {
      if (i !== idx) return r
      const dur = r.durationMs + (Date.now() - exerciseStart.current)
      const done = it.targetReps
        ? r.validReps >= it.targetReps * it.sets
        : r.validSeconds >= (it.targetSeconds ?? 0) * it.sets
      return { ...r, durationMs: dur, completed: done }
    })
    setRecords(updated)
    return updated
  }

  function next() {
    if (!routine || !item) return
    if (setNo < item.sets) {
      setSetNo((n) => n + 1)
      return
    }
    closeExercise()
    if (idx + 1 < routine.items.length) {
      setPhase('rest')
      connRef.current?.updateSelf({ status: 'resting' })
    } else {
      finish()
    }
  }

  function goNextExercise() {
    setIdx((i) => i + 1)
    setSetNo(1)
    setPhase('ready')
    connRef.current?.updateSelf({ status: 'waiting', currentExercise: routine!.items[idx + 1].name })
  }

  async function finish() {
    const finalRecords = phase === 'exercising' ? closeExercise() : records
    const session = {
      sessionId: crypto.randomUUID(),
      userId: profile.userId,
      roomId: DEMO_ROOM_ID,
      routineId: routine!.routineId,
      round: routine!.round,
      goal: routine!.goal,
      startedAt: startedAt.current || Date.now(),
      endedAt: Date.now(),
      records: finalRecords,
    }
    await services.record.saveSession(session)
    connRef.current?.updateSelf({ status: 'done' })
    camera.stop()
    nav(`/result/${session.sessionId}`)
  }

  function cheer(p: Participant) {
    connRef.current?.sendCheer(p.userId, '🔥')
  }

  // ───── 화면 ─────
  if (phase === 'joining') return <main className="page page-center">운동방에 연결하는 중…</main>
  if (phase === 'full' || phase === 'network') {
    return (
      <main className="page page-center">
        <h2 className="title">{phase === 'full' ? '운동방이 가득 찼어요 (최대 5명)' : '운동방에 연결할 수 없어요'}</h2>
        <button className="btn btn-primary" onClick={() => location.reload()}>다시 시도</button>
      </main>
    )
  }
  if (!routine || !item || !rec) return null

  const target = item.targetReps ? `${item.targetReps}회` : `${item.targetSeconds}초`
  const progress = item.targetReps ? `${rec.validReps}회` : `${rec.validSeconds}초`

  return (
    <main className="page" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
      {/* 왼쪽: 3D 공간 + 참가자 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ flex: 1, minHeight: 480, display: 'grid', placeItems: 'center', position: 'relative' }}>
          {/* TODO: <Stage3D /> — 본인·친구 캐릭터 + AI 가이드 */}
          <span className="muted">3D 운동 공간 (구현 예정)</span>
          <video
            ref={camera.videoRef}
            muted
            playsInline
            style={{ position: 'absolute', right: 16, bottom: 16, width: 200, borderRadius: 12, transform: 'scaleX(-1)', display: camera.state === 'on' ? 'block' : 'none' }}
          />
        </div>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          {participants.map((p) => {
            const me = p.userId === profile.userId
            const stale = !me && isStale(p)
            return (
              <button
                key={p.userId}
                className="card row"
                style={{ padding: 12, gap: 12, cursor: me ? 'default' : 'pointer' }}
                onClick={() => !me && cheer(p)}
                title={me ? '나' : '클릭해서 응원 보내기'}
                disabled={stale}
              >
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: characterColor(p.characterId) }} />
                <span style={{ textAlign: 'left' }}>
                  <strong>{p.nickname}{me && ' (나)'}</strong>
                  <br />
                  <small className="muted">
                    {p.currentExercise ?? '-'} · {stale ? '연결 불안정' : STATUS_LABEL[p.status]}
                  </small>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 오른쪽: 내 운동 패널 */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <small className="muted">현재 운동 {idx + 1}/{routine.items.length}</small>
          <h2 style={{ margin: '4px 0 12px', fontSize: 32 }}>{item.name}</h2>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><small className="muted">세트</small><div style={{ fontSize: 24 }}>{setNo} / {item.sets}</div></div>
            <div><small className="muted">유효 횟수</small><div style={{ fontSize: 24 }}>{progress}</div></div>
            <div><small className="muted">목표</small><div style={{ fontSize: 24 }}>{amountLabel(item)}</div></div>
          </div>
        </div>

        <div className="card">
          <strong>자세 피드백</strong>
          {/* 측정된 피드백만 표시 (F-WLBEFJ) */}
          <p className="muted">{rec.postureNotes.at(-1) ?? '동작을 인식하면 여기에 안내가 표시돼요.'}</p>
        </div>

        <div className="card">
          <strong>카메라</strong>
          <p className="muted" style={{ margin: '8px 0' }}>
            {camera.state === 'on' && '🎥 정상'}
            {camera.state === 'off' && '꺼져 있어요'}
            {camera.state === 'requesting' && '권한 요청 중…'}
            {camera.state === 'denied' && '권한이 거부됐어요. 주소창 왼쪽 자물쇠에서 카메라를 허용해 주세요.'}
            {camera.state === 'unavailable' && '사용 가능한 카메라가 없어요.'}
          </p>
          {camera.state !== 'on' && (
            <button className="btn" onClick={camera.start}>카메라 {camera.state === 'off' ? '켜기' : '다시 시도'}</button>
          )}
        </div>

        {phase === 'ready' && (
          <button className="btn btn-primary btn-lg" disabled={camera.state !== 'on'} onClick={start}>
            {item.name} 시작
          </button>
        )}
        {phase === 'exercising' && (
          <>
            <button className="btn btn-primary btn-lg" onClick={next}>
              {setNo < item.sets ? '다음 세트' : idx + 1 < routine.items.length ? '다음 운동으로' : '운동 마치기'}
            </button>
            {import.meta.env.DEV && (
              <button className="btn" onClick={addValidRep}>[개발용] 유효 +1 (목표 {target})</button>
            )}
          </>
        )}
        {phase === 'rest' && (
          <div className="card">
            <strong>잘했어요! 잠깐 숨 고르기</strong>
            <p className="muted">다음 운동: {routine.items[idx + 1].name} · {amountLabel(routine.items[idx + 1])}</p>
            <button className="btn btn-primary" onClick={goNextExercise}>다음 운동 준비</button>
          </div>
        )}
        <button className="btn" onClick={() => confirm('운동을 끝내고 결과를 볼까요?') && finish()}>
          운동 종료
        </button>
      </aside>

      {cheerToast && (
        <div className="card" style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--c-pink)', color: '#fff' }}>
          {cheerToast}
        </div>
      )}
    </main>
  )
}
