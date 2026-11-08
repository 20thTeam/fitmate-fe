import { useEffect, useState, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom'
import { services } from './services'
import { useApp } from './store/app'
import Landing from './pages/Landing'
import ProfileSetup from './pages/ProfileSetup'
import Home from './pages/Home'
import GoalSelect from './pages/GoalSelect'
import PartyRoom from './pages/PartyRoom'
import Result from './pages/Result'
import History from './pages/History'
import Sunset from './pages/Sunset'

/** 임시 프로필이 없으면 프로필 설정으로 보낸다. */
function RequireProfile({ children }: { children: ReactNode }) {
  const profile = useApp((s) => s.profile)
  return profile ? children : <Navigate to="/profile" replace />
}

const guard = (el: ReactNode) => <RequireProfile>{el}</RequireProfile>

/** 예전 '추천 루틴 확인' 주소. 루틴 확인은 운동방 입장 대기 화면으로 합쳐졌다 (Figma 운동방 시안). */
function RoutineRedirect() {
  const { routineId = '' } = useParams()
  return <Navigate to={`/room/${routineId}`} replace />
}

// 운동 중 이탈 확인(useBlocker)을 쓰려고 데이터 라우터로 만든다 (F-SZCKIV)
const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/profile', element: <ProfileSetup /> },
  { path: '/home', element: guard(<Home />) },
  { path: '/goal', element: guard(<GoalSelect />) },
  { path: '/routine/:routineId', element: <RoutineRedirect /> },
  { path: '/room/:routineId', element: guard(<PartyRoom />) },
  { path: '/result/:sessionId', element: guard(<Result />) },
  { path: '/history', element: guard(<History />) },
  { path: '/sunset', element: guard(<Sunset />) },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  const setProfile = useApp((s) => s.setProfile)
  const [isReady, setIsReady] = useState(false)

  // 같은 브라우저 재방문 시 임시 사용자 복원 (F-MZLVEJ 권장안)
  useEffect(() => {
    services.profile
      .restore()
      .then((p) => p && setProfile(p))
      .finally(() => setIsReady(true))
  }, [setProfile])

  if (!isReady) return null
  return <RouterProvider router={router} />
}
