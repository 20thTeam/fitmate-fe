// 입장 대기 화면 아래 가운데 요약 바: 오늘의 운동 · 예상 시간 · 예상 칼로리 · 시작하기
import type { ReactNode } from 'react'

interface Stat {
  label: string
  value: ReactNode
}

interface Props {
  thumb: string
  caption: string
  title: string
  chip?: ReactNode
  stats: Stat[]
  /** 통계 옆에 붙일 표시 (예: 시연용 임시) */
  note?: ReactNode
  action: ReactNode
}

export default function SummaryBar({ thumb, caption, title, chip, stats, note, action }: Props) {
  return (
    <section className="summary-bar" aria-label="오늘의 운동 요약">
      <img className="summary-thumb" src={thumb} alt="" />
      <div className="col" style={{ gap: 4, padding: '0 28px 0 16px', minWidth: 210 }}>
        <span className="summary-label">{caption}</span>
        <div className="row" style={{ gap: 10 }}>
          <strong className="summary-value">{title}</strong>
          {chip}
        </div>
      </div>
      {stats.map((s) => (
        <div key={s.label} className="summary-stat">
          <span className="summary-label">{s.label}</span>
          <strong className="summary-value">{s.value}</strong>
        </div>
      ))}
      {note && <div style={{ alignSelf: 'flex-start', marginTop: 4 }}>{note}</div>}
      <div style={{ marginLeft: 'auto', paddingLeft: 16 }}>{action}</div>
    </section>
  )
}
