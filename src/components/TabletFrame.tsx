// 시연장 태블릿에서 여는 화면의 틀 (순위 전광판 /univ-contest/board).
// 앱 전체는 데스크톱 기준이라 최소 너비 1280px가 걸려 있어서, 이 틀 안에서만 풀어 화면 너비에 맞춘다.
// 세로로 들면 1440×1024 무대가 57%로 줄어 글자가 안 보이므로 가로로 돌려 달라고 덮는다.

import { useEffect, type ReactNode } from 'react'

const FLUID_CLASS = 'is-tablet-frame'

export default function TabletFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add(FLUID_CLASS)
    return () => root.classList.remove(FLUID_CLASS)
  }, [])
  return (
    <>
      {children}
      <div className="tablet-rotate" role="alert">
        <span className="tablet-rotate-icon" aria-hidden>⟳</span>
        <p>태블릿을 가로로 돌려 주세요</p>
        <p className="tablet-rotate-sub">순위 전광판은 가로 화면에 맞춰져 있어요</p>
      </div>
    </>
  )
}
