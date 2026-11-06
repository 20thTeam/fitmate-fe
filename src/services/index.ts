// 어떤 백엔드 구현을 쓸지 고르는 단일 지점.
// .env 의 VITE_BACKEND=local | http  (기본 local)
// 팀 백엔드가 준비되면 services/http/ 에 Services 구현을 만들고 아래에 연결한다.

import { localServices } from './local'
import type { Services } from './ports'

const mode = import.meta.env.VITE_BACKEND ?? 'local'

function pick(): Services {
  switch (mode) {
    // case 'http': return httpServices
    default:
      return localServices
  }
}

export const services = pick()
export type * from './ports'
