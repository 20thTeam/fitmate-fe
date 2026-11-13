// 운동 중 오른쪽 위 내 카메라. 영상은 이 브라우저 안에서만 쓰고, 친구에게는 관절 좌표만 보낸다.
import type { ReactNode } from 'react'
import { CameraPreview } from '../ui'

interface Props {
  stream: MediaStream | null
  isCameraOn: boolean
  /** 영상 위에 겹칠 것 (뼈대 캔버스) */
  overlay?: ReactNode
  /** 패널 아래에 붙일 것 (음성 켜기 등) */
  footer?: ReactNode
}

export default function MyCameraPanel({ stream, isCameraOn, overlay, footer }: Props) {
  return (
    <section className="my-camera glass is-lined col" aria-label="내 카메라">
      <div className="camera-box my-camera-box">
        <span className="chip-light camera-box-chip my-camera-chip">
          <i className={`dot ${isCameraOn ? 'is-online' : ''}`} style={{ display: 'inline-block', marginRight: 6 }} />
          {isCameraOn ? '카메라 켜짐' : '카메라 꺼짐'}
        </span>
        <CameraPreview stream={stream} emptyText="카메라를 켜면 내 동작이 캐릭터에 반영돼요" />
        {stream && overlay}
      </div>
      <span className="t-xs t-soft">영상은 내 브라우저 안에서만 쓰여요</span>
      {footer}
    </section>
  )
}
