// 운동 중 아래쪽 패널 세 개 (Figma 운동 진행 시안).
// [지금 운동 · 횟수 링 · 내 카메라] [AI 코치 피드백] [다음 운동]
import type { ReactNode } from 'react'
import type { ExerciseRecord } from '../../types/domain'
import { photoOf } from '../../config/exercises'
import { CameraPreview } from '../ui'
import ProgressRing from './ProgressRing'
import starIcon from '../../assets/icons/star.png'
import checkGreen from '../../assets/icons/check-green.png'
import checkGray from '../../assets/icons/check-gray.png'

type Note = ExerciseRecord['postureNotes'][number]

interface Props {
  exerciseId: string
  name: string
  desc: string
  /** 링 아래·이름 옆 보조 정보 (예: '세트 1 / 3') */
  meta?: ReactNode
  ring: { value: number; max?: number; unit: string }
  stream: MediaStream | null
  isCameraOn: boolean
  notes: Note[]
  next: { exerciseId: string; name: string; amount: string } | null
  /** 지금 운동 패널의 버튼들 (자세 가이드·일시정지 등) */
  controls: ReactNode
  /** 다음 운동 패널 아래 버튼들 (다음 세트·운동 끝내기) */
  nextAction: ReactNode
  /** [개발용] 버튼. 패널 바깥 위쪽에 띄운다 */
  devTools?: ReactNode
}

function Photo({ exerciseId, name, width, height }: { exerciseId: string; name: string; width: number; height: number }) {
  const src = photoOf(exerciseId)
  if (src) return <img src={src} alt={`${name} 동작`} style={{ width, height, objectFit: 'cover', borderRadius: 10, flex: 'none' }} />
  // 사진이 없는 운동은 기본 그림
  return (
    <div className="col center" style={{ width, height, borderRadius: 10, flex: 'none', background: 'rgba(255,255,255,0.12)', gap: 6 }}>
      <img src={starIcon} alt="" width={32} height={32} />
      <span className="t-xs t-soft">{name}</span>
    </div>
  )
}

export default function WorkoutHud({ exerciseId, name, desc, meta, ring, stream, isCameraOn, notes, next, controls, nextAction, devTools }: Props) {
  const recent = notes.slice(-3)
  return (
    <div className="row" style={{ position: 'absolute', left: 12, right: 12, bottom: 14, gap: 6, height: 192, alignItems: 'stretch' }}>
      {devTools && <div className="row" style={{ position: 'absolute', left: 4, bottom: '100%', marginBottom: 8, gap: 6 }}>{devTools}</div>}
      {/* 지금 운동 */}
      <section className="glass is-lined row" style={{ flex: 1, minWidth: 0, gap: 20, padding: '14px 16px' }} aria-label="지금 하는 운동">
        <Photo exerciseId={exerciseId} name={name} width={180} height={158} />
        <div className="col grow" style={{ gap: 6 }}>
          <h2 className="t-h2" style={{ fontSize: 24 }}>{name}</h2>
          <p className="t-small t-muted clamp-2" style={{ lineHeight: 1.45 }}>{desc}</p>
          {meta && <span className="t-xs t-soft">{meta}</span>}
          <div className="row" style={{ gap: 6, marginTop: 6 }}>{controls}</div>
        </div>
        <ProgressRing value={ring.value} max={ring.max} unit={ring.unit} />
        <div className="camera-off" style={{ width: 210, flex: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="camera-off-inner camera-box" style={{ flex: 1, background: 'var(--c-camera-off-inner)' }}>
            <span className="chip-light camera-box-chip" style={{ left: 8, top: 8 }}>
              <i className={`dot ${isCameraOn ? 'is-online' : ''}`} style={{ display: 'inline-block', marginRight: 4 }} />
              {isCameraOn ? '카메라 켜짐' : '카메라 꺼짐'}
            </span>
            <CameraPreview stream={stream} emptyText="카메라를 켜면 내 동작이 캐릭터에 반영됩니다." />
          </div>
          <span className="t-xs t-soft" style={{ fontSize: 8 }}>영상은 내 브라우저 안에서만 쓰여요</span>
        </div>
      </section>

      {/* AI 코치 피드백 (F-WLBEFJ: 측정된 피드백만) */}
      <section className="glass is-lined col" style={{ width: 295, flex: 'none', gap: 10 }} aria-label="AI 코치 피드백">
        <h2 className="t-body t-soft" style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.4)' }}>AI 코치 피드백</h2>
        {recent.length === 0 ? (
          <p className="t-small t-soft" style={{ lineHeight: 1.5 }}>동작을 인식하면 여기에 자세 피드백이 표시돼요.</p>
        ) : (
          <ul className="list-plain col" style={{ gap: 10 }}>
            {recent.map((n, i) => (
              <li key={`${n.text}-${i}`} className="row" style={{ gap: 8 }}>
                <img src={n.kind === 'good' ? checkGreen : checkGray} alt="" width={18} height={18} />
                <span style={{ fontSize: 15, fontWeight: 700, color: n.kind === 'good' ? '#fff' : 'var(--c-text-soft)' }}>{n.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 다음 운동 */}
      <section className="glass is-lined col" style={{ width: 249, flex: 'none', gap: 10 }} aria-label="다음 운동">
        <h2 className="t-body t-soft" style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.4)' }}>다음 운동</h2>
        <div className="row" style={{ gap: 10, flex: 1 }}>
          {next ? (
            <>
              <Photo exerciseId={next.exerciseId} name={next.name} width={86} height={80} />
              <div className="col center grow" style={{ gap: 4 }}>
                <strong style={{ fontSize: 17 }}>{next.name}</strong>
                <span className="t-xs t-soft">{next.amount}</span>
              </div>
            </>
          ) : (
            <p className="t-small t-soft">마지막 운동이에요. 끝까지 힘내요!</p>
          )}
        </div>
        <div className="row" style={{ gap: 6 }}>{nextAction}</div>
      </section>
    </div>
  )
}
