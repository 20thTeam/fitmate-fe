import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import { CHARACTERS } from '../config/characters'

// F-MZLVEJ: 임시 사용자 식별 및 닉네임·캐릭터
const NICK_MAX = 8 // 미정: 닉네임 길이 (권장안 '짧은 입력 제한'의 임시값)

export default function ProfileSetup() {
  const nav = useNavigate()
  const setProfile = useApp((s) => s.setProfile)
  const [nickname, setNickname] = useState('')
  const [characterId, setCharacterId] = useState<string>(CHARACTERS[0].id)
  const [saving, setSaving] = useState(false)

  const valid = nickname.trim().length > 0

  async function submit() {
    setSaving(true)
    const p = await services.profile.create({ nickname: nickname.trim(), characterId })
    setProfile(p)
    nav('/home')
  }

  return (
    <main className="page page-center">
      <h1 className="title">나를 소개해 주세요</h1>
      <p className="subtitle">회원가입 없이 닉네임과 캐릭터만 정하면 시작할 수 있어요</p>

      <input
        className="text"
        placeholder={`닉네임 (최대 ${NICK_MAX}자)`}
        maxLength={NICK_MAX}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />

      <div className="row">
        {CHARACTERS.map((c) => (
          <button
            key={c.id}
            className={`card selectable ${characterId === c.id ? 'selected' : ''}`}
            style={{ width: 160, height: 200 }}
            onClick={() => setCharacterId(c.id)}
          >
            {/* TODO: 3D 캐릭터 미리보기 */}
            <div style={{ height: 120, background: c.color, borderRadius: 12 }} />
            <p style={{ margin: '12px 0 0', fontWeight: 700 }}>{c.name}</p>
          </button>
        ))}
      </div>

      <button className="btn btn-primary btn-lg" disabled={!valid || saving} onClick={submit}>
        완료
      </button>
    </main>
  )
}
