import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'
import type { OfficerPublic, ReferenceData } from '../shared/types'

interface AppState {
  officer: OfficerPublic | null
  reference: ReferenceData | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<OfficerPublic>
  signOut: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  clearMustChangePassword: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [officer, setOfficer] = useState<OfficerPublic | null>(null)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [refRes, meRes] = await Promise.all([api.reference(), api.me()])
        setReference(refRes)
        setOfficer(meRes.officer)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { officer } = await api.signIn(email, password)
    setOfficer(officer)
    return officer
  }, [])

  const signOut = useCallback(async () => {
    await api.signOut()
    setOfficer(null)
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword)
    setOfficer((o) => (o ? { ...o, mustChangePassword: false } : o))
  }, [])

  const clearMustChangePassword = useCallback(() => {
    setOfficer((o) => (o ? { ...o, mustChangePassword: false } : o))
  }, [])

  return (
    <Ctx.Provider value={{ officer, reference, loading, signIn, signOut, changePassword, clearMustChangePassword }}>
      {children}
    </Ctx.Provider>
  )
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
