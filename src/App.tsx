import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { services } from './services'
import { useApp } from './store/app'
import Landing from './pages/Landing'
import ProfileSetup from './pages/ProfileSetup'
import Home from './pages/Home'
import GoalSelect from './pages/GoalSelect'
import RoutineConfirm from './pages/RoutineConfirm'
import PartyRoom from './pages/PartyRoom'
import Result from './pages/Result'
import History from './pages/History'
import Sunset from './pages/Sunset'

/** 임시 프로필이 없으면 프로필 설정으로 보낸다. */
function RequireProfile({ children }: { children: ReactNode }) {
  const profile = useApp((s) => s.profile)
  return profile ? children : <Navigate to="/profile" replace />
}

export default function App() {
  const setProfile = useApp((s) => s.setProfile)
  const [ready, setReady] = useState(false)

  // 같은 브라우저 재방문 시 임시 사용자 복원 (F-MZLVEJ 권장안)
  useEffect(() => {
    services.profile.restore().then((p) => {
      if (p) setProfile(p)
      setReady(true)
    })
  }, [setProfile])

  if (!ready) return null

  const guard = (el: ReactNode) => <RequireProfile>{el}</RequireProfile>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/profile" element={<ProfileSetup />} />
        <Route path="/home" element={guard(<Home />)} />
        <Route path="/goal" element={guard(<GoalSelect />)} />
        <Route path="/routine/:routineId" element={guard(<RoutineConfirm />)} />
        <Route path="/room/:routineId" element={guard(<PartyRoom />)} />
        <Route path="/result/:sessionId" element={guard(<Result />)} />
        <Route path="/history" element={guard(<History />)} />
        <Route path="/sunset" element={guard(<Sunset />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
