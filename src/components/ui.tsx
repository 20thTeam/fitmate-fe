// 여러 화면이 같이 쓰는 작은 UI 조각 (Figma 시안 기준). 스타일은 styles/components.css.
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { characterGradient } from '../config/characters'
import Backdrop from './Backdrop'

export function Logo({ isLight = false, isInline = false }: { isLight?: boolean; isInline?: boolean }) {
  return (
    <Link to="/home" className={`logo ${isLight ? 'is-light' : ''} ${isInline ? 'logo-inline' : ''}`}>
      FITMATE
    </Link>
  )
}

/** 밝은 분홍 모달 (프로필·초대·확인 창) */
export function Modal({ children, onClose, label }: { children: ReactNode; onClose?: () => void; label?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal aria-label={label} onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button className="sheet-close" aria-label="닫기" onClick={onClose}>X</button>
        )}
        {children}
      </div>
    </div>
  )
}

/** 결과·기록 화면의 숫자 카드 */
export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card stat-card">
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">{value}</span>
      {sub && <span className="stat-card-sub">{sub}</span>}
    </div>
  )
}

/** 친구 목록의 네모 아바타 */
export function Avatar({ characterId, name }: { characterId: string; name: string }) {
  return (
    <span className="avatar" style={{ background: characterGradient(characterId) }} aria-hidden>
      {name.slice(0, 1)}
    </span>
  )
}

/** PM 승인 전 임시 규칙으로 만든 값 표시 (PL-TGNVCJ) */
export function ProvisionalBadge({ children = '시연용 임시' }: { children?: ReactNode }) {
  return <span className="chip chip-provisional">{children}</span>
}

/** 로딩·오류·빈 화면에 쓰는 가운데 카드 */
export function CenterMessage({ title, desc, action, theme = 'friend' }: { title: string; desc?: string; action?: ReactNode; theme?: 'friend' | 'public' }) {
  return (
    <Backdrop theme={theme} isDim>
      <Logo isLight />
      <div className="backdrop-body is-center">
        <div className="loading-card" style={{ minHeight: 320 }} role="status">
          <h1 className="t-h2">{title}</h1>
          {desc && <p className="t-soft" style={{ lineHeight: 1.5 }}>{desc}</p>}
          {action && <div className="row center wrap" style={{ marginTop: 8 }}>{action}</div>}
        </div>
      </div>
    </Backdrop>
  )
}

/** 카메라 미리보기. 영상은 화면에만 그리고 어디로도 보내지 않는다 (PL-XJUIRF). */
export function CameraPreview({ stream, emptyText = '카메라를 켜면 내 동작이 보여요' }: { stream: MediaStream | null; emptyText?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream
      if (stream) ref.current.play().catch(() => {})
    }
  }, [stream])
  if (!stream) return <span className="t-small t-soft">{emptyText}</span>
  return <video ref={ref} muted playsInline />
}

/** 진행 막대 (0~1) */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
