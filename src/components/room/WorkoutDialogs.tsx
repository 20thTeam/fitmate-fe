// 운동 중 확인 창 세 가지 (F-SZCKIV): 운동 종료 확인, 카메라 끊김, 운동방 나가기
import { Modal } from '../ui'

export function EndConfirmDialog({ desc, hasSaveError, isSaving, onCancel, onConfirm }: { desc: string; hasSaveError: boolean; isSaving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onCancel} label="운동 종료 확인">
      <h2 className="sheet-title">운동을 끝낼까요?</h2>
      <p className="sheet-sub">{desc}</p>
      {hasSaveError && <p role="alert" style={{ color: '#a2475b', textAlign: 'center' }}>기록을 저장하지 못했어요. 다시 시도해 주세요.</p>}
      <div className="sheet-actions">
        <button className="btn btn-sheet" onClick={onCancel}>계속 운동하기</button>
        <button className="btn btn-sheet-primary" disabled={isSaving} onClick={onConfirm}>{isSaving ? '저장하는 중…' : '끝내고 결과 보기'}</button>
      </div>
    </Modal>
  )
}

export function CameraLostDialog({ message, onEnd, onRetry }: { message: string; onEnd: () => void; onRetry: () => void }) {
  return (
    <Modal label="카메라 끊김">
      <h2 className="sheet-title">카메라를 사용할 수 없어요</h2>
      <p className="sheet-sub" style={{ lineHeight: 1.5 }}>{message}</p>
      <p className="sheet-sub" style={{ fontSize: 14 }}>카메라가 돌아올 때까지 유효 횟수와 자세 평가는 기록되지 않아요.</p>
      <div className="sheet-actions">
        <button className="btn btn-sheet" onClick={onEnd}>운동 끝내기</button>
        <button className="btn btn-sheet-primary" onClick={onRetry}>카메라 다시 연결</button>
      </div>
    </Modal>
  )
}

export function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <Modal onClose={onStay} label="운동방 나가기">
      <h2 className="sheet-title">운동방을 나갈까요?</h2>
      <p className="sheet-sub" style={{ lineHeight: 1.5 }}>나가면 이번 운동 기록은 저장되지 않아요.<br />기록을 남기려면 '운동 끝내기'를 눌러 주세요.</p>
      <div className="sheet-actions">
        <button className="btn btn-sheet" onClick={onStay}>계속 운동하기</button>
        <button className="btn btn-sheet-primary" onClick={onLeave}>나가기</button>
      </div>
    </Modal>
  )
}
