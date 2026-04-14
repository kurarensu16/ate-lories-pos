export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff' | 'cashier'
  is_active?: boolean
}

export interface LoginFormData {
  email: string
  password: string
}