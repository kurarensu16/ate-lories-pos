const hasElectron = () => typeof window !== 'undefined' && typeof window.electronApi !== 'undefined'
export const isDesktopRuntime = () => hasElectron()

const ensureElectron = () => {
  if (!hasElectron()) {
    throw new Error('Desktop runtime is required for local database operations. Start the app via Electron.')
  }
  return window.electronApi!
}

const parseItem = (item: any) => ({
  ...item,
  is_available: Boolean(item.is_available),
  is_today_menu: Boolean(item.is_today_menu)
})

export const api = {
  async health() {
    return ensureElectron().health()
  },

  async login(email: string, password: string) {
    return ensureElectron().login(email, password)
  },

  async listUsers() {
    return ensureElectron().listUsers()
  },

  async createUser(payload: { email: string; name: string; role: 'admin' | 'staff' | 'cashier'; password: string }) {
    return ensureElectron().createUser(payload)
  },

  async updateUser(id: string, payload: { name: string; role: 'admin' | 'staff' | 'cashier'; password?: string }) {
    return ensureElectron().updateUser(id, payload)
  },

  async setUserActive(id: string, isActive: boolean) {
    return ensureElectron().setUserActive(id, isActive)
  },

  async getMenuItems() {
    if (!hasElectron()) return []
    return (await ensureElectron().getMenuItems()).map(parseItem)
  },

  async getCategories() {
    if (!hasElectron()) return []
    return ensureElectron().getCategories()
  },

  async createMenuItem(item: any) {
    return parseItem(await ensureElectron().createMenuItem(item))
  },

  async updateMenuItem(id: string, updates: any) {
    return parseItem(await ensureElectron().updateMenuItem(id, updates))
  },

  async updateMenuItemAvailability(id: string, isAvailable: boolean) {
    return this.updateMenuItem(id, { is_available: isAvailable })
  },

  async deleteMenuItem(id: string) {
    await ensureElectron().deleteMenuItem(id)
  },

  async getTodayMenuItems() {
    if (!hasElectron()) return []
    return (await ensureElectron().getTodayMenuItems()).map(parseItem)
  },

  async toggleTodayMenu(itemId: string, isTodayMenu: boolean) {
    await ensureElectron().toggleTodayMenu(itemId, isTodayMenu)
  },

  async importMenuCsv(rows: any[]) {
    return ensureElectron().importMenuCsv(rows)
  },

  async createOrder(order: any, orderItems: any[]) {
    return ensureElectron().createOrder(order, orderItems)
  },

  async completeOrder(orderId: string, payment: any) {
    await ensureElectron().completeOrder(orderId, payment)
  },

  async getRecentOrders(limit = 50) {
    if (!hasElectron()) return []
    return ensureElectron().getRecentOrders(limit)
  },

  async updateOrderStatus(orderId: string, status: string) {
    await ensureElectron().updateOrderStatus(orderId, status)
  },

  async getRevenueStats(startDate?: string, endDate?: string) {
    if (!hasElectron()) {
      return { totalRevenue: 0, orderCount: 0, orders: [] }
    }
    return ensureElectron().getRevenueStats(startDate, endDate)
  },

  async backupDatabase() {
    return ensureElectron().backupDatabase()
  },

  async restoreDatabase() {
    return ensureElectron().restoreDatabase()
  },

  async integrityCheck() {
    return ensureElectron().integrityCheck()
  }
}

