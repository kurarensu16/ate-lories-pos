// Offline data storage for PWA
interface OfflineOrder {
  id: string
  items: any[]
  customerName: string | null
  total: number
  paymentMethod: string
  timestamp: number
  synced: boolean
}

class OfflineStore {
  private dbName = 'POSOfflineDB'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create orders store
        if (!db.objectStoreNames.contains('orders')) {
          const ordersStore = db.createObjectStore('orders', { keyPath: 'id' })
          ordersStore.createIndex('timestamp', 'timestamp', { unique: false })
          ordersStore.createIndex('synced', 'synced', { unique: false })
        }
      }
    })
  }

  async saveOrder(order: OfflineOrder): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['orders'], 'readwrite')
      const store = transaction.objectStore('orders')
      const request = store.put(order)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedOrders(): Promise<OfflineOrder[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['orders'], 'readonly')
      const store = transaction.objectStore('orders')
      const index = store.index('synced')
      const request = index.getAll(false)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async markOrderSynced(orderId: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['orders'], 'readwrite')
      const store = transaction.objectStore('orders')
      const getRequest = store.get(orderId)

      getRequest.onsuccess = () => {
        const order = getRequest.result
        if (order) {
          order.synced = true
          const putRequest = store.put(order)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async clearSyncedOrders(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['orders'], 'readwrite')
      const store = transaction.objectStore('orders')
      const index = store.index('synced')
      const request = index.openCursor(IDBKeyRange.only(true))

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
  }
}

export const offlineStore = new OfflineStore()

// Network status detection
export const isOnline = (): boolean => navigator.onLine

// Sync offline orders when online
export const syncOfflineOrders = async (): Promise<void> => {
  if (!isOnline()) return

  try {
    const unsyncedOrders = await offlineStore.getUnsyncedOrders()
    
    for (const order of unsyncedOrders) {
      try {
        // Here you would sync with your API
        console.log('Syncing offline order:', order.id)
        
        // Mark as synced after successful sync
        await offlineStore.markOrderSynced(order.id)
      } catch (error) {
        console.error('Failed to sync order:', order.id, error)
      }
    }
  } catch (error) {
    console.error('Failed to sync offline orders:', error)
  }
}

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('Connection restored, syncing offline data...')
  syncOfflineOrders()
})

window.addEventListener('offline', () => {
  console.log('Connection lost, storing data offline...')
})
