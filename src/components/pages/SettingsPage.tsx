import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/useAuthStore'
import { Settings as SettingsIcon, Building2, Users as UsersIcon, Wrench } from 'lucide-react'
import { useToast } from '../ui/ToastProvider'

interface RestaurantSettings {
  name: string
  address: string
  phone: string
  email: string
  currency: string
  vat_mode: 'vat_inclusive' | 'vat_exclusive' | 'non_vat'
  vat_rate: number
  service_charge: number
  senior_pwd_discount: number
  timezone: string
  receipt_footer: string
  order_prefix: string
  reset_order_daily: boolean
  payment_cash: boolean
  payment_gcash: boolean
  payment_maya: boolean
  payment_card: boolean
  backup_reminder: 'off' | 'daily' | 'weekly'
}

type StaffUser = {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff' | 'cashier'
  is_active: boolean
}

export const SettingsPage: React.FC = () => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'general' | 'business' | 'users' | 'system'>('general')
  const [isEditing, setIsEditing] = useState(false)
  const [systemMessage, setSystemMessage] = useState('')

  // Mock settings data - in a real app, this would come from an API
  const [settings, setSettings] = useState<RestaurantSettings>({
    name: "Ate Lorie's Restaurant",
    address: "Lipa City, Batangas, Philippines",
    phone: "+63 917 123 4567",
    email: "ateloriespos@gmail.com",
    currency: "PHP",
    vat_mode: "vat_inclusive",
    vat_rate: 12,
    service_charge: 0,
    senior_pwd_discount: 20,
    timezone: "Asia/Manila",
    receipt_footer: "Salamat po! Balik po kayo.",
    order_prefix: "ALP",
    reset_order_daily: true,
    payment_cash: true,
    payment_gcash: true,
    payment_maya: true,
    payment_card: false,
    backup_reminder: "weekly"
  })

  const [formData, setFormData] = useState<RestaurantSettings>(settings)
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'cashier' as StaffUser['role'], password: '' })
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editUser, setEditUser] = useState({ name: '', role: 'cashier' as StaffUser['role'], password: '' })

  const { data: staffUsers = [] } = useQuery<StaffUser[]>({
    queryKey: ['staffUsers'],
    queryFn: api.listUsers
  })

  const createUserMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffUsers'] })
      setNewUser({ name: '', email: '', role: 'cashier', password: '' })
      toast.success('User created successfully')
    }
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; role: StaffUser['role']; password?: string } }) =>
      api.updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffUsers'] })
      setEditingUserId(null)
      setEditUser({ name: '', role: 'cashier', password: '' })
      toast.success('User updated successfully')
    }
  })

  const setUserActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.setUserActive(id, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staffUsers'] })
      toast.success(variables.isActive ? 'User activated' : 'User deactivated')
    }
  })

  const handleInputChange = (field: keyof RestaurantSettings, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = () => {
    setSettings(formData)
    setIsEditing(false)
    // In a real app, this would save to the database
    toast.success('Settings saved successfully')
  }

  const handleCancel = () => {
    setFormData(settings)
    setIsEditing(false)
  }

  const handleBackup = async () => {
    const result = await api.backupDatabase()
    setSystemMessage(result.canceled ? 'Backup canceled.' : `Backup saved to ${result.path}`)
  }

  const handleRestore = async () => {
    if (!window.confirm('Restore will replace the active local database. Continue?')) return
    const result = await api.restoreDatabase()
    setSystemMessage(result.canceled ? 'Restore canceled.' : `Database restored from ${result.path}`)
  }

  const handleIntegrityCheck = async () => {
    const result = await api.integrityCheck()
    setSystemMessage(result.ok ? `Integrity check passed (${result.path})` : 'Integrity check failed.')
  }

  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast.error('Name, email, and password are required')
      return
    }
    try {
      await createUserMutation.mutateAsync({
        name: newUser.name.trim(),
        email: newUser.email.trim().toLowerCase(),
        role: newUser.role,
        password: newUser.password
      })
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create user')
    }
  }

  const handleStartEditUser = (targetUser: StaffUser) => {
    setEditingUserId(targetUser.id)
    setEditUser({ name: targetUser.name, role: targetUser.role, password: '' })
  }

  const handleSaveEditUser = async (id: string) => {
    if (!editUser.name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      await updateUserMutation.mutateAsync({
        id,
        payload: {
          name: editUser.name.trim(),
          role: editUser.role,
          password: editUser.password.trim() || undefined
        }
      })
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update user')
    }
  }

  const tabs = [
    { id: 'general', name: 'My Profile', description: 'Restaurant identity and contact', icon: SettingsIcon },
    { id: 'business', name: 'Business', description: 'PH VAT, payments, receipt, and order setup', icon: Building2 },
    { id: 'users', name: 'Role & Access', description: 'Create and manage staff users', icon: UsersIcon },
    { id: 'system', name: 'Data Management', description: 'Backup, restore, and integrity checks', icon: Wrench }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your workspace and staff access preferences.</p>
        </div>
        {(activeTab === 'general' || activeTab === 'business') && (
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >
              {isEditing ? 'Save Changes' : 'Edit Settings'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[640px]">
          <aside className="border-r border-gray-200 p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full text-left rounded-lg p-3 transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 border border-primary-100'
                        : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={16} className="mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{tab.name}</p>
                        <p className="text-xs text-gray-500">{tab.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </nav>
          </aside>

          <section className="p-6 lg:p-8">
            <div className="mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-semibold text-gray-900">{tabs.find((tab) => tab.id === activeTab)?.name}</h2>
              <p className="mt-1 text-sm text-gray-500">{tabs.find((tab) => tab.id === activeTab)?.description}</p>
            </div>
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">General Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Restaurant Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => handleInputChange('timezone', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="Asia/Manila">Philippines (Asia/Manila)</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    disabled={!isEditing}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Business Settings */}
          {activeTab === 'business' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Business Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="PHP">PHP (P)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VAT Mode
                    </label>
                    <select
                      value={formData.vat_mode}
                      onChange={(e) => handleInputChange('vat_mode', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="vat_inclusive">VAT Inclusive</option>
                      <option value="vat_exclusive">VAT Exclusive</option>
                      <option value="non_vat">Non-VAT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VAT Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.vat_rate}
                      onChange={(e) => handleInputChange('vat_rate', parseFloat(e.target.value) || 0)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Charge (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.service_charge}
                      onChange={(e) => handleInputChange('service_charge', parseFloat(e.target.value) || 0)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Senior/PWD Discount (%)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={formData.senior_pwd_discount}
                      onChange={(e) => handleInputChange('senior_pwd_discount', parseFloat(e.target.value) || 0)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">POS Operations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Prefix
                    </label>
                    <input
                      type="text"
                      value={formData.order_prefix}
                      onChange={(e) => handleInputChange('order_prefix', e.target.value.toUpperCase())}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Backup Reminder
                    </label>
                    <select
                      value={formData.backup_reminder}
                      onChange={(e) => handleInputChange('backup_reminder', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="off">Off</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receipt Footer
                    </label>
                    <textarea
                      rows={2}
                      value={formData.receipt_footer}
                      onChange={(e) => handleInputChange('receipt_footer', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Reset order sequence daily</span>
                    <input
                      type="checkbox"
                      checked={formData.reset_order_daily}
                      onChange={(e) => handleInputChange('reset_order_daily', e.target.checked)}
                      disabled={!isEditing}
                      className="h-4 w-4"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Accepted Payment Methods</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Cash</span>
                    <input type="checkbox" checked={formData.payment_cash} onChange={(e) => handleInputChange('payment_cash', e.target.checked)} disabled={!isEditing} className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">GCash</span>
                    <input type="checkbox" checked={formData.payment_gcash} onChange={(e) => handleInputChange('payment_gcash', e.target.checked)} disabled={!isEditing} className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Maya</span>
                    <input type="checkbox" checked={formData.payment_maya} onChange={(e) => handleInputChange('payment_maya', e.target.checked)} disabled={!isEditing} className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Card</span>
                    <input type="checkbox" checked={formData.payment_card} onChange={(e) => handleInputChange('payment_card', e.target.checked)} disabled={!isEditing} className="h-4 w-4" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* User Management */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900">Current User</h4>
                <p className="text-sm text-gray-600">{user?.name} ({user?.role})</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Create Staff User</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={newUser.name}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newUser.email}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value as StaffUser['role'] }))}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  <input
                    type="password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <button
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  className="mt-3 bg-primary-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-lg font-medium text-gray-900">Staff Users</h4>
                {staffUsers.map((staffUser) => {
                  const isSelf = staffUser.id === user?.id
                  const isEditing = editingUserId === staffUser.id
                  return (
                    <div key={staffUser.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <input
                            type="text"
                            value={editUser.name}
                            onChange={(e) => setEditUser((prev) => ({ ...prev, name: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-md"
                          />
                          <input type="email" value={staffUser.email} disabled className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-md" />
                          <select
                            value={editUser.role}
                            onChange={(e) => setEditUser((prev) => ({ ...prev, role: e.target.value as StaffUser['role'] }))}
                            className="px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="cashier">Cashier</option>
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                          <input
                            type="password"
                            value={editUser.password}
                            onChange={(e) => setEditUser((prev) => ({ ...prev, password: e.target.value }))}
                            placeholder="New password (optional)"
                            className="px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900">{staffUser.name}</p>
                            <p className="text-sm text-gray-600">{staffUser.email}</p>
                            <p className="text-xs text-gray-500 capitalize">{staffUser.role} • {staffUser.is_active ? 'Active' : 'Inactive'}</p>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        {isEditing ? (
                          <>
                            <button onClick={() => void handleSaveEditUser(staffUser.id)} className="bg-primary-500 text-white px-3 py-1 rounded text-sm hover:bg-primary-600">
                              Save
                            </button>
                            <button onClick={() => setEditingUserId(null)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleStartEditUser(staffUser)} className="bg-primary-100 text-primary-700 px-3 py-1 rounded text-sm hover:bg-primary-200">
                              Edit
                            </button>
                            <button
                              disabled={isSelf || setUserActiveMutation.isPending}
                              onClick={() => void setUserActiveMutation.mutateAsync({ id: staffUser.id, isActive: !staffUser.is_active })}
                              className={`px-3 py-1 rounded text-sm text-white ${staffUser.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}
                            >
                              {staffUser.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">System Configuration</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Auto-save Orders</h4>
                      <p className="text-sm text-gray-600">Automatically save orders every 30 seconds</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                      <p className="text-sm text-gray-600">Send email notifications for new orders</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Sound Notifications</h4>
                      <p className="text-sm text-gray-600">Play sound when new orders arrive</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Data Management</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-red-900">Clear All Data</h4>
                      <p className="text-sm text-red-700">Permanently delete all orders, menu items, and settings</p>
                    </div>
                    <button className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700">
                      Clear Data
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-primary-50 border border-primary-200 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-primary-900">Backup Local Database</h4>
                      <p className="text-sm text-primary-700">Save a SQLite backup file for safekeeping</p>
                    </div>
                    <button onClick={handleBackup} className="bg-primary-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-600">
                      Backup
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-yellow-900">Restore Database</h4>
                      <p className="text-sm text-yellow-700">Load an existing SQLite backup file</p>
                    </div>
                    <button onClick={handleRestore} className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700">
                      Restore
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-green-900">Run Integrity Check</h4>
                      <p className="text-sm text-green-700">Validate local database health</p>
                    </div>
                    <button onClick={handleIntegrityCheck} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700">
                      Check
                    </button>
                  </div>
                  {systemMessage && (
                    <p className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-md p-3">{systemMessage}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          </section>
        </div>
      </div>
    </div>
  )
}