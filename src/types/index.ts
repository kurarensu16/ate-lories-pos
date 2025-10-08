export interface MenuItem {
  id: string
  name: string
  description?: string | null
  price: number
  category_id: string
  is_available: boolean
  is_today_menu: boolean
  image_url?: string | null
  created_at: string
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface Table {
  id: string
  number: string
  status: 'available' | 'occupied'
  capacity: number
}

export interface CartItem {
  menu_item_id: string
  name: string
  unit_price: number
  quantity: number
}

export interface Order {
  id?: string
  table_id?: string
  status: 'active' | 'completed' | 'cancelled'
  total_amount: number
  customer_name?: string | null
  created_at?: string
}