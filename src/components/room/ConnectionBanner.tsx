// 내 실시간 연결이 늦거나 끊겼을 때 운동방 위쪽에 띄우는 안내 (F-STRTHT exceptions).
// 친구 한 명의 연결 문제는 참가자 목록의 '연결 불안정'으로 따로 보여 준다.
import type { ConnectionState } from '../../services'

const MESSAGE: Record<Exclude<ConnectionState, 'connected'>, string> = {
  slow: '연결이 느려요. 친구 움직임이 늦게 보일 수 있어요.',
  reconnecting: '운동방 연결이 끊겨 다시 연결하는 중이에요. 내 운동 기록은 계속 세고 있어요.',
  replaced: '다른 창에서 같은 프로필로 입장해서 이 창의 연결을 닫았어요.',
  closed: '운동방 연결이 끊겼어요. 친구 상태가 최신이 아닐 수 있어요.',
}

interface Props {
  state: ConnectionState
  onReconnect: () => void
}

export default function ConnectionBanner({ state, onReconnect }: Props) {
  if (state === 'connected') return null
  const canReconnect = state === 'replaced' || state === 'closed'
  return (
    <div className={`conn-banner is-${state}`} role="status">
      {state === 'reconnecting' && <span className="conn-spinner" aria-hidden />}
      <span>{MESSAGE[state]}</span>
      {canReconnect && (
        <button className="btn btn-dark btn-sm" onClick={onReconnect}>
          {state === 'replaced' ? '이 창에서 다시 연결' : '다시 연결'}
        </button>
      )}
    </div>
  )
}
