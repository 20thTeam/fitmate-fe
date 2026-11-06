import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/app'

// F-SNDWGO: 랜딩에서 시작하기
export default function Landing() {
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)

  return (
    <main className="page page-center">
      <h1 className="title" style={{ fontSize: 72 }}>FITMATE</h1>
      <p className="subtitle" style={{ fontSize: 22 }}>친구들과 함께라면, 작심삼일도 습관이 된다</p>
      {/* TODO: 3D 캐릭터 장면. 로딩 실패 시 이 텍스트 영역만 남는다 (F-SNDWGO 권장안) */}
      <div className="card" style={{ width: 640, height: 320, display: 'grid', placeItems: 'center' }}>
        <span className="muted">3D 캐릭터 장면 영역</span>
      </div>
      <button className="btn btn-primary btn-lg" onClick={() => nav(profile ? '/home' : '/profile')}>
        시작하기
      </button>
    </main>
  )
}
