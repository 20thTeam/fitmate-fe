import { Link } from 'react-router-dom'

// F-DXORMB: 선셋 에어로빅 (P1). 오픈·종료 시각, 운영 요일이 미정이라 아직 입장 흐름은 열지 않는다.
// 확정되면 config에 시각을 두고 SUNSET_ROOM_ID로 services.realtime.join 하면 된다.
export default function Sunset() {
  return (
    <main className="page page-center">
      <h1 className="title">선셋 에어로빅</h1>
      <p className="subtitle">밤 10시쯤 열리는 공개 운동장이에요. 열려 있는 동안 자유롭게 들어와 각자 시작해요.</p>
      <div className="card" style={{ width: 640, height: 300, display: 'grid', placeItems: 'center' }}>
        <span className="muted">선셋 3D 운동장 미리보기 영역</span>
      </div>
      <span className="badge badge-warn">운영 시각 확정 전 · 준비 중</span>
      <Link to="/home" className="btn">홈으로</Link>
    </main>
  )
}
