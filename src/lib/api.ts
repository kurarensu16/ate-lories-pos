import { supabase, handleSupabaseError } from './supabase'
import { type Database } from '../types/supabase'

type MenuItem = Database['public']['Tables']['menu_items']['Row']
type Table = Database['public']['Tables']['tables']['Row']
type OrderInsert = Database['public']['Tables']['orders']['Insert']
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert']
type OrderItemCreate = Omit<OrderItemInsert, 'order_id'>
type PaymentInsert = Database['public']['Tables']['payments']['Insert']
type PaymentCreate = Omit<PaymentInsert, 'order_id'>

export const api = {
  supabase,
  // Menu items
  async getMenuItems() {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('name')
      
      if (error) throw error
      return data as MenuItem[]
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  },

  // Tables
  async getTables() {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('number')
      
      if (error) throw error
      return data as Table[]
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  },

  // Update table status
  async updateTableStatus(tableId: string, status: 'available' | 'occupied') {
    try {
      const { error } = await (supabase as any)
        .from('tables')
        .update({ status: status })
        .eq('id', tableId);

      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error)
    }
  },

  // Create order
  async createOrder(order: OrderInsert, orderItems: OrderItemCreate[]) {
    try {
      // Handle both old and new schema during transition
      const orderData = {
        ...order,
        // If customer_name doesn't exist in schema, try customer_count as fallback
        ...(order.customer_name && { customer_name: order.customer_name })
      }

      // Start a transaction by creating the order first
      const { data: orderResult, error: orderError } = await (supabase as any)
        .from('orders')
        .insert([orderData])
        .select()
        .single()
      
      if (orderError) {
        // If customer_name column doesn't exist, try with customer_count
        if (orderError.message.includes('customer_name')) {
          console.log('customer_name column not found, trying with customer_count...')
          const fallbackOrder = {
            ...order,
            customer_count: order.customer_name ? 1 : null
          }
          delete fallbackOrder.customer_name
          
          const { data: fallbackResult, error: fallbackError } = await (supabase as any)
            .from('orders')
            .insert([fallbackOrder])
            .select()
            .single()
          
          if (fallbackError) throw fallbackError
          
          // Add order items for fallback
          const orderItemsWithOrderId = orderItems.map(item => ({
            ...item,
            order_id: fallbackResult.id
          }))

          const { error: itemsError } = await (supabase as any)
            .from('order_items')
            .insert(orderItemsWithOrderId)
          
          if (itemsError) throw itemsError

          return fallbackResult
        }
        throw orderError
      }

      // Add order items
      const orderItemsWithOrderId = orderItems.map(item => ({
        ...item,
        order_id: orderResult.id
      }))

      const { error: itemsError } = await (supabase as any)
        .from('order_items')
        .insert(orderItemsWithOrderId)
      
      if (itemsError) throw itemsError

      return orderResult
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  },

  // Complete order with payment
  async completeOrder(orderId: string, payment: PaymentCreate) {
    try {
      // Create payment record
      const { error: paymentError } = await (supabase as any)
        .from('payments')
        .insert([{
          ...payment,
          order_id: orderId
        }])
      
      if (paymentError) throw paymentError

      // Update order status to completed
      const { error: orderError } = await (supabase as any)
        .from('orders')
        .update({ 
          status: 'completed', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)
      
      if (orderError) throw orderError

    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  },

  // Get categories
  async getCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
      
      if (error) throw error
      return data as Database['public']['Tables']['categories']['Row'][]
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  },

  // Get recent orders
  async getRecentOrders(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            unit_price,
            special_instructions,
            menu_items (
              name
            )
          ),
          payments (
            id,
            amount,
            method,
            status,
            created_at
          ),
          tables (
            number
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  },

  // Get revenue statistics (excluding cancelled orders)
  async getRevenueStats(startDate?: string, endDate?: string) {
    try {
      let query = (supabase as any)
        .from('orders')
        .select('total_amount, status, created_at')
        .neq('status', 'cancelled') // Exclude cancelled orders
        .order('created_at', { ascending: false })

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data, error } = await query
      
      if (error) throw error
      
      const totalRevenue = (data as any[])?.reduce((sum, order) => sum + order.total_amount, 0) || 0
      const orderCount = (data as any[])?.length || 0
      
      return {
        totalRevenue,
        orderCount,
        orders: data || []
      }
    } catch (error) {
      handleSupabaseError(error)
      return {
        totalRevenue: 0,
        orderCount: 0,
        orders: []
      }
    }
  },

  // Get menu item by ID
  async getMenuItem(id: string) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      handleSupabaseError(error)
      return null
    }
  },

  // Create menu item
  async createMenuItem(item: any) {
    try {
      console.log('Creating menu item:', item)
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User must be authenticated to create menu items')
      }
      
      const { data, error } = await (supabase as any)
        .from('menu_items')
        .insert([item])
        .select()
      
      if (error) {
        console.error('Supabase create error:', error)
        if (error.message.includes('row-level security')) {
          throw new Error('Permission denied: Row Level Security policy is blocking this operation. Please check your database permissions.')
        }
        throw new Error(`Failed to create menu item: ${error.message}`)
      }
      
      if (!data || data.length === 0) {
        throw new Error('No data returned from create operation - you may not have permission to create menu items')
      }
      
      console.log('Create successful:', data[0])
      return data[0]
    } catch (error) {
      console.error('Create menu item error:', error)
      throw error
    }
  },

  // Update menu item
  async updateMenuItem(id: string, updates: any) {
    try {
      console.log('Updating menu item:', { id, updates })
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User must be authenticated to update menu items')
      }
      
      // Validate required fields
      if (!id) {
        throw new Error('Menu item ID is required')
      }
      
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('No updates provided')
      }
      
      // Ensure we only update allowed fields
      const allowedFields = ['name', 'description', 'price', 'category_id', 'is_available', 'image_url']
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key]
          return obj
        }, {} as any)
      
      console.log('Filtered updates:', filteredUpdates)
      
      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid fields to update')
      }
      
      const { data, error } = await (supabase as any)
        .from('menu_items')
        .update(filteredUpdates)
        .eq('id', id)
        .select()
      
      if (error) {
        console.error('Supabase update error:', error)
        if (error.message.includes('row-level security')) {
          throw new Error('Permission denied: Row Level Security policy is blocking this operation. Please check your database permissions.')
        }
        throw new Error(`Failed to update menu item: ${error.message}`)
      }
      
      if (!data || data.length === 0) {
        throw new Error('No data returned from update operation - item may not exist or you may not have permission to update it')
      }
      
      if (data.length > 1) {
        console.warn('Multiple items updated, returning first one')
      }
      
      console.log('Update successful:', data[0])
      return data[0]
    } catch (error) {
      console.error('Update menu item error:', error)
      throw error
    }
  },

  // Delete menu item
  async deleteMenuItem(id: string) {
    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  },

  // Daily menu management
  async getTodayMenuItems() {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_today_menu', true)
        .eq('is_available', true)
        .order('name')
      
      if (error) throw error
      return data as MenuItem[]
    } catch (error) {
      handleSupabaseError(error)
      return []
    }
  },

  async setTodayMenu(itemIds: string[]) {
    try {
      // First, clear all today menu selections
      const { error: clearError } = await (supabase as any)
        .from('menu_items')
        .update({ is_today_menu: false })
        .eq('is_today_menu', true)
      
      if (clearError) throw clearError

      // Then set the new selections
      if (itemIds.length > 0) {
        const { error: setError } = await (supabase as any)
          .from('menu_items')
          .update({ is_today_menu: true })
          .in('id', itemIds)
        
        if (setError) throw setError
      }

      return true
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  },

  async toggleTodayMenu(itemId: string, isTodayMenu: boolean) {
    try {
      const { error } = await (supabase as any)
        .from('menu_items')
        .update({ is_today_menu: isTodayMenu })
        .eq('id', itemId)
      
      if (error) throw error
    } catch (error) {
      handleSupabaseError(error)
      throw error
    }
  },
}

