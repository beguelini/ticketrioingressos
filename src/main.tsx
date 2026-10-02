import React from 'react'
import ReactDOM from 'react-dom/client'
const AdminApp = React.lazy(() => import('./AdminApp'))
const StoreApp = React.lazy(() => import('./App'))
const IsAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><React.Suspense fallback={<p style={{ padding: 24, fontFamily: 'system-ui' }}>Carregando…</p>}>{IsAdmin ? <AdminApp /> : <StoreApp />}</React.Suspense></React.StrictMode>,
)
