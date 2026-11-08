// 운동방 입장 로딩 (Figma '운동방에 입장하는 중...').
// 단계마다 실제 상태(연결·카메라)를 받아 체크한다. 진행 막대는 끝난 단계 수 비율이다.
import Backdrop, { type Theme } from './Backdrop'
import { ProgressBar } from './ui'

export interface LoadingStep {
  label: string
  isDone: boolean
}

export default function EnterLoading({ theme, steps, title = '운동방에 입장하는 중...' }: { theme: Theme; steps: LoadingStep[]; title?: string }) {
  const done = steps.filter((s) => s.isDone).length
  return (
    <Backdrop theme={theme} isDim>
      <div className="backdrop-body is-center">
        <section className="loading-card" role="status" aria-live="polite">
          <h1 className="t-h2" style={{ fontSize: 28 }}>{title}</h1>
          <p className="t-h3 t-soft" style={{ fontWeight: 600 }}>잠시만 기다려 주세요...</p>
          <div style={{ width: '100%', marginTop: 8 }}>
            <ProgressBar value={steps.length ? Math.max(0.08, done / steps.length) : 1} />
          </div>
          <ul className="list-plain col" style={{ gap: 10, marginTop: 16, alignItems: 'flex-start' }}>
            {steps.map((s) => (
              <li key={s.label} className="row" style={{ gap: 14, fontSize: 16, color: s.isDone ? '#fff' : 'var(--c-text-muted)' }}>
                <span aria-hidden style={{ width: 16, fontWeight: 700 }}>{s.isDone ? '✓' : '·'}</span>
                {s.label}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Backdrop>
  )
}
