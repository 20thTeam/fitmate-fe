// 공개 운동방 운동 중 싱크로율 (#110). 지금 영상 동작, 지금까지 싱크로율, 1초마다 판정 반응을 보여 준다.
// 2m 떨어져서 보니 숫자와 동작 이름을 크게 쓴다.
import { SUNSET_MOVES, isLegMove, type SyncJudge } from '../../lib/pose/sunsetSync'
import { ProgressBar, ProvisionalBadge } from '../ui'

interface Props {
  moveIndex: number
  judge: SyncJudge
  /** 지금까지 싱크로율 (0~100). 아직 판정이 적으면 null */
  rate: number | null
}

export default function SyncPanel({ moveIndex, judge, rate }: Props) {
  const move = SUNSET_MOVES[moveIndex]
  const message =
    judge === 'good' ? '좋아요! 잘 따라 하고 있어요'
      : judge === 'miss' ? move.tip
        : judge === 'unseen' ? (isLegMove(move.id) ? '다리가 화면에 보이게 조금 뒤로 서 주세요' : '팔이 화면에 보이게 서 주세요')
          : '카메라에 몸이 보이게 서 주세요'
  return (
    <section className="glass is-lined col" style={{ width: '100%', gap: 6, padding: '12px 14px', color: '#fff' }} aria-label="싱크로율">
      <div className="row between t-xs">
        <span>{moveIndex + 1} / {SUNSET_MOVES.length} · 지금 동작</span>
        <ProvisionalBadge>판정 기준 임시</ProvisionalBadge>
      </div>
      <strong style={{ fontSize: 22 }}>{move.name}</strong>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <span className="t-sm">싱크로율</span>
        <strong style={{ fontSize: 32 }}>{rate === null ? '—' : `${rate}%`}</strong>
      </div>
      <ProgressBar value={rate === null ? 0 : rate / 100} />
      <span className="t-sm" role="status" style={{ fontWeight: 700, color: judge === 'good' ? '#c9ff9a' : '#fff' }}>
        {message}
      </span>
    </section>
  )
}
