import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import type { FriendRoom, WorkoutSession } from '../types/domain'
import { summarize } from '../lib/stats'
import { durationLabel } from '../lib/format'
import { sunsetOpenLabel } from '../lib/sunset'
import { useSunsetStatus } from '../hooks/useSunsetStatus'
import { characterOf } from '../config/characters'
import { CONTEST_RULES } from '../config/contest'
import Backdrop from '../components/Backdrop'
import { Logo, ProvisionalBadge } from '../components/ui'
import groupIcon from '../assets/icons/group.png'
import globeIcon from '../assets/icons/globe.png'

// F-HIPEHA 홈. Figma 시안에 없는 화면이라 같은 디자인 시스템으로 맞췄다.
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
    <Backdrop isDim>
      <Logo isLight />
      <div className="backdrop-body is-center" style={{ gap: 28 }}>
        <header className="col center" style={{ gap: 12 }}>
          <img src={characterOf(profile.characterId).image} alt="" width={84} height={84} />
          <h1 className="t-display">안녕하세요, {profile.nickname}님</h1>
          <p className="t-h3 t-soft" style={{ fontWeight: 600 }}>오늘도 친구들과 함께 운동해볼까요?</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '560px 380px', gap: 24 }}>
          <section className="card col" style={{ gap: 16, padding: 32 }}>
            <span className="panel-pill" style={{ alignSelf: 'flex-start' }}><img src={groupIcon} alt="" width={18} height={18} />친구 운동방</span>
            <h2 className="t-title">친구들과 운동하기</h2>
            <p className="t-soft" style={{ lineHeight: 1.6 }}>AI가 추천한 나만의 루틴으로 친구들과 같은 운동방에서 함께 운동해요. 최대 5명까지 들어올 수 있어요.</p>
            {lastRoom && <p className="t-small">지난번 운동방: <strong>{lastRoom.name}</strong> · 이번에도 이 방으로 들어가요</p>}
            <div className="row" style={{ gap: 12, marginTop: 'auto' }}>
              <button className="btn btn-primary btn-lg" onClick={() => nav('/goal')}>운동 목표 고르기</button>
              {lastRoutineId && <button className="btn btn-secondary" onClick={() => nav(`/room/${lastRoutineId}`)}>지난 운동방으로</button>}
            </div>
          </section>

          <div className="col" style={{ gap: 24 }}>
            <section className="card col" style={{ gap: 10 }} data-theme="public">
              <div className="row between">
                <span className="panel-pill"><img src={globeIcon} alt="" width={18} height={18} />공개 운동방</span>
                <span className="chip chip-ghost">{sunset.isOpen ? '오픈 중' : '오픈 전'}</span>
              </div>
              <h2 className="t-h2">선셋 에어로빅</h2>
              <p className="t-small t-soft" style={{ lineHeight: 1.6 }}>{sunsetOpenLabel(sunset.schedule)}</p>
              {/* 인원은 서버가 알려 줄 때만 보여준다 */}
              {sunset.isOpen && sunset.participantCount !== null && <p className="t-small">지금 {sunset.participantCount}명 참가 중</p>}
              <span style={{ alignSelf: 'flex-start' }}><ProvisionalBadge>운영 시각 임시</ProvisionalBadge></span>
              <button className="btn btn-primary" onClick={() => nav('/sunset')}>{sunset.isOpen ? '공개 운동방 입장하기' : '운동방 미리보기'}</button>
            </section>

            {/* 내 성장 기록 요약: 실제 저장된 기록만 */}
            <section className="card col" style={{ gap: 10 }}>
              <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>내 성장 기록</h2>
              {hasError && <p className="t-soft">기록을 불러오지 못했어요.</p>}
              {!hasError && !stats && <p className="t-soft">불러오는 중…</p>}
              {stats && stats.count === 0 && <p className="t-soft">아직 운동 기록이 없어요. 첫 운동을 시작해 보세요!</p>}
              {stats && stats.count > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div className="col" style={{ gap: 2 }}><span className="t-xs t-soft">이번 주</span><strong className="t-h3">{stats.weekCount}회</strong></div>
                  <div className="col" style={{ gap: 2 }}><span className="t-xs t-soft">연속</span><strong className="t-h3">{stats.streakDays}일</strong></div>
                  <div className="col" style={{ gap: 2 }}><span className="t-xs t-soft">누적</span><strong className="t-h3">{durationLabel(stats.totalActiveMs)}</strong></div>
                </div>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => nav('/history')}>전체 기록 보기</button>
            </section>
          </div>

          <section className="card row between" style={{ gridColumn: '1 / -1', gap: 24, padding: '20px 32px' }} data-theme="public" aria-label="학교 대항 챌린지">
            <div className="col" style={{ gap: 6 }}>
              <span className="chip chip-ghost" style={{ alignSelf: 'flex-start' }}>시연장 이벤트</span>
              <h2 className="t-h2">학교 대항 스쿼트 {CONTEST_RULES.durationMs / 1000}초 챌린지</h2>
              <p className="t-small t-soft">한 판 최대 {CONTEST_RULES.maxPlayers}명이 동시에 스쿼트하고, 학교별 누적 횟수로 순위를 겨뤄요.</p>
            </div>
            <button className="btn btn-plum btn-lg" style={{ flexShrink: 0 }} onClick={() => nav('/univ-contest')}>챌린지 보러 가기 &gt;</button>
          </section>
        </div>
      </div>
    </Backdrop>
  )
}
