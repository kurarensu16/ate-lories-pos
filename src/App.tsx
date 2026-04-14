import React, { useEffect } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/useAuthStore'
import { LoginForm } from './components/auth/LoginForm'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Dashboard } from './components/dashboard/Dashboard'
import { PosPage } from './components/pos/PosPage'
import { OrdersPage } from './components/pages/OrdersPage'
import { MenuPage } from './components/pages/MenuPage'
import { ReportsPage } from './components/pages/ReportsPage'
import { SettingsPage } from './components/pages/SettingsPage'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { ToastProvider } from './components/ui/ToastProvider'

const queryClient = new QueryClient()
const Router = window.electronApi ? HashRouter : BrowserRouter

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unknown renderer error' }
  }

  componentDidCatch(error: Error) {
    console.error('App render error boundary caught:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
          <div className="max-w-2xl bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-lg font-semibold text-red-700">Renderer Error</h1>
            <p className="text-sm text-gray-700 mt-2">{this.state.message}</p>
            <p className="text-xs text-gray-500 mt-3">Check terminal logs for stack trace.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppContent() {
  const { isAuthenticated, checkAuth, isLoading } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginForm />
            } 
          />
          
          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PosPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OrdersPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/menu"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MenuPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['admin', 'staff']}>
                <DashboardLayout>
                  <ReportsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Default redirect - send unauthenticated users to /login */}
          <Route
            path="/"
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
          />

          {/* 404 fallback - respect auth status */}
          <Route
            path="*"
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
          />
        </Routes>
      </Router>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppErrorBoundary>
          <AppContent />
        </AppErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App