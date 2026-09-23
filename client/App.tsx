import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import ChangePasswordModal from './components/ChangePasswordModal'
import { useApp } from './context'
import SignIn from './pages/SignIn'
import Roster from './pages/Roster'
import Detail from './pages/Detail'
import Missing from './pages/Missing'
import Add from './pages/Add'
import Admin from './pages/Admin'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell v-classic">
      <TopBar />
      {children}
    </div>
  )
}

export default function App() {
  const { officer, loading } = useApp()

  if (loading) {
    return <div className="app-loading">Loading TCAC Intake Review…</div>
  }

  if (!officer) {
    return (
      <div className="v-classic">
        <Routes>
          <Route path="*" element={<SignIn />} />
        </Routes>
      </div>
    )
  }

  return (
    <Shell>
      {officer.mustChangePassword && <ChangePasswordModal />}
      <Routes>
        <Route path="/" element={<Navigate to="/roster" replace />} />
        <Route path="/signin" element={<Navigate to="/roster" replace />} />
        <Route path="/roster" element={<Roster />} />
        <Route path="/candidates/:id" element={<Detail />} />
        <Route path="/missing" element={<Missing />} />
        <Route path="/add" element={<Add />} />
        {officer.tier === 'district' && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/roster" replace />} />
      </Routes>
    </Shell>
  )
}
