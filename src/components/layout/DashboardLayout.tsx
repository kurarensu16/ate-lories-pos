import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { 
  BarChart3, 
  CreditCard, 
  ClipboardList, 
  Utensils, 
  TrendingUp, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const location = useLocation()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'POS', href: '/pos', icon: CreditCard },
    { name: 'Orders', href: '/orders', icon: ClipboardList },
    { name: 'Menu', href: '/menu', icon: Utensils },
    { name: 'Reports', href: '/reports', icon: TrendingUp },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  // Update header title based on current route
  const getHeaderTitle = () => {
    const currentNav = navigation.find(nav => nav.href === location.pathname)
    return currentNav?.name || 'Dashboard'
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        {/* Logo Section */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg h-16 flex items-center justify-between px-6">
          {isSidebarOpen && (
            <h1 className="text-xl font-bold text-white">Ate Lorie's POS</h1>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const IconComponent = item.icon
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      location.pathname === item.href
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    } ${!isSidebarOpen ? 'justify-center' : ''}`}
                  >
                    <IconComponent size={20} className={isSidebarOpen ? "mr-3" : ""} />
                    {isSidebarOpen && <span>{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0)}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.role}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg">
          <div className="flex justify-between items-center h-16 px-6">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {getHeaderTitle()}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-primary-50">
                Welcome back, <span className="font-medium text-white">{user?.name}</span>
              </div>
              <button
                onClick={logout}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors border border-white/30"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}