// 운영 암호로 여는 화면의 공통 문 (운영 화면 /admin, 순위 전광판 /univ-contest/board).
// 암호는 VITE_ADMIN_PASSWORD로 브라우저 코드에 들어가서 보안 수단이 아니라 방문자가 실수로 들어오는 것만 막는다.
// 서버 기록을 바꾸는 운영 작업은 따로 서버 운영 키(X-Admin-Key)가 있어야 한다.

import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Backdrop from './Backdrop'
import { CenterMessage, Logo } from './ui'

const PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? ''
/** 운영 화면을 연 탭. 탭을 닫으면 다시 묻는다 */
const SESSION_KEY = 'fitmate-admin-unlocked'
/** 전광판을 연 기기. 시연장 아이패드는 한 번만 넣으면 탭이 새로 열려도 다시 묻지 않는다 */
const DEVICE_KEY = 'fitmate-board-unlocked'

/** session = 이 탭에서만, device = 이 기기에서 계속 (같은 탭에서 운영 화면을 열었어도 통과) */
export type AdminGateScope = 'session' | 'device'

function readFlag(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(storage: () => Storage, key: string) {
  try {
    storage().setItem(key, '1')
  } catch {
    /* 저장이 막혀 있으면 이번 화면에서만 연다 */
  }
}

function isUnlockedFor(scope: AdminGateScope) {
  // 개발 모드에서 암호를 안 정했으면 바로 연다. 배포에서는 암호가 없으면 닫아 둔다
  if (PASSWORD === '') return import.meta.env.DEV
  if (readFlag(() => sessionStorage, SESSION_KEY)) return true
  return scope === 'device' && readFlag(() => localStorage, DEVICE_KEY)
}

interface Props {
  scope: AdminGateScope
  title: string
  children: ReactNode
}

export default function AdminGate({ scope, title, children }: Props) {
  const nav = useNavigate()
  const [isUnlocked, setIsUnlocked] = useState(() => {
    const isOpen = isUnlockedFor(scope)
    // 운영 화면에서 넘어온 기기도 전광판은 다음부터 바로 열리게 기억한다
    if (isOpen && scope === 'device' && PASSWORD !== '') writeFlag(() => localStorage, DEVICE_KEY)
    return isOpen
  })
  const [input, setInput] = useState('')
  const [isWrong, setIsWrong] = useState(false)

  if (isUnlocked) return <>{children}</>

  if (PASSWORD === '') {
    return (
      <CenterMessage
        title={`${title}이 닫혀 있어요`}
        desc="배포 환경변수 VITE_ADMIN_PASSWORD에 암호를 정하면 열 수 있어요."
        action={<button className="btn btn-primary" onClick={() => nav('/')}>처음 화면으로</button>}
      />
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input !== PASSWORD) {
      setIsWrong(true)
      return
    }
    writeFlag(() => sessionStorage, SESSION_KEY)
    if (scope === 'device') writeFlag(() => localStorage, DEVICE_KEY)
    setIsUnlocked(true)
  }

  return (
    <Backdrop isDim>
      <Logo isLight />
      <div className="backdrop-body is-center">
        <form className="loading-card" style={{ minHeight: 320 }} onSubmit={handleSubmit}>
          <h1 className="t-h2">{title}</h1>
          <p className="t-soft">운영 암호를 입력해 주세요.</p>
          <input
            className="input"
            type="password"
            autoFocus
            autoComplete="off"
            aria-label="운영 암호"
            aria-invalid={isWrong}
            placeholder="암호"
            value={input}
            onChange={(e) => { setInput(e.target.value); setIsWrong(false) }}
            style={{ width: 280, textAlign: 'center' }}
          />
          <p className="t-small" role="alert" style={{ minHeight: 18, color: 'var(--c-effort)' }}>{isWrong ? '암호가 맞지 않아요.' : ''}</p>
          <div className="row center" style={{ gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => nav('/')}>처음 화면으로</button>
            <button type="submit" className="btn btn-primary" disabled={input === ''}>열기</button>
          </div>
        </form>
      </div>
    </Backdrop>
  )
}
