import { useEffect, useRef } from 'react'

/** 키보드 ←/→로 이전·다음 화면으로 넘긴다 (노트북에 띄운 순위 화면용). 넘길 곳이 없으면 null */
export function useArrowKeys(onPrev: (() => void) | null, onNext: (() => void) | null) {
  const handlers = useRef({ onPrev, onNext })
  useEffect(() => {
    handlers.current = { onPrev, onNext }
  }, [onPrev, onNext])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') handlers.current.onPrev?.()
      if (e.key === 'ArrowRight') handlers.current.onNext?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
