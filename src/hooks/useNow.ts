import { useEffect, useState } from 'react'

/** 화면의 시계·카운트다운을 위해 주기적으로 다시 그린다 */
export function useNow(isActive = true, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isActive) return
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [isActive, intervalMs])
  return now
}
