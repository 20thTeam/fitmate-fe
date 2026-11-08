// 운동방 위쪽의 친구 운동방 / 공개 운동방 전환 탭 (Figma 운동방 시안)
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/app'
import groupIcon from '../../assets/icons/group.png'
import globeIcon from '../../assets/icons/globe.png'

export type RoomMode = 'friend' | 'public'

export default function ModeTabs({ active }: { active: RoomMode }) {
  const nav = useNavigate()
  const lastRoutineId = useApp((s) => s.lastRoutineId)

  // 친구 운동방은 루틴이 있어야 들어갈 수 있어서, 마지막 루틴이 없으면 목표 선택부터 한다
  const goFriend = () => nav(lastRoutineId ? `/room/${lastRoutineId}` : '/goal')

  return (
    <nav className="mode-tabs" aria-label="운동방 종류">
      <button className={`mode-tab ${active === 'friend' ? 'is-active' : ''}`} aria-current={active === 'friend'} onClick={() => active !== 'friend' && goFriend()}>
        <img src={groupIcon} alt="" />친구 운동방
      </button>
      <button className={`mode-tab ${active === 'public' ? 'is-active' : ''}`} aria-current={active === 'public'} onClick={() => active !== 'public' && nav('/sunset')}>
        <img src={globeIcon} alt="" />공개 운동방
      </button>
    </nav>
  )
}
