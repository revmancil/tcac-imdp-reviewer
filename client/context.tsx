import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'
import type { OfficerPublic, ReferenceData } from '../shared/types'

interface AppState {
  officer: OfficerPublic | null
  reference: ReferenceData | null
  loading: boolean
  signIn: (email: string) => Promise<OfficerPublic>
  quickSignIn: (officerId: string) => Promise<OfficerPublic>
  signOut: () => Promise<void>
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

  const signIn = useCallback(async (email: string) => {
    const { officer } = await api.signIn(email)
    setOfficer(officer)
    return officer
  }, [])

  const quickSignIn = useCallback(async (officerId: string) => {
    const { officer } = await api.quickSignIn(officerId)
    setOfficer(officer)
    return officer
  }, [])

  const signOut = useCallback(async () => {
    await api.signOut()
    setOfficer(null)
  }, [])

  return <Ctx.Provider value={{ officer, reference, loading, signIn, quickSignIn, signOut }}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
