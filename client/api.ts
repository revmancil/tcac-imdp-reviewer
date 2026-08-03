// Thin fetch wrapper for the Texas District Intake Review API.
import type { Candidate, OfficerPublic, ReferenceData } from '../shared/types'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : await res.text()
  if (!res.ok) {
    const err: any = new Error((data && data.error) || `Request failed: ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data as T
}

export const api = {
  reference: () => req<ReferenceData>('/api/reference'),

  me: () => req<{ officer: OfficerPublic | null }>('/api/auth/me'),
  signIn: (email: string) => req<{ officer: OfficerPublic }>('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email }) }),
  quickSignIn: (officerId: string) => req<{ officer: OfficerPublic }>('/api/auth/quick-signin', { method: 'POST', body: JSON.stringify({ officerId }) }),
  signOut: () => req<{ ok: true }>('/api/auth/signout', { method: 'POST' }),

  listCandidates: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
    return req<{ candidates: Candidate[] }>(`/api/candidates?${qs.toString()}`)
  },
  getCandidate: (id: string) => req<{ candidate: Candidate }>(`/api/candidates/${encodeURIComponent(id)}`),
  createCandidate: (body: Record<string, any>) => req<{ candidate: Candidate; errors?: Record<string, string> }>('/api/candidates', { method: 'POST', body: JSON.stringify(body) }),
  missingReport: () => req<{ rows: any[] }>('/api/candidates/missing-report'),
  csvPreview: (csv: string) => req<{ rows: any[]; errors: any[] }>('/api/candidates/csv/preview', { method: 'POST', body: JSON.stringify({ csv }) }),
  csvCommit: (csv: string) => req<{ inserted: number }>('/api/candidates/csv/commit', { method: 'POST', body: JSON.stringify({ csv }) }),
  uploadDoc: (candidateId: string, docKey: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return req<{ candidate: Candidate }>(`/api/candidates/${encodeURIComponent(candidateId)}/docs/${encodeURIComponent(docKey)}`, { method: 'POST', body: form })
  },
}
