// 친구 운동방 고르기 (이슈 #40, F-STRTHT 확장).
// 들어갈 방 순서: 주소의 ?room= → 초대 링크로 받은 방 → 마지막으로 들어간 방 → 방이 하나뿐이면 그 방 → 방 고르기 화면.
// 방을 고르면 주소에 ?room=을 남겨 새로고침해도 같은 방으로 간다.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { services } from '../../services'
import { useApp } from '../../store/app'
import type { FriendRoom, Profile } from '../../types/domain'
import { PROVISIONAL_MAX_ROOMS } from '../../config/provisional'
import EnterLoading from '../EnterLoading'
import Backdrop from '../Backdrop'
import { CenterMessage, Logo, ProvisionalBadge } from '../ui'

export interface RoomActions {
  /** 방 고르기 화면으로 (다른 방으로 옮기거나 새 방 만들기) */
  pick: () => void
  /** 방에서 완전히 나간다. 다음에는 방을 다시 고른다 */
  leave: () => void
}

type Resolved =
  | { kind: 'loading' }
  | { kind: 'picking' }
  | { kind: 'room'; room: FriendRoom }
  /** wasRemembered: 기억해 둔 방이 사라진 경우 */
  | { kind: 'notFound'; wasRemembered: boolean }
  | { kind: 'error' }

export default function RoomGate({ profile, render }: { profile: Profile; render: (room: FriendRoom, actions: RoomActions) => ReactNode }) {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const roomParam = params.get('room')
  const isPicking = params.get('pick') === '1'
  const [resolved, setResolved] = useState<Resolved>({ kind: 'loading' })
  const [retryKey, setRetryKey] = useState(0)
  /** 이미 찾은 방. 주소에 ?room=을 남길 때 다시 찾느라 운동방이 다시 열리지 않게 한다 */
  const resolvedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (isPicking) return
    if (roomParam && roomParam === resolvedIdRef.current) return
    // 늦게 도착한 결과를 버리기 위한 표시
    const life = { isAlive: true }
    const { invitedRoomId, setInvitedRoomId } = useApp.getState()
    const resolve = async (): Promise<Resolved> => {
      const fromUrl = roomParam ?? invitedRoomId
      const remembered = fromUrl ? null : await services.rooms.getLast(profile.userId)
      let target = fromUrl ?? remembered
      if (!target) {
        // 방이 하나뿐이면 고르는 단계 없이 바로 들어간다 (지정 운동방 바로 입장, F-STRTHT)
        const list = await services.rooms.list()
        if (list.length === 1) target = list[0].roomId
        else return { kind: 'picking' }
      }
      const room = await services.rooms.get(target)
      if (!room) {
        // 사라진 방을 계속 기억하면 매번 같은 안내만 보게 되므로 잊는다
        if (remembered) await services.rooms.leave(profile.userId)
        return { kind: 'notFound', wasRemembered: !!remembered }
      }
      return { kind: 'room', room }
    }
    setResolved({ kind: 'loading' })
    resolve()
      .then((r) => {
        if (!life.isAlive) return
        resolvedIdRef.current = r.kind === 'room' ? r.room.roomId : null
        setResolved(r)
        if (invitedRoomId) setInvitedRoomId(null)
        // 새로고침·초대 링크 복사 때 같은 방이 되도록 주소에 방 ID를 남긴다
        if (r.kind === 'room' && roomParam !== r.room.roomId) setParams({ room: r.room.roomId }, { replace: true })
      })
      .catch(() => life.isAlive && setResolved({ kind: 'error' }))
    return () => {
      life.isAlive = false
    }
  }, [roomParam, isPicking, profile.userId, retryKey, setParams])

  const currentRoomId = resolved.kind === 'room' ? resolved.room.roomId : roomParam
  const pick = () => setParams(currentRoomId ? { room: currentRoomId, pick: '1' } : { pick: '1' })
  const select = (roomId: string) => setParams({ room: roomId })
  const leave = () => {
    services.rooms.leave(profile.userId).finally(() => nav('/home'))
  }

  if (isPicking || resolved.kind === 'picking') {
    return (
      <RoomPicker
        currentRoomId={isPicking ? currentRoomId : null}
        defaultName={`${profile.nickname}의 운동방`}
        onSelect={select}
        onCancel={isPicking && currentRoomId ? () => select(currentRoomId) : undefined}
      />
    )
  }
  if (resolved.kind === 'loading') {
    return <EnterLoading theme="friend" steps={[{ label: '오늘의 루틴 불러오기', isDone: true }, { label: '친구 운동방 찾는 중', isDone: false }]} />
  }
  if (resolved.kind === 'error') {
    return (
      <CenterMessage
        title="운동방 정보를 불러오지 못했어요"
        desc="네트워크를 확인한 뒤 다시 시도해 주세요."
        action={<>
          <button className="btn btn-secondary" onClick={() => nav('/home')}>홈으로</button>
          <button className="btn btn-primary" onClick={() => setRetryKey((k) => k + 1)}>다시 시도</button>
        </>}
      />
    )
  }
  if (resolved.kind === 'notFound') {
    return (
      <CenterMessage
        title={resolved.wasRemembered ? '지난번 운동방이 없어졌어요' : '운동방을 찾을 수 없어요'}
        desc={resolved.wasRemembered ? '방이 삭제됐어요. 다른 방을 골라 주세요.' : '방이 삭제됐거나 초대 주소가 잘못됐어요. 다른 방을 골라 주세요.'}
        action={<>
          <button className="btn btn-secondary" onClick={() => nav('/home')}>홈으로</button>
          <button className="btn btn-primary" onClick={() => setParams({ pick: '1' })}>다른 방 고르기</button>
        </>}
      />
    )
  }
  return render(resolved.room, { pick, leave })
}

const NAME_MAX = 20

function RoomPicker({ currentRoomId, defaultName, onSelect, onCancel }: {
  currentRoomId: string | null
  defaultName: string
  onSelect: (roomId: string) => void
  onCancel?: () => void
}) {
  const nav = useNavigate()
  const [rooms, setRooms] = useState<FriendRoom[] | null>(null)
  const [hasError, setHasError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const life = { isAlive: true }
    services.rooms
      .list()
      .then((list) => life.isAlive && setRooms(list))
      .catch(() => life.isAlive && setHasError(true))
    return () => {
      life.isAlive = false
    }
  }, [retryKey])

  const canCreate = services.rooms.canCreate
  const isAtLimit = !!rooms && rooms.length >= PROVISIONAL_MAX_ROOMS

  const handleCreate = async () => {
    const trimmed = (name.trim() || defaultName).slice(0, NAME_MAX)
    setIsCreating(true)
    setCreateError(null)
    try {
      const room = await services.rooms.create({ name: trimmed })
      onSelect(room.roomId)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '방을 만들지 못했어요. 다시 시도해 주세요.')
      setIsCreating(false)
    }
  }

  return (
    <Backdrop theme="friend" isDim>
      <Logo isLight />
      <div className="backdrop-body is-center">
        <div className="loading-card" style={{ width: 520, minHeight: 0, justifyContent: 'flex-start', alignItems: 'stretch', textAlign: 'left' }}>
          <div className="col" style={{ gap: 6, textAlign: 'center' }}>
            <h1 className="t-h2">어느 운동방에 들어갈까요?</h1>
            <p className="t-soft">한 번 들어간 방은 다음에도 바로 들어가요. 방마다 최대 5명이에요.</p>
          </div>

          {hasError && (
            <div className="col center" style={{ gap: 10 }} role="alert">
              <p className="t-soft">운동방 목록을 불러오지 못했어요.</p>
              <button className="btn btn-primary btn-sm" onClick={() => { setHasError(false); setRetryKey((k) => k + 1) }}>다시 시도</button>
            </div>
          )}
          {!hasError && !rooms && <p className="t-soft" role="status" style={{ textAlign: 'center' }}>운동방 목록을 불러오는 중…</p>}
          {rooms && rooms.length === 0 && (
            <p className="t-soft" style={{ textAlign: 'center' }}>{canCreate ? '열린 운동방이 없어요. 새 방을 만들어 주세요.' : '열린 운동방이 없어요. 운영진에게 알려 주세요.'}</p>
          )}
          {rooms && rooms.length > 0 && (
            <ul className="col" style={{ gap: 8, listStyle: 'none', padding: 0, margin: 0, maxHeight: 300, overflowY: 'auto' }} aria-label="운동방 목록">
              {rooms.map((r) => (
                <li key={r.roomId}>
                  <button
                    className={`btn ${r.roomId === currentRoomId ? 'btn-primary' : 'btn-secondary'} btn-block`}
                    style={{ justifyContent: 'space-between' }}
                    onClick={() => onSelect(r.roomId)}
                  >
                    <span>{r.name}{r.roomId === currentRoomId && ' (지금 방)'}</span>
                    <span className="t-small">최대 {r.capacity}명 &gt;</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {canCreate && rooms && (
            <form className="col" style={{ gap: 8, marginTop: 4 }} onSubmit={(e) => { e.preventDefault(); handleCreate() }}>
              <label className="t-small t-soft" htmlFor="room-name">새 방 만들기</label>
              <div className="row" style={{ gap: 8 }}>
                <input
                  id="room-name"
                  className="input"
                  style={{ height: 48, fontSize: 16 }}
                  placeholder={defaultName}
                  maxLength={NAME_MAX}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isAtLimit || isCreating}
                />
                <button className="btn btn-primary" style={{ flex: 'none' }} disabled={isAtLimit || isCreating}>{isCreating ? '만드는 중…' : '만들기'}</button>
              </div>
              {isAtLimit && <p className="t-small t-soft">운동방은 최대 {PROVISIONAL_MAX_ROOMS}개까지 만들 수 있어요. 있는 방에 들어가 주세요.</p>}
              <span style={{ alignSelf: 'flex-start' }}><ProvisionalBadge>방 개수 상한 임시</ProvisionalBadge></span>
              {createError && <p className="t-small" role="alert" style={{ color: '#ffb3c1' }}>{createError}</p>}
            </form>
          )}

          <div className="row center" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={() => nav('/home')}>홈으로</button>
            {onCancel && <button className="btn btn-secondary" onClick={onCancel}>지금 방으로 돌아가기</button>}
          </div>
        </div>
      </div>
    </Backdrop>
  )
}
