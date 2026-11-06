import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/app'

// F-HIPEHA: 운동 유형 선택 홈
export default function Home() {
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)!

  return (
    <main className="page">
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 24 }}>FITMATE</strong>
        <div className="row">
          <span>{profile.nickname}</span>
          <Link to="/history" className="btn">성장 기록</Link>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', flex: 1 }}>
        <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 className="title">친구들과 운동하기</h2>
            <p className="subtitle">목표에 맞는 루틴으로 친구 2~5명과 같은 공간에서 운동해요</p>
          </div>
          <button className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }} onClick={() => nav('/goal')}>
            운동 시작
          </button>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>선셋 에어로빅</h3>
          <p className="muted" style={{ margin: 0 }}>밤 10시쯤 열리는 공개 운동장</p>
          {/* 오픈 시각·운영 방식 미정 → 상태는 Sunset 페이지에서 설정값으로 판단 */}
          <button className="btn" onClick={() => nav('/sunset')}>둘러보기</button>
        </section>
      </div>
    </main>
  )
}
