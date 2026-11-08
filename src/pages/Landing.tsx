import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/app'
import { CHARACTERS } from '../config/characters'
import Backdrop from '../components/Backdrop'
import { Logo } from '../components/ui'

// F-SNDWGO 랜딩. Figma 시안에 없는 화면이라 같은 디자인 시스템(선셋 배경·카드·버튼)으로 맞췄다.
const VALUES = [
  { title: 'AI 개인 맞춤 루틴', desc: '운동 목표 하나만 고르면 나에게 맞는 루틴을 추천하고, 수행 결과에 따라 다음 회차 난이도를 조절해요.' },
  { title: '실시간 자세 피드백', desc: '카메라가 내 동작을 분석해 올바른 자세를 안내해요. 영상은 내 브라우저 밖으로 나가지 않아요.' },
  { title: '친구와 같은 운동방', desc: '친구들과 같은 공간에 모여 각자 필요한 운동을 해요. 이름을 누르면 응원이 바로 전달돼요.' },
]

export default function Landing() {
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)
  const start = () => nav(profile ? '/home' : '/profile')

  return (
    <Backdrop>
      <Logo />
      <div className="backdrop-body is-center" style={{ gap: 40 }}>
        <section className="col center" style={{ gap: 18, marginTop: 40 }}>
          <div className="row" style={{ gap: 14 }} aria-hidden>
            {CHARACTERS.map((c, i) => (
              <img key={c.id} src={c.image} alt="" width={72} height={72} style={{ transform: `translateY(${i % 2 ? -10 : 0}px)` }} />
            ))}
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.2, textShadow: '0 2px 16px rgba(120,60,120,0.35)' }}>
            작심삼일을 습관으로 바꾸는<br />AI 소셜 홈트레이닝
          </h1>
          <p style={{ fontSize: 22, fontWeight: 600 }}>친구들과 같은 공간에서 각자의 운동을, AI 코치와 함께 나만의 루틴으로</p>
          <button className="btn btn-plum btn-xl" style={{ marginTop: 18 }} onClick={start}>
            <span style={{ flex: 1, textAlign: 'center' }}>{profile ? `${profile.nickname}님, 이어서 운동하기` : '시작하기'}</span>
            <span aria-hidden>&gt;</span>
          </button>
          <p className="t-small" style={{ fontWeight: 600 }}>회원가입 없이 닉네임만 정하면 바로 시작해요</p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 320px)', gap: 24 }} aria-label="FITMATE 특징">
          {VALUES.map((v) => (
            <div key={v.title} className="card col" style={{ gap: 10 }}>
              <h2 className="t-h3">{v.title}</h2>
              <p className="t-soft" style={{ lineHeight: 1.6 }}>{v.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </Backdrop>
  )
}
