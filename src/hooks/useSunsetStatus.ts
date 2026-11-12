import { useEffect, useState } from 'react'
import { services } from '../services'
import { getSunsetStatus } from '../lib/sunset'
import type { SunsetStatus } from '../types/domain'

/**
 * 공개 운동방 운영 상태 (F-DXORMB).
 * 임시 운영 시각으로 바로 그리고, 서버 값이 오면 바꾼다. 서버가 안 되면 임시 운영 시각을 그대로 쓴다.
 */
export function useSunsetStatus() {
  const [status, setStatus] = useState<SunsetStatus>(() => getSunsetStatus())
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let isAlive = true
    services.publicParty
      .getStatus()
      .then((s) => isAlive && setStatus(s))
      .catch(() => {})
      .finally(() => isAlive && setIsChecking(false))
    return () => { isAlive = false }
  }, [])

  return { status, isChecking }
}
