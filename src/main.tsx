import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { loadOrCreatePersistedState } from './app/storage'
import { initializeAppStore } from './app/store'
import { initializeSupabaseAuth } from './app/supabase'
import { ensureLocalSnapshotInfo } from './app/sync'
import { applyTheme, getPreferredTheme } from './app/theme'

applyTheme(getPreferredTheme())
initializeSupabaseAuth()
const initialPersistedState = loadOrCreatePersistedState()
ensureLocalSnapshotInfo(initialPersistedState)
initializeAppStore(initialPersistedState)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
