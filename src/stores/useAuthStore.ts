import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type User, type LoginFormData } from '../types/auth'
import { supabase } from '../lib/supabase'

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
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          })

          if (error) throw error

          if (data.user) {
            // Get user profile from our profiles table
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single()

            if (profileError) {
              console.error('Profile error:', profileError)
              // If no profile exists, create one
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  id: data.user.id,
                  email: data.user.email || '',
                  name: data.user.email?.split('@')[0] || 'Staff Member',
                  role: 'staff'
                } as any)
                .select()
                .single()

              if (createError) throw createError

              set({
                user: {
                  id: (newProfile as any).id,
                  email: (newProfile as any).email,
                  name: (newProfile as any).name,
                  role: (newProfile as any).role
                },
                isAuthenticated: true,
                isLoading: false
              })
            } else {
              set({
                user: {
                  id: (profile as any).id,
                  email: (profile as any).email,
                  name: (profile as any).name,
                  role: (profile as any).role
                },
                isAuthenticated: true,
                isLoading: false
              })
            }
          }
        } catch (error: any) {
          set({ isLoading: false })
          throw new Error(error.message || 'Login failed')
        }
      },

      logout: async () => {
        try {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({ 
            user: null, 
            isAuthenticated: false 
          })
        }
      },

      checkAuth: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session?.user) {
            // Get user profile
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()

            if (error) throw error

            if (profile) {
              set({
                user: {
                  id: (profile as any).id,
                  email: (profile as any).email,
                  name: (profile as any).name,
                  role: (profile as any).role
                },
                isAuthenticated: true
              })
            }
          }
        } catch (error) {
          console.error('Auth check error:', error)
          set({ user: null, isAuthenticated: false })
        }
      }
    }),
    {
      name: 'auth-storage',
    }
  )
)