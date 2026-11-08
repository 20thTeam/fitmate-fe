// 내 운동 진행 상태 (F-SZCKIV, F-XNIIJM). 친구 파티와 선셋이 같이 쓴다.
// 일시정지 시간은 운동 시간에서 빼고, 멈춘 동안에는 유효 횟수를 올리지 않는다.
// 횟수는 동작이 인정될 때만 바뀌므로(매 프레임이 아님) 상태로 둬도 된다.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExerciseRecord } from '../types/domain'

export interface WorkoutItem {
  exerciseId: string
  name: string
  sets: number
  targetReps?: number
  targetSeconds?: number
}

type PostureNote = ExerciseRecord['postureNotes'][number]

const emptyRecord = (it: WorkoutItem): ExerciseRecord => ({
  exerciseId: it.exerciseId,
  name: it.name,
  validReps: 0,
  validSeconds: 0,
  durationMs: 0,
  completed: false,
  postureNotes: [],
})

/** 세트 수 × 세트당 목표를 모두 채웠는지 */
export function isItemDone(it: WorkoutItem, r: ExerciseRecord) {
  if (it.targetReps) return r.validReps >= it.targetReps * it.sets
  if (it.targetSeconds) return r.validSeconds >= it.targetSeconds * it.sets
  return false
}

interface Clock {
  startedAt: number | null
  /** 지금 달리는 중이면 시작 시각, 멈췄으면 null */
  runningSince: number | null
  /** 지난 구간들의 합 */
  activeMs: number
}

export function useWorkout(items: WorkoutItem[]) {
  const [records, setRecords] = useState<ExerciseRecord[]>(() => items.map(emptyRecord))
  const [index, setIndex] = useState(0)
  const [setNo, setSetNo] = useState(1)
  const [setProgress, setSetProgress] = useState(0)
  const [clock, setClock] = useState<Clock>({ startedAt: null, runningSince: null, activeMs: 0 })

  // 이벤트 핸들러에서 최신 값을 읽기 위한 사본 (렌더 중에는 읽지 않는다)
  const latest = useRef({ records, index, clock })
  useEffect(() => {
    latest.current = { records, index, clock }
  }, [records, index, clock])

  const updateRecord = useCallback((i: number, fn: (r: ExerciseRecord) => ExerciseRecord) => {
    setRecords((rs) => rs.map((r, j) => (j === i ? fn(r) : r)))
  }, [])

  const start = useCallback(() => {
    const now = Date.now()
    setClock((c) => (c.runningSince !== null ? c : { ...c, startedAt: c.startedAt ?? now, runningSince: now }))
  }, [])

  /** 달린 구간을 현재 운동 시간과 전체 시간에 더하고 멈춘다 */
  const pause = useCallback(() => {
    const { clock: c, index: i } = latest.current
    if (c.runningSince === null) return
    const d = Date.now() - c.runningSince
    setClock({ ...c, runningSince: null, activeMs: c.activeMs + d })
    updateRecord(i, (r) => ({ ...r, durationMs: r.durationMs + d }))
  }, [updateRecord])

  const isRunning = clock.runningSince !== null

  const countValidRep = useCallback((n = 1) => {
    if (latest.current.clock.runningSince === null) return
    updateRecord(latest.current.index, (r) => ({ ...r, validReps: r.validReps + n }))
    setSetProgress((p) => p + n)
  }, [updateRecord])

  const countValidSeconds = useCallback((n = 1) => {
    if (latest.current.clock.runningSince === null) return
    updateRecord(latest.current.index, (r) => ({ ...r, validSeconds: r.validSeconds + n }))
    setSetProgress((p) => p + n)
  }, [updateRecord])

  const addPostureNote = useCallback((note: PostureNote) => {
    updateRecord(latest.current.index, (r) => ({ ...r, postureNotes: [...r.postureNotes.slice(-9), note] }))
  }, [updateRecord])

  const nextSet = useCallback(() => {
    setSetProgress(0)
    setSetNo((n) => n + 1)
  }, [])

  /** 현재 운동을 마치고 멈춘다 (휴식으로 넘어갈 때) */
  const endExercise = useCallback(() => {
    pause()
    const i = latest.current.index
    if (items[i]) updateRecord(i, (r) => ({ ...r, completed: isItemDone(items[i], r) }))
  }, [items, pause, updateRecord])

  const goToExercise = useCallback((i: number) => {
    setSetProgress(0)
    setIndex(i)
    setSetNo(1)
  }, [])

  /** 저장할 최종 기록. 아직 반영 안 된 달린 구간까지 계산해서 돌려준다. */
  const finalize = useCallback(() => {
    const { clock: c, index: i, records: rs } = latest.current
    const now = Date.now()
    const tail = c.runningSince !== null ? now - c.runningSince : 0
    pause()
    const finalRecords = rs.map((r, j) => {
      const withTail = j === i ? { ...r, durationMs: r.durationMs + tail } : r
      return items[j] ? { ...withTail, completed: isItemDone(items[j], withTail) } : withTail
    })
    return { records: finalRecords, activeMs: c.activeMs + tail, startedAt: c.startedAt ?? now }
  }, [items, pause])

  /** 일시정지를 뺀 경과 시간. now는 useNow 값을 넘긴다. */
  const elapsedMs = (now: number) => clock.activeMs + (clock.runningSince !== null ? now - clock.runningSince : 0)

  return {
    index,
    setNo,
    isRunning,
    item: items[index] as WorkoutItem | undefined,
    record: records[index] as ExerciseRecord | undefined,
    setProgress,
    start,
    pause,
    countValidRep,
    countValidSeconds,
    addPostureNote,
    nextSet,
    endExercise,
    goToExercise,
    finalize,
    elapsedMs,
  }
}
