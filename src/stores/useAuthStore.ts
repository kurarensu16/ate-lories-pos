import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type User, type LoginFormData } from '../types/auth'
import { api } from '../lib/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  
  login: (credentials: LoginFormData) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginFormData) => {
        set({ isLoading: true })
        
        try {
          const user = await api.login(credentials.email, credentials.password)
          set({
            user,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error: any) {
          set({ isLoading: false })
          throw new Error(error.message || 'Login failed')
        }
      },

      logout: async () => {
        set({
          user: null,
          isAuthenticated: false
        })
      },

      checkAuth: async () => {
        set({ isLoading: false })
      }
    }),
    {
      name: 'auth-storage',
    }
  )
)