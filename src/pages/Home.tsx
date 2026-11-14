import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import type { FriendRoom, WorkoutSession } from '../types/domain'
import { summarize } from '../lib/stats'
import { durationLabel } from '../lib/format'
import { sunsetOpenLabel } from '../lib/sunset'
import { useSunsetStatus } from '../hooks/useSunsetStatus'
import { CONTEST_RULES } from '../config/contest'
import { Logo, ProvisionalBadge } from '../components/ui'
import { PARTY_MAX } from '../config/provisional'
// 카드 그림: 운동방 배경 (실제 운동방 화면 캡처가 생기면 바꿔 끼운다)
import friendRoomImage from '../assets/bg/room-friend.jpg'
import sunsetRoomImage from '../assets/bg/public-stage.jpg'

// F-HIPEHA 홈. 밝은 라벤더 바탕에 운동방 그림 카드 두 개(친구·공개)와 기록·챌린지 줄을 둔다.
// 친구 운동이 메인, 공개 운동방(선셋)은 보조 카드 (F-HIPEHA rules)
// 아래 학교 대항 챌린지 카드는 시연장 이벤트(/univ-contest) 입구라 기획 기능 ID가 없다
export default function Home() {
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)!
  const lastRoutineId = useApp((s) => s.lastRoutineId)
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null)
  const [hasError, setHasError] = useState(false)
  const { status: sunset } = useSunsetStatus()
  // 다음에 친구 운동방으로 가면 들어갈 방 (이슈 #40). 못 불러와도 홈은 그대로 쓴다
  const [lastRoom, setLastRoom] = useState<FriendRoom | null>(null)

  useEffect(() => {
    const life = { isAlive: true }
    services.rooms
      .getLast(profile.userId)
      .then((id) => (id ? services.rooms.get(id) : null))
      .then((room) => life.isAlive && setLastRoom(room))
      .catch(() => {})
    return () => {
      life.isAlive = false
    }
  }, [profile.userId])

  useEffect(() => {
    services.record
      .listSessions(profile.userId)
      .then(setSessions)
      .catch(() => setHasError(true))
  }, [profile.userId])

  const stats = sessions ? summarize(sessions) : null

  return (
    <main className="home">
      <Logo />
      <div className="home-body">
        <h1 className="home-hello">안녕하세요, {profile.nickname}님</h1>

        <div className="home-main">
          {/* 친구 운동이 메인 (F-HIPEHA) */}
          <section className="home-card" aria-label="친구 운동방">
            <img className="home-card-image" src={friendRoomImage} alt="" />
            <div className="home-card-body">
              <h2 className="home-card-title">친구들과 운동하기</h2>
              <p className="home-card-sub">AI가 추천한 루틴으로 최대 {PARTY_MAX}명이 함께해요</p>
              {lastRoom && <p className="home-card-note">지난번 운동방 <b>{lastRoom.name}</b>으로 들어가요</p>}
              <button className="home-btn is-primary" onClick={() => nav('/goal')}>운동 목표 고르기</button>
              {lastRoutineId && <button className="home-link" onClick={() => nav(`/room/${lastRoutineId}`)}>지난 운동방으로 바로 가기</button>}
            </div>
          </section>

          <section className="home-card" aria-label="공개 운동방">
            <img className="home-card-image" src={sunsetRoomImage} alt="" />
            <div className="home-card-body">
              <span className={`home-status ${sunset.isOpen ? 'is-open' : ''}`}>
                <i aria-hidden />{sunset.isOpen ? '지금 열려 있어요' : '오픈 전이에요'}
                {/* 인원은 서버가 알려 줄 때만 보여준다 */}
                {sunset.isOpen && sunset.participantCount !== null && <> · {sunset.participantCount}명 참가 중</>}
              </span>
              <h2 className="home-card-title">선셋 에어로빅</h2>
              <p className="home-card-sub row wrap" style={{ gap: 8 }}>{sunsetOpenLabel(sunset.schedule)} <ProvisionalBadge>운영 시각 임시</ProvisionalBadge></p>
              <button className="home-btn is-dark" onClick={() => nav('/sunset')}>{sunset.isOpen ? '입장하기' : '미리보기'}</button>
            </div>
          </section>
        </div>

        {/* 내 성장 기록 요약: 실제 저장된 기록만 */}
        <section className="home-strip" aria-label="내 성장 기록">
          {hasError && <p className="home-card-sub">기록을 불러오지 못했어요.</p>}
          {!hasError && !stats && <p className="home-card-sub">기록을 불러오는 중…</p>}
          {stats && stats.count === 0 && <p className="home-card-sub">아직 운동 기록이 없어요. 첫 운동을 시작해 보세요!</p>}
          {stats && stats.count > 0 && (
            <div className="home-stats">
              <div><span>이번 주</span><strong>{stats.weekCount}회</strong></div>
              <div><span>연속</span><strong>{stats.streakDays}일</strong></div>
              <div><span>누적</span><strong>{durationLabel(stats.totalActiveMs)}</strong></div>
            </div>
          )}
          <button className="home-link" onClick={() => nav('/history')}>전체 기록 보기</button>
        </section>

        {/* 시연장 이벤트(/univ-contest) 입구라 기획 기능 ID가 없다 */}
        <section className="home-strip" aria-label="학교 대항 챌린지">
          <div className="col" style={{ gap: 6 }}>
            <h2 className="home-strip-title">학교 대항 스쿼트 {CONTEST_RULES.durationMs / 1000}초 챌린지</h2>
            <p className="home-card-sub">학교별 누적 횟수로 순위를 겨뤄요</p>
          </div>
          <button className="home-btn is-dark is-small" onClick={() => nav('/univ-contest')}>챌린지 보기</button>
        </section>
      </div>
    </main>
  )
}
