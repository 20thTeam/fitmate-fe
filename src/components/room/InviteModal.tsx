// 친구 초대 창 (Figma: '친구를 초대해보세요!').
// 시연 범위는 지정된 운동방 하나라서(PL-MLHPJO) 링크로 들어온 친구가 같은 방에 모인다.
// 닉네임 검색은 친구 목록 API가 생기면 연결한다.
import { useState } from 'react'
import { Modal } from '../ui'
import searchIcon from '../../assets/icons/search.svg'
import linkIcon from '../../assets/icons/link.png'

type Notice = { tone: 'ok' | 'error'; text: string } | null

export default function InviteModal({ onClose }: { onClose: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const inviteUrl = `${location.origin}/`

  const handleSearch = () => {
    if (!keyword.trim()) return
    setNotice({ tone: 'error', text: '닉네임 검색은 아직 준비 중이에요. 초대 링크를 보내 주세요.' })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setNotice({ tone: 'ok', text: '초대 링크를 복사했어요. 친구에게 보내 주세요!' })
    } catch {
      setNotice({ tone: 'error', text: `복사하지 못했어요. 이 주소를 직접 보내 주세요: ${inviteUrl}` })
    }
  }

  const canShare = typeof navigator.share === 'function'
  const handleShare = async () => {
    try {
      await navigator.share({ title: 'FITMATE', text: '같이 운동하자! FITMATE 운동방으로 와', url: inviteUrl })
    } catch {
      // 사용자가 공유 창을 닫은 경우도 여기로 온다
    }
  }

  return (
    <Modal onClose={onClose} label="친구 초대">
      <div className="col" style={{ gap: 6, marginTop: 24 }}>
        <h2 className="sheet-title" style={{ fontSize: 30 }}>친구를 초대해보세요!</h2>
        <p className="sheet-sub" style={{ fontSize: 20, color: '#707070' }}>함께 운동하면 더 즐거워요</p>
      </div>

      <form className="search" style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); handleSearch() }}>
        <img src={searchIcon} alt="" width={24} height={22} />
        <label className="sr-only" htmlFor="invite-search">닉네임 검색</label>
        <input id="invite-search" placeholder="닉네임을 검색해보세요!" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </form>

      <div className="row" style={{ gap: 14, color: '#707070', fontSize: 13 }}>
        <hr style={{ flex: 1, border: 0, borderTop: '2px solid #c9bcc1' }} />또는<hr style={{ flex: 1, border: 0, borderTop: '2px solid #c9bcc1' }} />
      </div>

      <div className="row center" style={{ gap: 64 }}>
        <button className="col center" style={{ gap: 8, color: '#444', fontSize: 13 }} onClick={handleCopy}>
          <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: '1px solid #d9b9c5', display: 'grid', placeItems: 'center' }}>
            <img src={linkIcon} alt="" width={24} height={24} />
          </span>
          초대 링크 복사
        </button>
        {canShare && (
          <button className="col center" style={{ gap: 8, color: '#444', fontSize: 13 }} onClick={handleShare}>
            <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: '1px solid #d9b9c5', display: 'grid', placeItems: 'center', fontSize: 20, letterSpacing: 1 }}>···</span>
            더보기
          </button>
        )}
      </div>

      {notice && (
        <p role="status" style={{ textAlign: 'center', fontSize: 14, color: notice.tone === 'ok' ? '#3f7a39' : '#a2475b', wordBreak: 'break-all' }}>{notice.text}</p>
      )}
    </Modal>
  )
}
