// 포즈 인식 + 운동별 판정을 묶어 운동 진행(useWorkout)에 반영한다 (F-XNIIJM, F-WLBEFJ).
// 친구 파티와 선셋이 같이 쓴다. 횟수·피드백은 판정이 났을 때만 바뀐다.

import { useCallback, useEffect, useMemo, type RefObject } from 'react'
import { createRepCounter, type CounterEvent, type PoseInput } from '../lib/pose/repCounter'
import type { ExerciseRecord } from '../types/domain'
import { usePose } from './usePose'

interface WorkoutActions {
  countValidRep: (n?: number) => void
  countValidSeconds: (n?: number) => void
  addPostureNote: (note: ExerciseRecord['postureNotes'][number]) => void
}

interface Options {
  exerciseId: string | undefined
  stream: MediaStream | null
  shouldLoad: boolean
  isActive: boolean
  workout: WorkoutActions
  canvasRef?: RefObject<HTMLCanvasElement | null>
}

export function useRepCounting({ exerciseId, stream, shouldLoad, isActive, workout, canvasRef }: Options) {
  const counter = useMemo(() => (exerciseId ? createRepCounter(exerciseId) : null), [exerciseId])
  const { countValidRep, countValidSeconds, addPostureNote } = workout

  // 멈추면 하던 동작은 버린다 (다시 시작할 때 이어서 세지 않게)
  useEffect(() => {
    if (!isActive) counter?.reset()
  }, [isActive, counter])

  const emit = useCallback((e: CounterEvent) => {
    if (e.kind === 'rep') countValidRep()
    else if (e.kind === 'seconds') countValidSeconds(e.seconds)
    else addPostureNote({ kind: e.kind, text: e.text })
  }, [countValidRep, countValidSeconds, addPostureNote])

  const onFrame = useCallback((input: PoseInput) => (counter ? counter.update(input, emit) : false), [counter, emit])

  const pose = usePose({ stream, shouldLoad, isActive: isActive && !!counter, onFrame, canvasRef })

  return { ...pose, isSupported: !!counter, setupHint: counter?.setupHint ?? '' }
}
