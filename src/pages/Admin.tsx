import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { services, type AdminPublicParty, type AdminRoom } from '../services'
import type { PublicPartyMode } from '../types/domain'
import { sunsetOpenLabel } from '../lib/sunset'
import { useApp } from '../store/app'
import Backdrop from '../components/Backdrop'
import { CenterMessage, Logo } from '../components/ui'

// 운영 화면. manyfast 기획에 없는 화면이라 기능 ID가 없다.
// 서버에 운영용 API가 없어서 지금 있는 공개 API(운동방·팀 경험치)와 이 브라우저 정보만 보여준다.
// 전체 참가자·전체 기록·접속자는 값을 지어내지 않고 '준비 중'으로 둔다.

const PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? ''
const UNLOCK_KEY = 'fitmate-admin-unlocked'

function readUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

interface Status {
  rooms: AdminRoom[]
  /** 운동방과 팀 경험치를 받아오는 데 걸린 시간 */
  elapsedMs: number
  checkedAt: number
}

/** 이 브라우저 참가자의 기록 수. 'failed'는 조회 실패, null은 불러오는 중 */
type RecordCount = number | 'failed' | null

function teamXpLabel(room: AdminRoom) {
  if (!room.team) return <span className="t-muted">불러오지 못했어요</span>
  if (room.team.totalXp === null) return <span className="t-muted">산정 기준 준비 중</span>
  const level = room.team.level === null ? '' : `Lv.${room.team.level} · `
  const next = room.team.nextLevelXp === null ? '' : ` / 다음 레벨 ${room.team.nextLevelXp.toLocaleString()}XP`
  return `${level}${room.team.totalXp.toLocaleString()}XP${next}`
}

function Pending({ children }: { children: ReactNode }) {
  return (
    <p className="t-soft" style={{ padding: '18px 0', textAlign: 'center', lineHeight: 1.6 }}>
      <span className="chip chip-ghost" style={{ marginRight: 8 }}>서버 API 준비 중</span>
      {children}
    </p>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="col" style={{ gap: 4, minWidth: 160 }}>
      <span className="t-small t-soft">{label}</span>
      <span style={{ fontSize: 18, fontWeight: 600 }}>{children}</span>
    </div>
  )
}

const ROOM_COLUMNS = '0.5fr 1.4fr 0.7fr 1.2fr 2fr 1.2fr'

// 서버 운영 키. 배포 파일에 넣으면 누구나 볼 수 있어서 운영자가 입력하고, 탭을 닫으면 잊는다
const ADMIN_KEY_KEY = 'fitmate-admin-key'

function readAdminKey() {
  try {
    return sessionStorage.getItem(ADMIN_KEY_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveAdminKey(key: string) {
  try {
    if (key) sessionStorage.setItem(ADMIN_KEY_KEY, key)
    else sessionStorage.removeItem(ADMIN_KEY_KEY)
  } catch {
    /* 저장이 막혀 있으면 이번 화면에서만 쓴다 */
  }
}

const MODE_BUTTONS: { mode: PublicPartyMode; label: string }[] = [
  { mode: 'AUTO', label: '운영 시각대로' },
  { mode: 'OPEN', label: '지금 열기' },
  { mode: 'CLOSED', label: '닫기' },
]

const MODE_LABEL: Record<PublicPartyMode, string> = {
  AUTO: '운영 시각대로',
  OPEN: '운영자가 열어 둠',
  CLOSED: '운영자가 닫아 둠',
}

const formatKst = (t: number) => new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** 서버 오류를 운영자가 할 일로 바꿔 말한다 */
const errorStatus = (e: unknown) => (typeof e === 'object' && e !== null && 'status' in e ? (e as { status: unknown }).status : 0)

function adminErrorMessage(e: unknown) {
  const status = errorStatus(e)
  if (status === 401) return '운영 키가 맞지 않아요. 다시 입력해 주세요.'
  if (status === 403) return '서버에 운영 키가 설정되지 않았어요. BE에 서버 ADMIN_KEY 설정을 요청해 주세요.'
  return '공개 운동방 상태를 불러오지 못했어요. 서버가 켜져 있는지 확인해 주세요.'
}

/** 'missing' = 서버에 이 운영 API가 아직 없음 */
type PartyState = AdminPublicParty | 'missing' | null

/** 공개 운동방 열기·닫기 (#31). 시연 시간이 운영 시각과 다를 때 쓴다 */
function PublicPartyPanel() {
  const needsKey = services.admin.needsAdminKey
  const [adminKey, setAdminKey] = useState(() => (needsKey ? readAdminKey() : ''))
  const [keyInput, setKeyInput] = useState('')
  const [party, setParty] = useState<PartyState>(null)
  const [isLoading, setIsLoading] = useState(() => !needsKey || readAdminKey() !== '')
  const [savingMode, setSavingMode] = useState<PublicPartyMode | null>(null)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const hasKey = !needsKey || adminKey !== ''

  useEffect(() => {
    if (!hasKey) return
    const ctrl = new AbortController()
    const isStale = () => ctrl.signal.aborted
    services.admin
      .getPublicParty(adminKey)
      .then((p) => !isStale() && setParty(p ?? 'missing'))
      .catch((e: unknown) => {
        if (isStale()) return
        setError(adminErrorMessage(e))
        setParty(null)
        // 키가 틀렸으면 입력 칸으로 돌아간다
        if (errorStatus(e) === 401) {
          saveAdminKey('')
          setAdminKey('')
        }
      })
      .finally(() => !isStale() && setIsLoading(false))
    return () => ctrl.abort()
  }, [adminKey, hasKey, retryKey])

  const handleKeySubmit = (e: FormEvent) => {
    e.preventDefault()
    saveAdminKey(keyInput)
    setAdminKey(keyInput)
    setKeyInput('')
    setIsLoading(true)
    setError('')
  }

  const handleRefresh = () => {
    setIsLoading(true)
    setError('')
    setRetryKey((k) => k + 1)
  }

  const handleForgetKey = () => {
    saveAdminKey('')
    setAdminKey('')
    setParty(null)
    setError('')
  }

  const handleSetMode = async (mode: PublicPartyMode) => {
    setSavingMode(mode)
    setError('')
    try {
      setParty(await services.admin.setPublicPartyMode(mode, adminKey))
    } catch (e) {
      setError(adminErrorMessage(e))
      if (errorStatus(e) === 401) {
        saveAdminKey('')
        setAdminKey('')
      }
    } finally {
      setSavingMode(null)
    }
  }

  const loaded = party && party !== 'missing' ? party : null
  const status = loaded?.status

  return (
    <section className="card col" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>공개 운동방</h2>
        <div className="row" style={{ gap: 8 }}>
          {needsKey && adminKey && <button className="btn btn-secondary btn-sm" onClick={handleForgetKey}>운영 키 지우기</button>}
          {hasKey && <button className="btn btn-secondary btn-sm" disabled={isLoading} onClick={handleRefresh}>{isLoading ? '확인 중…' : '새로고침'}</button>}
        </div>
      </div>
      <p className="t-small t-soft">{sunsetOpenLabel()}. 시연 시간이 다르면 여기서 열고 닫아요. 닫아도 이미 들어와 운동 중인 사람의 기록은 끝까지 저장돼요.</p>

      {!hasKey ? (
        <form className="row wrap" style={{ gap: 12, alignItems: 'center' }} onSubmit={handleKeySubmit}>
          <input
            className="input"
            type="password"
            autoComplete="off"
            aria-label="서버 운영 키"
            placeholder="서버 운영 키"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            style={{ width: 280 }}
          />
          <button type="submit" className="btn btn-primary" disabled={keyInput === ''}>확인</button>
          <span className="t-small t-soft">서버 ADMIN_KEY와 같은 값이에요. 이 탭을 닫으면 다시 물어요.</span>
        </form>
      ) : party === 'missing' ? (
        <Pending>공개 운동방 운영 API(GET·PUT /api/admin/public-party)가 서버에 생기면 여기서 열고 닫을 수 있어요.</Pending>
      ) : isLoading && !loaded ? (
        <p className="t-soft" style={{ padding: '18px 0', textAlign: 'center' }}>공개 운동방 상태를 불러오는 중…</p>
      ) : (
        <>
          {status && (
            <div className="row wrap" style={{ gap: 32 }} role="status">
              <Field label="지금 상태">{status.isOpen ? <span className="chip chip-good">열림</span> : <span className="chip chip-ghost">닫힘</span>}</Field>
              <Field label="운영 방식">{MODE_LABEL[loaded.mode]}</Field>
              <Field label={status.isOpen ? '닫는 시각' : '다음 오픈'}>
                {status.isOpen ? (status.closesAt === null ? '운영자가 닫을 때까지' : formatKst(status.closesAt)) : formatKst(status.nextOpenAt)}
              </Field>
              <Field label="참가 인원">{status.participantCount === null ? <span className="t-muted">-</span> : `${status.participantCount}명`}</Field>
            </div>
          )}
          <div className="row wrap" style={{ gap: 12 }}>
            {MODE_BUTTONS.map(({ mode, label }) => (
              <button
                key={mode}
                className={`btn ${loaded?.mode === mode ? 'btn-primary' : 'btn-secondary'}`}
                aria-pressed={loaded?.mode === mode}
                disabled={!loaded || savingMode !== null}
                onClick={() => handleSetMode(mode)}
              >
                {savingMode === mode ? '바꾸는 중…' : label}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="t-small" role="alert" style={{ color: 'var(--c-effort)' }}>{error}</p>}
    </section>
  )
}

function Dashboard() {
  const nav = useNavigate()
  const profile = useApp((s) => s.profile)
  const [status, setStatus] = useState<Status | null>(null)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)
  const [recordCount, setRecordCount] = useState<RecordCount>(null)
  const isHttp = services.admin.backend === 'http'

  useEffect(() => {
    // 새로고침을 연달아 누르면 늦게 온 이전 응답은 버린다
    const ctrl = new AbortController()
    const isStale = () => ctrl.signal.aborted
    const startedAt = performance.now()
    services.admin
      .listRooms()
      .then((rooms) => {
        if (isStale()) return
        setStatus({ rooms, elapsedMs: Math.round(performance.now() - startedAt), checkedAt: Date.now() })
        setHasError(false)
      })
      .catch(() => !isStale() && setHasError(true))
      .finally(() => !isStale() && setIsLoading(false))
    return () => ctrl.abort()
  }, [retryKey])

  useEffect(() => {
    if (!profile) return
    const ctrl = new AbortController()
    const isStale = () => ctrl.signal.aborted
    services.record
      .listSessions(profile.userId)
      .then((list) => !isStale() && setRecordCount(list.length))
      .catch(() => !isStale() && setRecordCount('failed'))
    return () => ctrl.abort()
  }, [profile, retryKey])

  const handleRefresh = () => {
    setIsLoading(true)
    setRecordCount(null)
    setRetryKey((k) => k + 1)
  }

  const handleClearDevice = async () => {
    const isConfirmed = window.confirm('이 브라우저에 보관한 참가자·루틴·기록을 지워요. 서버에 저장된 데이터는 그대로 남고, 이 브라우저는 새 참가자로 다시 시작해요. 지울까요?')
    if (!isConfirmed) return
    await services.admin.clearDevice()
    // 메모리에 남은 프로필·연결까지 비우려고 새로 불러온다
    window.location.assign('/profile')
  }

  const connection = !isHttp ? (
    <span className="chip chip-ghost">로컬 모드 (서버 연결 안 함)</span>
  ) : isLoading ? (
    <span className="t-soft">확인 중…</span>
  ) : hasError ? (
    <span className="chip chip-effort">연결 실패</span>
  ) : (
    <span className="chip chip-good">연결됨</span>
  )

  return (
    <Backdrop isDim>
      <Logo isLight />
      <div className="backdrop-body is-narrow" style={{ gap: 14 }}>
        <div className="col center" style={{ gap: 8, marginTop: 44, marginBottom: 10 }}>
          <h1 className="t-display">운영 화면</h1>
          <p className="t-small t-soft">시연 운영용이에요. 기획(manyfast)에 없는 화면이고 메뉴에는 나오지 않아요.</p>
        </div>

        <section className="card col" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>서버 연결</h2>
            <button className="btn btn-secondary" disabled={isLoading} onClick={handleRefresh}>{isLoading ? '확인 중…' : '새로고침'}</button>
          </div>
          <div className="row wrap" style={{ gap: 32 }} role="status">
            <Field label="상태">{connection}</Field>
            <Field label="백엔드">{isHttp ? '팀 서버 (http)' : '브라우저 안 (local)'}</Field>
            <Field label="운동방·팀 조회 시간">{isHttp && status && !hasError ? `${status.elapsedMs.toLocaleString()}ms` : <span className="t-muted">-</span>}</Field>
            <Field label="마지막 확인">{status ? new Date(status.checkedAt).toLocaleTimeString('ko-KR') : <span className="t-muted">-</span>}</Field>
          </div>
        </section>

        <PublicPartyPanel />

        <section className="card col" style={{ gap: 8 }}>
          <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>운동방</h2>
          {isLoading && !status ? (
            <p className="t-soft" style={{ padding: '18px 0', textAlign: 'center' }}>운동방을 불러오는 중…</p>
          ) : hasError ? (
            <div className="col center" style={{ gap: 12, padding: '18px 0' }}>
              <p className="t-soft">운동방을 불러오지 못했어요. 서버가 켜져 있는지 확인해 주세요.</p>
              <button className="btn btn-primary" disabled={isLoading} onClick={handleRefresh}>다시 시도</button>
            </div>
          ) : !status || status.rooms.length === 0 ? (
            <p className="t-soft" style={{ padding: '18px 0', textAlign: 'center' }}>
              {isHttp ? '서버에 등록된 운동방이 없어요.' : '로컬 모드에는 서버 운동방이 없어요. 운동방은 같은 브라우저 탭끼리만 연결돼요.'}
            </p>
          ) : (
            <div role="table" aria-label="운동방 목록" className="col" style={{ gap: 0 }}>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: ROOM_COLUMNS, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: 'var(--c-th)', textAlign: 'center' }}>
                <span role="columnheader">방 번호</span><span role="columnheader">이름</span><span role="columnheader">정원</span><span role="columnheader">팀</span><span role="columnheader">팀 경험치</span><span role="columnheader">지금 접속자</span>
              </div>
              <div className="dashed-list" style={{ borderTop: '1px dashed rgba(255,255,255,0.55)', borderBottom: '1px dashed rgba(255,255,255,0.55)' }}>
                {status.rooms.map((room) => (
                  <div key={room.roomId} role="row" style={{ display: 'grid', gridTemplateColumns: ROOM_COLUMNS, padding: '10px 12px', fontSize: 15, textAlign: 'center', alignItems: 'center' }}>
                    <span role="cell">{room.roomId}</span>
                    <span role="cell">{room.name}</span>
                    <span role="cell">{room.capacity}명</span>
                    <span role="cell">{room.teamName}</span>
                    <span role="cell">{teamXpLabel(room)}</span>
                    <span role="cell" className="t-muted">서버 API 준비 중</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card col" style={{ gap: 14 }}>
          <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>이 브라우저의 참가자</h2>
          {profile ? (
            <div className="row wrap" style={{ gap: 32 }}>
              <Field label="닉네임">{profile.nickname}</Field>
              <Field label="참가자 번호">{profile.userId}</Field>
              <Field label="운동 기록">
                {recordCount === null ? <span className="t-soft">불러오는 중…</span> : recordCount === 'failed' ? <span className="t-muted">불러오지 못했어요</span> : `${recordCount}건`}
              </Field>
            </div>
          ) : (
            <p className="t-soft">이 브라우저에는 아직 참가자가 없어요.</p>
          )}
          <div className="row wrap" style={{ gap: 12, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={handleClearDevice}>이 브라우저 데이터 지우기</button>
            <span className="t-small t-soft">시연 전에 새 참가자로 다시 시작할 때 써요. 서버에 저장된 참가자·기록은 지워지지 않아요.</span>
          </div>
        </section>

        <section className="card col" style={{ gap: 4 }}>
          <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>전체 참가자</h2>
          <Pending>참가자 목록 API가 생기면 닉네임·캐릭터·들어간 방을 여기에 보여줘요.</Pending>
        </section>

        <section className="card col" style={{ gap: 4 }}>
          <h2 className="t-h3" style={{ color: 'var(--c-title-soft)' }}>전체 운동 기록</h2>
          <Pending>기록 목록 API가 생기면 참가자별 운동 시간·유효 횟수·적립 경험치를 여기에 보여줘요.</Pending>
        </section>

        <div className="row center" style={{ marginTop: 8 }}>
          <button className="btn btn-secondary btn-lg" style={{ width: 306, height: 64 }} onClick={() => nav('/')}>처음 화면으로</button>
        </div>
      </div>
    </Backdrop>
  )
}

export default function Admin() {
  const nav = useNavigate()
  // 개발 모드에서 암호를 안 정했으면 바로 연다. 배포에서는 암호가 없으면 닫아 둔다
  const [isUnlocked, setIsUnlocked] = useState(() => (PASSWORD === '' ? import.meta.env.DEV : readUnlocked()))
  const [input, setInput] = useState('')
  const [isWrong, setIsWrong] = useState(false)

  if (isUnlocked) return <Dashboard />

  if (PASSWORD === '') {
    return (
      <CenterMessage
        title="운영 화면이 닫혀 있어요"
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
    try {
      // 탭을 닫으면 다시 묻도록 세션에만 둔다
      sessionStorage.setItem(UNLOCK_KEY, '1')
    } catch {
      /* 저장이 막혀 있으면 이번 화면에서만 연다 */
    }
    setIsUnlocked(true)
  }

  return (
    <Backdrop isDim>
      <Logo isLight />
      <div className="backdrop-body is-center">
        <form className="loading-card" style={{ minHeight: 320 }} onSubmit={handleSubmit}>
          <h1 className="t-h2">운영 화면</h1>
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
