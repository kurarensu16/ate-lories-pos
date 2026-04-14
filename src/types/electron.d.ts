export {}

declare global {
  interface Window {
    electronApi?: {
      health: () => Promise<{ ok: boolean; runtime: string }>
      getMeta: () => Promise<{ version: string; platform: string }>
      login: (email: string, password: string) => Promise<{ id: string; email: string; name: string; role: 'admin' | 'staff' | 'cashier'; is_active: boolean }>
      listUsers: () => Promise<any[]>
      createUser: (payload: any) => Promise<any>
      updateUser: (id: string, payload: any) => Promise<any>
      setUserActive: (id: string, isActive: boolean) => Promise<any>
      getMenuItems: () => Promise<any[]>
      getTodayMenuItems: () => Promise<any[]>
      getCategories: () => Promise<any[]>
      createMenuItem: (payload: any) => Promise<any>
      updateMenuItem: (id: string, updates: any) => Promise<any>
      deleteMenuItem: (id: string) => Promise<void>
      toggleTodayMenu: (id: string, isTodayMenu: boolean) => Promise<void>
      importMenuCsv: (rows: any[]) => Promise<{
        insertedCount: number
        skippedDuplicates: number
        createdCategories: number
        failedRows: Array<{ row: number; reason: string }>
      }>
      createOrder: (order: any, items: any[]) => Promise<any>
      completeOrder: (orderId: string, payment: any) => Promise<void>
      getRecentOrders: (limit: number) => Promise<any[]>
      updateOrderStatus: (orderId: string, status: string) => Promise<void>
      getRevenueStats: (startDate?: string, endDate?: string) => Promise<any>
      backupDatabase: () => Promise<{ canceled: boolean; path?: string }>
      restoreDatabase: () => Promise<{ canceled: boolean; path?: string }>
      integrityCheck: () => Promise<{ ok: boolean; path: string }>
    }
  }
}
