// 운동방의 루틴 목록 패널 두 가지.
// - RoutineOrderPanel: 입장 대기 화면 왼쪽 아래 '오늘의 운동 순서'
// - RoutineProgressPanel: 운동 중 오른쪽 '오늘의 운동' (지금 하는 운동을 강조)
import type { ReactNode } from 'react'
import { shortAmountLabel, twoDigits } from '../../lib/format'
import starIcon from '../../assets/icons/star.png'

export interface RoutineRowItem {
  exerciseId: string
  name: string
  tag?: string
  sets: number
  targetReps?: number
  targetSeconds?: number
}

const amountOf = (it: RoutineRowItem) => (it.targetReps || it.targetSeconds ? shortAmountLabel(it) : '자유 진행')

export function RoutineOrderPanel({ items, title = '오늘의 운동 순서', sub = '오늘의 맞춤 루틴' }: { items: RoutineRowItem[]; title?: string; sub?: string }) {
  return (
    <section className="glass col" style={{ gap: 8, padding: '14px 12px' }} aria-label={title}>
      <div className="col" style={{ gap: 2, paddingLeft: 4 }}>
        <h2 className="panel-title" style={{ fontSize: 15 }}>{title}</h2>
        <span className="panel-sub">{sub}</span>
      </div>
      <ol className="list-plain col" style={{ gap: 6 }}>
        {items.map((it, i) => (
          <li key={`${it.exerciseId}-${i}`} className="routine-row">
            <span className="routine-no">{twoDigits(i + 1)}</span>
            <span className="routine-name">{it.name}</span>
            <span className="routine-amount">{amountOf(it)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

interface ProgressProps {
  heading: string
  items: RoutineRowItem[]
  activeIndex: number
  guide?: ReactNode
}

export function RoutineProgressPanel({ heading, items, activeIndex, guide }: ProgressProps) {
  return (
    <section className="glass col" style={{ gap: 8, padding: '14px 12px', minHeight: 0 }} aria-label="오늘의 운동">
      <div className="col" style={{ gap: 2, paddingLeft: 4 }}>
        <span className="t-xs" style={{ color: 'var(--c-coach-title)' }}>오늘의 운동</span>
        <h2 className="t-h3" style={{ fontSize: 17 }}>{heading}</h2>
        <span className="panel-sub">오늘의 맞춤 루틴</span>
      </div>
      <ol className="list-plain col" style={{ gap: 8, overflow: 'auto', minHeight: 0 }}>
        {items.map((it, i) => (
          <li
            key={`${it.exerciseId}-${i}`}
            className={`routine-row ${i === activeIndex ? 'is-active' : ''} ${i < activeIndex ? 'is-done' : ''}`}
            style={{ minHeight: 48 }}
            aria-current={i === activeIndex ? 'step' : undefined}
          >
            <span className="routine-no">{twoDigits(i + 1)}</span>
            <span className="col" style={{ gap: 2 }}>
              <span className="routine-name" style={{ fontSize: 13 }}>{it.name}</span>
              {it.tag && <span className="routine-tag">{it.tag}</span>}
            </span>
            <span className="routine-amount">{amountOf(it)}</span>
          </li>
        ))}
      </ol>
      {guide && (
        <div className="guide-row">
          <img src={starIcon} alt="" width={20} height={20} />
          <span className="col" style={{ gap: 2 }}>
            <span className="t-xs" style={{ fontWeight: 700 }}>운동 가이드</span>
            <span className="routine-tag" style={{ lineHeight: 1.4 }}>{guide}</span>
          </span>
        </div>
      )}
    </section>
  )
}
