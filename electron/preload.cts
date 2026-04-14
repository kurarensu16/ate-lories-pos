import { contextBridge, ipcRenderer } from 'electron'

const electronApi = {
  health: () => ipcRenderer.invoke('app:health'),
  getMeta: () => ipcRenderer.invoke('app:meta'),
  login: (email: string, password: string) => ipcRenderer.invoke('auth:login', email, password),
  listUsers: () => ipcRenderer.invoke('users:list'),
  createUser: (payload: any) => ipcRenderer.invoke('users:create', payload),
  updateUser: (id: string, payload: any) => ipcRenderer.invoke('users:update', id, payload),
  setUserActive: (id: string, isActive: boolean) => ipcRenderer.invoke('users:set-active', id, isActive),
  getMenuItems: () => ipcRenderer.invoke('menu:list'),
  getTodayMenuItems: () => ipcRenderer.invoke('menu:today'),
  getCategories: () => ipcRenderer.invoke('categories:list'),
  createMenuItem: (payload: any) => ipcRenderer.invoke('menu:create', payload),
  updateMenuItem: (id: string, updates: any) => ipcRenderer.invoke('menu:update', id, updates),
  deleteMenuItem: (id: string) => ipcRenderer.invoke('menu:delete', id),
  toggleTodayMenu: (id: string, isTodayMenu: boolean) => ipcRenderer.invoke('menu:toggle-today', id, isTodayMenu),
  importMenuCsv: (rows: any[]) => ipcRenderer.invoke('menu:import-csv', rows),
  createOrder: (order: any, items: any[]) => ipcRenderer.invoke('orders:create', order, items),
  completeOrder: (orderId: string, payment: any) => ipcRenderer.invoke('orders:complete', orderId, payment),
  getRecentOrders: (limit: number) => ipcRenderer.invoke('orders:recent', limit),
  updateOrderStatus: (orderId: string, status: string) => ipcRenderer.invoke('orders:update-status', orderId, status),
  getRevenueStats: (startDate?: string, endDate?: string) => ipcRenderer.invoke('reports:revenue', startDate, endDate),
  backupDatabase: () => ipcRenderer.invoke('system:backup'),
  restoreDatabase: () => ipcRenderer.invoke('system:restore'),
  integrityCheck: () => ipcRenderer.invoke('system:integrity')
}

contextBridge.exposeInMainWorld('electronApi', electronApi)
