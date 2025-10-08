import { create } from 'zustand'

interface CartItem {
  menu_item_id: string
  name: string
  unit_price: number
  quantity: number
}

interface MenuItem {
  id: string
  name: string
  price: number
  category_id: string
  is_available: boolean
}

interface PosState {
  cart: CartItem[]
  customerName: string | null
  
  addToCart: (item: MenuItem) => void
  removeFromCart: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, quantity: number) => void
  clearCart: () => void
  setCustomerName: (name: string | null) => void
  getCartTotal: () => number
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  customerName: null,

  addToCart: (item: MenuItem) => {
    const { cart } = get()
    const existingItem = cart.find(cartItem => cartItem.menu_item_id === item.id)
    
    if (existingItem) {
      get().updateQuantity(item.id, existingItem.quantity + 1)
    } else {
      set(state => ({
        cart: [...state.cart, {
          menu_item_id: item.id,
          name: item.name,
          unit_price: item.price,
          quantity: 1
        }]
      }))
    }
  },

  removeFromCart: (menuItemId: string) => {
    set(state => ({
      cart: state.cart.filter(item => item.menu_item_id !== menuItemId)
    }))
  },

  updateQuantity: (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(menuItemId)
      return
    }

    set(state => ({
      cart: state.cart.map(item =>
        item.menu_item_id === menuItemId
          ? { ...item, quantity }
          : item
      )
    }))
  },

  clearCart: () => {
    set({ cart: [], customerName: null })
  },

  setCustomerName: (name: string | null) => {
    set({ customerName: name })
  },

  getCartTotal: () => {
    const { cart } = get()
    return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0)
  }
}))