import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { services } from '../services'
import { useApp } from '../store/app'
import { CHARACTERS } from '../config/characters'
import Backdrop from '../components/Backdrop'
import { Logo } from '../components/ui'

// F-MZLVEJ · Figma '프로필 설정'
// 닉네임 길이는 미정 → 권장안 '짧은 입력 제한'. 같은 닉네임은 임시 ID로 구분한다.
const NICKNAME_MAX = 8

export default function ProfileSetup() {
  const nav = useNavigate()
  const setProfile = useApp((s) => s.setProfile)
  const [nickname, setNickname] = useState('')
  const [characterId, setCharacterId] = useState<string>(CHARACTERS[0].id)
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)

  const isValid = nickname.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid || isSaving) return
    setIsSaving(true)
    setHasError(false)
    try {
      const p = await services.profile.create({ nickname: nickname.trim(), characterId })
      setProfile(p)
      nav('/goal')
    } catch {
      setHasError(true)
      setIsSaving(false)
    }
  }

  return (
    <Backdrop isDim>
      <Logo isLight />
      <div className="backdrop-body is-center">
        <form
          className="sheet"
          style={{ width: 588, padding: '44px 56px 42px', alignItems: 'stretch' }}
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
        >
          <div className="col" style={{ gap: 14 }}>
            <h1 className="sheet-title" style={{ fontSize: 30 }}>프로필 설정</h1>
            <p className="sheet-sub" style={{ fontSize: 18 }}>운동을 시작하기 전에 닉네임과 캐릭터를 선택해주세요</p>
          </div>

          <label className="col" style={{ gap: 10, marginTop: 8 }}>
            <span className="sheet-label" style={{ paddingLeft: 4 }}>닉네임</span>
            <input
              className="input"
              placeholder={`최대 ${NICKNAME_MAX}자`}
              maxLength={NICKNAME_MAX}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
            />
          </label>

          <fieldset className="col center" style={{ gap: 12, border: 0, padding: 0, margin: '12px 0 0' }}>
            <legend className="sheet-label" style={{ marginBottom: 12, textAlign: 'center', width: '100%' }}>캐릭터 선택</legend>
            <div className="row center" style={{ gap: 16 }}>
              {CHARACTERS.map((c) => {
                const isSelected = characterId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${c.name} 캐릭터`}
                    onClick={() => setCharacterId(c.id)}
                    style={{
                      borderRadius: '50%',
                      outline: isSelected ? '4px solid #fff' : 'none',
                      boxShadow: isSelected ? '0 0 0 7px #d9a7bd' : 'none',
                      transform: isSelected ? 'scale(1.04)' : undefined,
                      transition: 'transform 0.12s',
                    }}
                  >
                    <img src={c.image} alt="" width={106} height={106} />
                  </button>
                )
              })}
            </div>
          </fieldset>

          {hasError && <p role="alert" style={{ color: '#a2475b', textAlign: 'center' }}>프로필을 저장하지 못했어요. 다시 시도해 주세요.</p>}

          <button className="btn btn-plum btn-square" style={{ alignSelf: 'center', width: 206, height: 66, fontSize: 20, marginTop: 12 }} disabled={!isValid || isSaving}>
            {isSaving ? '저장하는 중…' : '시작하기'}
          </button>
        </form>
      </div>
    </Backdrop>
  )
}
