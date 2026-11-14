// 운동 사이 휴식 카드. 운동 중 코치 말풍선과 같은 자리(진행 바와 스크린 사이, 눈높이)에 한 줄로 띄운다.
// 스크린에는 다음 운동 시범이 나오고 있어서 가리지 않게 가운데가 아닌 위쪽에 둔다.
// 시간이 다 되면 PartyRoom이 이 카드 대신 '휴식 끝!' 카드(StepDoneCard)를 띄운다.

/** 남은 시간이 이만큼 이하면 숫자를 노랗게 바꾸고 1초마다 튀게 해서 곧 시작한다는 걸 알린다 */
const LAST_SECONDS = 5

interface Props {
  leftSec: number
  nextName: string
  /** 다음 운동 분량 (예: '3세트 × 12회') */
  nextAmount: string
}

export default function RestCard({ leftSec, nextName, nextAmount }: Props) {
  const isEnding = leftSec <= LAST_SECONDS
  return (
    <div className="coach-bubble-wrap">
      <section className="rest-card glass is-lined is-pop" aria-label="휴식 중">
        <span className="rest-card-title">잠깐 쉬어요</span>
        <span className="rest-card-time" role="timer" aria-label={`${leftSec}초 남음`}>
          {/* 마지막 몇 초는 key로 매초 다시 그려 튀는 효과를 처음부터 튼다 */}
          <strong key={isEnding ? leftSec : 'steady'} className={isEnding ? 'is-ending' : undefined}>{leftSec}</strong>초
        </span>
        <span className="rest-card-next">
          다음 <b>{nextName}</b>
          <small>{nextAmount}</small>
        </span>
      </section>
    </div>
  )
}
