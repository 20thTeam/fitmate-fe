import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { services } from '../services'
import type { Routine, RoutineItem, TeamProgress, WorkoutSession } from '../types/domain'
import { durationLabel, setAmountLabel, shortAmountLabel } from '../lib/format'
import { completionRate } from '../lib/stats'
import Backdrop from '../components/Backdrop'
import { CenterMessage, ProgressBar, ProvisionalBadge, StatCard } from '../components/ui'

// F-XXCKUD 결과 요약, F-SYGFQC·F-WBCAEC 다음 회차 추천, F-WFAMYP 팀 경험치 · Figma '운동 완료'
// 측정된 값만 보여준다. 팀 경험치는 산식이 정해질 때까지 수치를 만들지 않는다.

type NextState = Routine | 'loading' | 'error' | 'none'

const headlineOf = (rate: number) =>
  rate === 100 ? '오늘도 목표를 달성했어요!' : rate > 0 ? '끝까지 해냈어요. 다음엔 조금 더!' : '괜찮아요, 다음 회차에 맞춰 조절해요.'

export default function Result() {
  const { sessionId = '' } = useParams()
  const nav = useNavigate()
  const [session, setSession] = useState<WorkoutSession | null | undefined>(undefined)
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [team, setTeam] = useState<TeamProgress | 'loading' | 'error'>('loading')
  const [next, setNext] = useState<NextState>('loading')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let isAlive = true
    ;(async () => {
      const s = await services.record.getSession(sessionId).catch(() => null)
      if (!isAlive) return
      setSession(s)
      if (!s) return
      if (s.routineId) services.routine.get(s.routineId).then((r) => isAlive && setRoutine(r))
      services.team.applySession(s.roomId, s).then((t) => isAlive && setTeam(t)).catch(() => isAlive && setTeam('error'))
      // 공개 운동방 결과는 다음 회차 추천에 반영하지 않는다 (F-DXORMB 권장안)
      if (s.kind !== 'party') return setNext('none')
      setNext('loading')
      services.routine.recommendNext(s).then((r) => isAlive && setNext(r)).catch(() => isAlive && setNext('error'))
    })()
    return () => { isAlive = false }
  }, [sessionId, retryKey])

  if (session === undefined) return <CenterMessage title="결과를 불러오는 중…" />
  if (session === null) return <CenterMessage title="결과를 찾을 수 없어요" action={<button className="btn btn-primary" onClick={() => nav('/home')}>홈으로</button>} />

  const theme = session.kind === 'sunset' ? 'public' : 'friend'
  const itemOf = (id: string) => routine?.items.find((i) => i.exerciseId === id)
  const rate = completionRate(session)
  const doneCount = session.records.filter((r) => r.completed).length

  // 공개 운동방 기록은 팀 경험치에 쌓이지 않는다 (서버 공개 파티 규칙)
  const isSunset = session.kind === 'sunset'
  const teamValue =
    isSunset ? <span style={{ fontSize: 22 }}>해당 없음</span>
    : team === 'loading' ? '…'
      : team === 'error' ? '불러오지 못함'
        : team.gainedXp === null ? <span style={{ fontSize: 22 }}>산정 기준 준비 중</span>
          : `+ ${team.gainedXp} XP`

  return (
    <Backdrop theme={theme} isDim>
      <div className="backdrop-body is-narrow" style={{ gap: 18 }}>
        <header className="col center" style={{ gap: 8, marginTop: 64, marginBottom: 20 }}>
          <h1 className="t-display">운동 완료</h1>
          <p className="t-h2" style={{ color: 'var(--c-title-soft)' }}>{headlineOf(rate)}</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
          <StatCard label="총 운동 시간" value={durationLabel(session.activeMs)} />
          <StatCard label="완료한 운동" value={`${doneCount} / ${session.records.length}개`} />
          <StatCard label="팀 경험치" value={teamValue} sub={isSunset ? '공개 운동방 기록은 팀 경험치에 쌓이지 않아요' : typeof team === 'object' && team.gainedXp === null ? '팀 경험치는 기준이 확정되면 실제 기록으로 표시돼요' : undefined} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34, alignItems: 'start' }}>
          <section className="card col" style={{ gap: 12 }}>
            <h2 className="card-title">운동별 수행 결과</h2>
            <ul className="list-plain dashed-list">
              {session.records.map((r) => {
                const it = itemOf(r.exerciseId)
                const isTimed = !!it?.targetSeconds
                const done = isTimed ? r.validSeconds : r.validReps
                const goal = it ? (isTimed ? (it.targetSeconds ?? 0) : (it.targetReps ?? 0)) * it.sets : 0
                // 자세 인식이 안 된 운동은 0회로 보이지 않게 '측정 못 함'으로 둔다
                const isNotMeasured = r.measurementStatus === 'NOT_MEASURED'
                // 공개 운동방은 횟수를 세지 않는 자유 운동이라 참여 여부만 보여준다
                if (isSunset) {
                  return (
                    <li key={r.exerciseId} className="row between" style={{ padding: '12px 0' }}>
                      <strong style={{ fontSize: 20 }}>{r.name}</strong>
                      <span className="t-soft" style={{ fontWeight: 700 }}>참여 완료 · 횟수는 세지 않아요</span>
                    </li>
                  )
                }
                return (
                  <li key={r.exerciseId} className="col" style={{ gap: 8, padding: '12px 0' }}>
                    <div className="row between">
                      <strong style={{ fontSize: 20 }}>{r.name}</strong>
                      <span className="t-soft" style={{ fontWeight: 700 }}>
                        {isNotMeasured ? '측정 못 함' : `${done}${isTimed ? '초' : '회'}`}{it ? ` / ${shortAmountLabel(it)}` : ''}
                        {r.completed && <span className="t-xs" style={{ color: 'var(--c-accent-text)', marginLeft: 6 }}>목표 달성!</span>}
                      </span>
                    </div>
                    <ProgressBar value={isNotMeasured ? 0 : goal ? done / goal : r.completed ? 1 : 0} />
                    {isNotMeasured && <span className="t-xs t-soft">카메라나 자세 인식이 안 돼 횟수를 기록하지 않았어요.</span>}
                  </li>
                )
              })}
            </ul>
          </section>

          {next === 'none' ? <FeedbackCard session={session} /> : <NextRoundCard next={next} prevItems={routine?.items ?? []} onRetry={() => setRetryKey((k) => k + 1)} />}
        </div>

        <div className="row center" style={{ gap: 22, marginTop: 28 }}>
          <button className="btn btn-secondary btn-lg" style={{ width: 306, height: 86 }} onClick={() => nav('/home')}>홈으로 돌아가기</button>
          <button className="btn btn-secondary btn-lg" style={{ width: 306, height: 86 }} onClick={() => nav('/history')}>운동 기록 보기</button>
          {typeof next === 'object' && (
            <button className="btn btn-primary btn-lg" style={{ width: 306, height: 86 }} onClick={() => nav(`/room/${next.routineId}`)}>다음 회차 시작</button>
          )}
          {session.kind === 'sunset' && (
            <button className="btn btn-primary btn-lg" style={{ width: 306, height: 86 }} onClick={() => nav('/sunset')}>공개 운동방으로</button>
          )}
        </div>
      </div>
    </Backdrop>
  )
}

/** 다음 회차 추천 (F-SYGFQC). 바뀐 수행량은 이전 회차와 비교해 보여준다 (F-WBCAEC). */
function NextRoundCard({ next, prevItems, onRetry }: { next: Exclude<NextState, 'none'>; prevItems: RoutineItem[]; onRetry: () => void }) {
  const prevById = new Map(prevItems.map((i) => [i.exerciseId, i]))
  return (
    <section className="card col" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10 }}>
        <h2 className="card-title">다음 회차 추천</h2>
        <span className="chip chip-accent">AI 추천</span>
        {typeof next === 'object' && next.provisional && <ProvisionalBadge>시연용 임시 규칙</ProvisionalBadge>}
      </div>
      <p className="t-body" style={{ color: 'var(--c-text-soft)' }}>이번 운동 결과를 바탕으로 다음 운동 강도를 추천해요.</p>

      {next === 'loading' && <p className="t-soft">기록을 분석해 다음 루틴을 만드는 중…</p>}
      {next === 'error' && (
        <div className="col" style={{ gap: 10, alignItems: 'flex-start' }}>
          <p className="t-danger">다음 회차 추천을 만들지 못했어요.</p>
          <button className="btn btn-secondary btn-sm" onClick={onRetry}>다시 시도</button>
        </div>
      )}
      {typeof next === 'object' && (
        <>
          <ol className="list-plain dashed-list">
            {next.items.map((it, i) => {
              const before = prevById.get(it.exerciseId)
              const isChanged = !!before && setAmountLabel(before) !== setAmountLabel(it)
              return (
                <li key={it.exerciseId} className="row" style={{ gap: 12, padding: '12px 0' }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--c-accent)', display: 'grid', placeItems: 'center', fontSize: 18, flex: 'none' }}>{i + 1}</span>
                  <span style={{ fontSize: 20 }}>{it.name}</span>
                  {!before && <span className="chip chip-accent">새로 추가</span>}
                  <span className="t-soft" style={{ marginLeft: 'auto', fontSize: 18 }}>
                    {isChanged && before && <span className="t-xs" style={{ marginRight: 8 }}>{setAmountLabel(before)} →</span>}
                    {setAmountLabel(it)}
                  </span>
                </li>
              )
            })}
          </ol>
          {!!next.changeReasons?.length && (
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--c-text-soft)', fontSize: 13, lineHeight: 1.7 }}>
              {next.changeReasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** 공개 운동방 결과: 다음 회차 대신 측정된 자세 피드백 (F-WLBEFJ) */
function FeedbackCard({ session }: { session: WorkoutSession }) {
  const notes = session.records.flatMap((r) => r.postureNotes.map((n) => ({ ...n, name: r.name })))
  return (
    <section className="card col" style={{ gap: 10 }}>
      <h2 className="card-title">AI 자세 피드백</h2>
      <p className="t-small t-soft">공개 운동방 결과는 다음 회차 추천에 반영되지 않아요.</p>
      {notes.length === 0 ? (
        <p className="t-soft" style={{ lineHeight: 1.6 }}>측정된 자세 피드백이 없어요. 카메라 기반 자세 분석이 연결되면 여기에 표시돼요.</p>
      ) : (
        <ul className="list-plain dashed-list">
          {notes.map((n, i) => (
            <li key={`${n.text}-${i}`} className="row" style={{ gap: 10, padding: '10px 0' }}>
              <span className={`chip ${n.kind === 'good' ? 'chip-good' : 'chip-improving'}`}>{n.kind === 'good' ? '잘한 점' : '개선할 점'}</span>
              <span>{n.name}: {n.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
