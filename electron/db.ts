import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export type StaffUser = {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff' | 'cashier'
  is_active: boolean
}

type CreateOrderInput = {
  customer_name?: string | null
  total_amount: number
  status: 'active' | 'completed' | 'cancelled'
  table_id?: string | null
  staff_notes?: string | null
}

type CreateOrderItemInput = {
  menu_item_id: string
  quantity: number
  unit_price: number
  special_instructions?: string | null
}

type PaymentInput = {
  amount: number
  method: string
  status: string
}

type ImportMenuRow = {
  name?: string
  description?: string
  price?: number | string
  category?: string
  is_available?: boolean | string | number
  is_today_menu?: boolean | string | number
}

export class LocalDatabase {
  private db: Database.Database
  private readonly dbPath: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initializeSchema()
    this.seedDefaults()
  }

  getPath() {
    return this.dbPath
  }

  close() {
    this.db.close()
  }

  integrityCheck() {
    const result = this.db.pragma('integrity_check', { simple: true })
    return result === 'ok'
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','staff','cashier')),
        is_active INTEGER NOT NULL DEFAULT 1,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category_id TEXT NOT NULL,
        is_available INTEGER NOT NULL DEFAULT 1,
        is_today_menu INTEGER NOT NULL DEFAULT 0,
        image_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS restaurant_tables (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'available',
        capacity INTEGER NOT NULL DEFAULT 4
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        table_id TEXT,
        status TEXT NOT NULL,
        total_amount REAL NOT NULL,
        customer_name TEXT,
        staff_notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(table_id) REFERENCES restaurant_tables(id)
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        menu_item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        special_instructions TEXT,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      );
    `)
    this.migrateStaffUsersSchema()
  }

  private migrateStaffUsersSchema() {
    const columns = this.db.prepare("PRAGMA table_info('staff_users')").all() as Array<{ name: string }>
    const hasIsActive = columns.some((col) => col.name === 'is_active')

    const createSql = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='staff_users'")
      .get() as { sql?: string } | undefined
    const needsRoleMigration = !createSql?.sql?.includes("'cashier'")

    if (!hasIsActive || needsRoleMigration) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS staff_users_new (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin','staff','cashier')),
          is_active INTEGER NOT NULL DEFAULT 1,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      this.db.exec(`
        INSERT INTO staff_users_new (id, email, name, role, is_active, password_hash, created_at)
        SELECT id, email, name, role, 1, password_hash, created_at
        FROM staff_users
        ON CONFLICT(id) DO NOTHING;
      `)

      this.db.exec('DROP TABLE staff_users;')
      this.db.exec('ALTER TABLE staff_users_new RENAME TO staff_users;')
    }
  }

  private seedDefaults() {
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM staff_users').get() as { count: number }
    if (userCount.count === 0) {
      const stmt = this.db.prepare(`
        INSERT INTO staff_users (id, email, name, role, password_hash)
        VALUES (?, ?, ?, ?, ?)
      `)
      stmt.run(randomUUID(), 'admin@local.pos', 'Administrator', 'admin', bcrypt.hashSync('admin123', 10))
    }

    const categoryCount = this.db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }
    if (categoryCount.count === 0) {
      const categories = ['Meals', 'Drinks', 'Desserts']
      const insertCategory = this.db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)')
      categories.forEach((name, idx) => insertCategory.run(randomUUID(), name, idx + 1))
    }

    const tableCount = this.db.prepare('SELECT COUNT(*) as count FROM restaurant_tables').get() as { count: number }
    if (tableCount.count === 0) {
      const insertTable = this.db.prepare('INSERT INTO restaurant_tables (id, number, status, capacity) VALUES (?, ?, ?, ?)')
      for (let i = 1; i <= 12; i += 1) {
        insertTable.run(randomUUID(), i.toString(), 'available', 4)
      }
    }
  }

  login(email: string, password: string): StaffUser | null {
    const user = this.db.prepare('SELECT * FROM staff_users WHERE email = ? AND is_active = 1').get(email) as any
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return null
    return { id: user.id, email: user.email, name: user.name, role: user.role, is_active: Boolean(user.is_active) }
  }

  listUsers() {
    return this.db
      .prepare('SELECT id, email, name, role, is_active, created_at FROM staff_users ORDER BY created_at DESC')
      .all()
      .map((user: any) => ({ ...user, is_active: Boolean(user.is_active) }))
  }

  createUser(payload: { email: string; name: string; role: 'admin' | 'staff' | 'cashier'; password: string }) {
    const id = randomUUID()
    this.db
      .prepare(`
        INSERT INTO staff_users (id, email, name, role, is_active, password_hash)
        VALUES (?, ?, ?, ?, 1, ?)
      `)
      .run(
        id,
        payload.email.trim().toLowerCase(),
        payload.name.trim(),
        payload.role,
        bcrypt.hashSync(payload.password, 10)
      )
    return this.db.prepare('SELECT id, email, name, role, is_active, created_at FROM staff_users WHERE id = ?').get(id)
  }

  updateUser(id: string, payload: { name: string; role: 'admin' | 'staff' | 'cashier'; password?: string }) {
    const baseValues = [payload.name.trim(), payload.role, id]
    if (payload.password && payload.password.trim().length > 0) {
      this.db
        .prepare('UPDATE staff_users SET name = ?, role = ?, password_hash = ? WHERE id = ?')
        .run(payload.name.trim(), payload.role, bcrypt.hashSync(payload.password, 10), id)
    } else {
      this.db.prepare('UPDATE staff_users SET name = ?, role = ? WHERE id = ?').run(...baseValues)
    }
    return this.db.prepare('SELECT id, email, name, role, is_active, created_at FROM staff_users WHERE id = ?').get(id)
  }

  setUserActive(id: string, isActive: boolean) {
    this.db.prepare('UPDATE staff_users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id)
    return this.db.prepare('SELECT id, email, name, role, is_active, created_at FROM staff_users WHERE id = ?').get(id)
  }

  getMenuItems() {
    return this.db
      .prepare('SELECT * FROM menu_items ORDER BY name')
      .all()
      .map((item: any) => ({ ...item, is_available: Boolean(item.is_available), is_today_menu: Boolean(item.is_today_menu) }))
  }

  getTodayMenuItems() {
    return this.db
      .prepare('SELECT * FROM menu_items WHERE is_today_menu = 1 AND is_available = 1 ORDER BY name')
      .all()
      .map((item: any) => ({ ...item, is_available: Boolean(item.is_available), is_today_menu: Boolean(item.is_today_menu) }))
  }

  getCategories() {
    return this.db.prepare('SELECT * FROM categories ORDER BY sort_order').all()
  }

  createMenuItem(item: any) {
    const id = randomUUID()
    this.db
      .prepare(`
        INSERT INTO menu_items (id, name, description, price, category_id, is_available, is_today_menu, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        item.name,
        item.description ?? null,
        item.price,
        item.category_id,
        item.is_available ? 1 : 0,
        item.is_today_menu ? 1 : 0,
        item.image_url ?? null
      )
    return this.db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id)
  }

  updateMenuItem(id: string, updates: any) {
    const fields = ['name', 'description', 'price', 'category_id', 'is_available', 'is_today_menu', 'image_url']
    const entries = Object.entries(updates).filter(([key]) => fields.includes(key))
    if (entries.length === 0) return null

    const setClause = entries.map(([k]) => `${k} = ?`).join(', ')
    const values = entries.map(([k, v]) => (k.startsWith('is_') ? (v ? 1 : 0) : v))
    this.db.prepare(`UPDATE menu_items SET ${setClause} WHERE id = ?`).run(...values, id)
    const row = this.db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as any
    return row ? { ...row, is_available: Boolean(row.is_available), is_today_menu: Boolean(row.is_today_menu) } : null
  }

  deleteMenuItem(id: string) {
    this.db.prepare('DELETE FROM menu_items WHERE id = ?').run(id)
  }

  toggleTodayMenu(id: string, isTodayMenu: boolean) {
    this.db.prepare('UPDATE menu_items SET is_today_menu = ? WHERE id = ?').run(isTodayMenu ? 1 : 0, id)
  }

  updateOrderStatus(orderId: string, status: string) {
    this.db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), orderId)
  }

  createOrder(order: CreateOrderInput, orderItems: CreateOrderItemInput[]) {
    const orderId = randomUUID()
    const insertOrder = this.db.prepare(`
      INSERT INTO orders (id, table_id, status, total_amount, customer_name, staff_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertOrderItem = this.db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, special_instructions)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const tx = this.db.transaction(() => {
      const now = new Date().toISOString()
      insertOrder.run(
        orderId,
        order.table_id ?? null,
        order.status,
        order.total_amount,
        order.customer_name ?? null,
        order.staff_notes ?? null,
        now,
        now
      )
      for (const item of orderItems) {
        insertOrderItem.run(
          randomUUID(),
          orderId,
          item.menu_item_id,
          item.quantity,
          item.unit_price,
          item.special_instructions ?? null
        )
      }
    })

    tx()
    return this.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
  }

  completeOrder(orderId: string, payment: PaymentInput) {
    const tx = this.db.transaction(() => {
      this.db
        .prepare('INSERT INTO payments (id, order_id, amount, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), orderId, payment.amount, payment.method, payment.status, new Date().toISOString())
      this.db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run('completed', new Date().toISOString(), orderId)
    })
    tx()
  }

  getRecentOrders(limit: number) {
    const orders = this.db
      .prepare('SELECT o.*, t.number as table_number FROM orders o LEFT JOIN restaurant_tables t ON o.table_id = t.id ORDER BY o.created_at DESC LIMIT ?')
      .all(limit) as any[]

    const getItems = this.db.prepare(`
      SELECT oi.*, mi.name as menu_item_name
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
    `)
    const getPayments = this.db.prepare('SELECT * FROM payments WHERE order_id = ?')

    return orders.map((order) => ({
      ...order,
      order_items: getItems.all(order.id).map((item: any) => ({
        ...item,
        menu_items: { name: item.menu_item_name ?? 'Unknown Item' }
      })),
      payments: getPayments.all(order.id),
      tables: order.table_number ? { number: order.table_number } : undefined,
      customer_address: null
    }))
  }

  getRevenueStats(startDate?: string, endDate?: string) {
    let sql = "SELECT total_amount, status, created_at FROM orders WHERE status != 'cancelled'"
    const params: any[] = []
    if (startDate) {
      sql += ' AND date(created_at) >= date(?)'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND date(created_at) <= date(?)'
      params.push(endDate)
    }
    sql += ' ORDER BY created_at DESC'
    const orders = this.db.prepare(sql).all(...params) as any[]
    return {
      totalRevenue: orders.reduce((sum, order) => sum + Number(order.total_amount), 0),
      orderCount: orders.length,
      orders
    }
  }

  importMenuItems(rows: ImportMenuRow[]) {
    const failedRows: Array<{ row: number; reason: string }> = []
    let insertedCount = 0
    let skippedDuplicates = 0
    let createdCategories = 0

    const getCategoryByName = this.db.prepare('SELECT id FROM categories WHERE lower(name) = lower(?)')
    const insertCategory = this.db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)')
    const getCategoryCount = this.db.prepare('SELECT COUNT(*) as count FROM categories')
    const findMenuByName = this.db.prepare('SELECT id FROM menu_items WHERE lower(name) = lower(?)')
    const insertMenu = this.db.prepare(`
      INSERT INTO menu_items (id, name, description, price, category_id, is_available, is_today_menu, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `)

    const normalizeBool = (value: unknown, fallback = true) => {
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value !== 0
      if (typeof value === 'string') {
        const cleaned = value.trim().toLowerCase()
        if (['true', '1', 'yes', 'y'].includes(cleaned)) return true
        if (['false', '0', 'no', 'n'].includes(cleaned)) return false
      }
      return fallback
    }

    const tx = this.db.transaction(() => {
      rows.forEach((row, index) => {
        const rowNumber = index + 2
        const name = (row.name ?? '').toString().trim()
        const categoryName = (row.category ?? '').toString().trim()
        const price = Number(row.price)

        if (!name) {
          failedRows.push({ row: rowNumber, reason: 'Missing name' })
          return
        }
        if (!categoryName) {
          failedRows.push({ row: rowNumber, reason: 'Missing category' })
          return
        }
        if (!Number.isFinite(price) || price <= 0) {
          failedRows.push({ row: rowNumber, reason: 'Invalid price' })
          return
        }

        const duplicate = findMenuByName.get(name) as { id: string } | undefined
        if (duplicate) {
          skippedDuplicates += 1
          return
        }

        let category = getCategoryByName.get(categoryName) as { id: string } | undefined
        if (!category) {
          const nextSortOrder = ((getCategoryCount.get() as { count: number }).count ?? 0) + 1
          const categoryId = randomUUID()
          insertCategory.run(categoryId, categoryName, nextSortOrder)
          category = { id: categoryId }
          createdCategories += 1
        }

        insertMenu.run(
          randomUUID(),
          name,
          row.description?.toString().trim() || null,
          price,
          category.id,
          normalizeBool(row.is_available, true) ? 1 : 0,
          normalizeBool(row.is_today_menu, false) ? 1 : 0
        )
        insertedCount += 1
      })
    })

    tx()
    return {
      insertedCount,
      skippedDuplicates,
      createdCategories,
      failedRows
    }
  }
}
