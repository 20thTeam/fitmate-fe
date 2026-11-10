// 어떤 백엔드 구현을 쓸지 고르는 단일 지점.
// .env 의 VITE_BACKEND=local | http  (기본 local)
//   - local : 브라우저 안에서만 동작 (localStorage + BroadcastChannel)
//   - http  : 팀 백엔드(VITE_API_URL). 실시간 운동방은 아직 로컬을 쓴다.

import { localServices } from './local'
import { httpServices } from './http'
import { hasApiUrl } from './http/client'
import type { Services } from './ports'

const mode = import.meta.env.VITE_BACKEND ?? 'local'

function pick(): Services {
  switch (mode) {
    case 'http':
      if (hasApiUrl) return httpServices
      console.error('[services] VITE_BACKEND=http 인데 VITE_API_URL이 비어 있어 local로 동작해요.')
      return localServices
    default:
      return localServices
  }
}

export const services = pick()
export type * from './ports'
