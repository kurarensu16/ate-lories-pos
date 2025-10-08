export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          created_at?: string
        }
      }
      menu_items: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          category_id: string
          is_available: boolean
          is_today_menu: boolean
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          category_id: string
          is_available?: boolean
          is_today_menu?: boolean
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          category_id?: string
          is_available?: boolean
          is_today_menu?: boolean
          image_url?: string | null
          created_at?: string
        }
      }
      tables: {
        Row: {
          id: string
          number: string
          capacity: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          number: string
          capacity?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          number?: string
          capacity?: number
          status?: string
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          table_id: string | null
          status: string
          total_amount: number
          customer_name: string | null
          staff_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          table_id?: string | null
          status?: string
          total_amount?: number
          customer_name?: string | null
          staff_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          table_id?: string | null
          status?: string
          total_amount?: number
          customer_name?: string | null
          staff_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string
          quantity: number
          unit_price: number
          special_instructions: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          menu_item_id: string
          quantity: number
          unit_price: number
          special_instructions?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          menu_item_id?: string
          quantity?: number
          unit_price?: number
          special_instructions?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          order_id: string
          amount: number
          method: string
          status: string
          transaction_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          amount: number
          method: string
          status?: string
          transaction_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          amount?: number
          method?: string
          status?: string
          transaction_data?: Json | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          role: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: string
          created_at?: string
        }
      }
    }
  }
}