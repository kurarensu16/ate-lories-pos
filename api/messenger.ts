// Facebook Messenger webhook for Vercel Serverless Functions
// - Verifies webhook (GET)
// - Accepts events (POST)
// - Connects to Supabase for menu data and order creation
// - Sends replies via Graph API

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const FB_APP_SECRET = process.env.FB_APP_SECRET
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

// Supabase client (ensure non-null for types); runtime guards check env presence
const supabase = createClient((SUPABASE_URL || '') as string, (SUPABASE_SERVICE_ROLE || '') as string) as any

// Utility to compute HMAC SHA256 for signature verification
function computeAppSecretProof(appSecret: string, payload: string) {
  return crypto.createHmac('sha256', appSecret).update(payload, 'utf8').digest('hex')
}

async function setupMessengerProfile() {
  if (!FB_PAGE_ACCESS_TOKEN) return { ok: false, error: 'Missing PAGE ACCESS TOKEN' }
  const base = 'https://graph.facebook.com/v17.0/me/messenger_profile'
  const url = `${base}?access_token=${FB_PAGE_ACCESS_TOKEN}`

  const body = {
    get_started: { payload: 'GET_STARTED' },
    persistent_menu: [
      {
        locale: 'default',
        composer_input_disabled: false,
        call_to_actions: [
          { type: 'postback', title: "Today's Menu", payload: 'MENU' },
          { type: 'postback', title: 'View Cart', payload: 'VIEW_CART' },
          { type: 'postback', title: 'Checkout', payload: 'CHECKOUT' },
          { type: 'postback', title: 'Place Order', payload: 'PLACE_ORDER' },
        ],
      },
    ],
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await resp.json()
  return json
}
function verifySignature(req: any): boolean {
  try {
    if (!FB_APP_SECRET) return true
    const signatureHeader = req.headers['x-hub-signature-256'] || req.headers['x-hub-signature']
    if (!signatureHeader) return true

    // Vercel does not expose raw body by default; fall back to JSON string
    const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    const expected = 'sha256=' + computeAppSecretProof(FB_APP_SECRET, bodyString)
    return expected === signatureHeader
  } catch (_) {
    return false
  }
}

async function sendTextMessage(recipientId: string, text: string) {
  if (!FB_PAGE_ACCESS_TOKEN) return
  const url = `https://graph.facebook.com/v17.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: { text },
    }),
  })
}

async function sendQuickReplies(recipientId: string, text: string, quickReplies: any[]) {
  if (!FB_PAGE_ACCESS_TOKEN) return
  const url = `https://graph.facebook.com/v17.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: {
        text,
        quick_replies: quickReplies
      },
    }),
  })
}

function defaultQuickReplies() {
  return [
    { content_type: 'text', title: "Today's Menu", payload: 'MENU' },
    { content_type: 'text', title: 'Cart', payload: 'VIEW_CART' },
    { content_type: 'text', title: 'Checkout', payload: 'CHECKOUT' },
    { content_type: 'text', title: 'Help', payload: 'HELP' },
  ]
}

async function sendGenericTemplate(recipientId: string, elements: any[]) {
  if (!FB_PAGE_ACCESS_TOKEN) return
  const url = `https://graph.facebook.com/v17.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements
          }
        }
      },
    }),
  })
}

function extractMessagingEvents(entry: any): any[] {
  const events = [] as any[]
  const messaging = entry.messaging || entry.standby || []
  for (const evt of messaging) events.push(evt)
  return events
}

// Bot logic functions
async function handleTextMessage(senderId: string, text: string) {
  if (!supabase) {
    await sendTextMessage(senderId, "Bot is temporarily unavailable. Please try again later.")
    return
  }
  
  // Ensure customer exists
  await ensureCustomer(senderId)
  
  // Get or create session
  const session = await getOrCreateSession(senderId)
  
  const sessionData = session.session_data || {}
  console.log('Text message handler - Session stage:', session.stage, 'Customer name:', sessionData.customer_name, 'Customer address:', sessionData.customer_address)
  
  // Check if we're collecting customer information
  if (session.stage === 'collecting_name') {
    console.log('Updating customer name:', text.trim())
    
    // Store customer name in cart_items as a special item
    const customerInfo = { type: 'customer_name', value: text.trim() }
    const updatedCartItems = [...(session.cart_items || []), customerInfo]
    
    const { error } = await supabase
      .from('bot_sessions')
      .update({ 
        stage: 'collecting_address',
        cart_items: updatedCartItems
      })
      .eq('messenger_psid', senderId)
    
    if (error) {
      console.error('Error updating customer name:', error)
      await sendTextMessage(senderId, `Sorry, there was an error: ${error.message}. Please try again.`)
      return
    }
    
    await sendTextMessage(senderId, "Great! Now please provide your block and lot number (e.g., Block 5, Lot 12):")
    return
  }
  
  if (session.stage === 'collecting_address') {
    console.log('Updating customer address:', text.trim())
    
    // Get the customer name from cart_items and add address
    const cartItems = session.cart_items || []
    const customerNameItem = cartItems.find((item: any) => item.type === 'customer_name')
    const customerName = customerNameItem?.value || 'Unknown'
    
    const customerAddressInfo = { type: 'customer_address', value: text.trim() }
    const updatedCartItems = [...cartItems, customerAddressInfo]
    
    const { error } = await supabase
      .from('bot_sessions')
      .update({ 
        stage: 'idle',
        cart_items: updatedCartItems
      })
      .eq('messenger_psid', senderId)
    
    if (error) {
      console.error('Error updating customer address:', error)
      await sendTextMessage(senderId, `Sorry, there was an error: ${error.message}. Please try again.`)
      return
    }
    
    await sendTextMessage(senderId, "Perfect! Now you can place your order. Reply with 'place order' to complete your order.")
    return
  }
  
  if (text.includes('menu') || text === '1') {
    await showTodaysMenu(senderId)
  } else if (text === 'cart' || text === '2') {
    await showCart(senderId, session)
  } else if (text === 'checkout' || text === '3') {
    await checkout(senderId, session)
  } else if (text === 'place order' || text === 'placeorder') {
    await placeOrder(senderId, session)
  } else if (text.startsWith('add ')) {
    const itemName = text.replace('add ', '').trim()
    await addToCart(senderId, session, itemName)
  } else if (text === 'clear' || text === 'reset') {
    await clearCart(senderId, session)
  } else {
    await sendWelcomeMessage(senderId)
  }
}

async function handlePostback(senderId: string, payload: string) {
  if (!supabase) {
    await sendTextMessage(senderId, "Bot is temporarily unavailable. Please try again later.")
    return
  }
  
  const session = await getOrCreateSession(senderId)
  
  if (payload.startsWith('ADD_')) {
    const itemId = payload.replace('ADD_', '')
    await addToCartById(senderId, session, itemId)
  } else if (payload.startsWith('REMOVE_')) {
    const itemId = payload.replace('REMOVE_', '')
    await removeFromCart(senderId, session, itemId)
  } else if (payload === 'VIEW_CART') {
    await showCart(senderId, session)
  } else if (payload === 'CHECKOUT') {
    await checkout(senderId, session)
  } else if (payload === 'PLACE_ORDER') {
    console.log('PLACE_ORDER payload received')
    await placeOrder(senderId, session)
  } else if (payload === 'MENU') {
    await showTodaysMenu(senderId)
  } else if (payload === 'HELP') {
    await sendWelcomeMessage(senderId)
  } else if (payload === 'CLEAR_CART') {
    await clearCart(senderId, session)
  }
}

async function ensureCustomer(senderId: string) {
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('messenger_psid', senderId)
    .single()
  
  if (!existing) {
    await supabase
      .from('customers')
      .insert({ messenger_psid: senderId, name: 'Messenger Customer' })
  }
}

async function getOrCreateSession(senderId: string) {
  const { data: existing } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('messenger_psid', senderId)
    .single()
  
  if (existing) {
    return existing
  }
  
  const { data: newSession } = await supabase
    .from('bot_sessions')
    .insert({
      messenger_psid: senderId,
      stage: 'idle',
      cart_items: [],
      session_data: {}
    })
    .select()
    .single()
  
  return newSession
}

async function showTodaysMenu(senderId: string) {
  const { data: menuItems, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_today_menu', true)
    .eq('is_available', true)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Menu fetch error:', error)
    await sendTextMessage(senderId, "Sorry, there was an error loading the menu. Please try again later.")
    return
  }
  
  if (!menuItems || menuItems.length === 0) {
    await sendTextMessage(senderId, "Sorry, there's no menu available today. Please check back later!")
    return
  }
  
  // Build generic template with buttons for Add to Cart / View Cart
  const elements = (menuItems as any[]).map((item: any) => ({
    title: `${item.name} — ₱${Number(item.price).toFixed(2)}`,
    subtitle: item.description || 'Tap to add to cart',
    image_url: item.image_url || undefined,
    buttons: [
      { type: 'postback', title: 'Add to Cart', payload: `ADD_${item.id}` },
      { type: 'postback', title: 'View Cart', payload: 'VIEW_CART' },
    ],
  }))

  for (let i = 0; i < elements.length; i += 10) {
    await sendGenericTemplate(senderId, elements.slice(i, i + 10))
  }

  await sendQuickReplies(senderId, 'Select an action:', [
    { content_type: 'text', title: 'Cart', payload: 'VIEW_CART' },
    { content_type: 'text', title: 'Place Order', payload: 'PLACE_ORDER' },
    { content_type: 'text', title: 'Help', payload: 'HELP' },
  ])
}

async function showCart(senderId: string, session: any) {
  const cartItems = session.cart_items || []
  
  // Filter out customer info items for display
  const menuItems = cartItems.filter((item: any) => item.type !== 'customer_name' && item.type !== 'customer_address')
  
  if (menuItems.length === 0) {
    await sendQuickReplies(senderId, "Your cart is empty. Choose an option:", defaultQuickReplies())
    return
  }
  
  let message = "🛒 *Your Order*\n\n"
  let total = 0
  
  for (const item of menuItems) {
    const subtotal = item.price * item.quantity
    total += subtotal
    message += `${item.name} x${item.quantity} - ₱${subtotal.toFixed(2)}\n`
  }
  
  message += `\n*Total: ₱${total.toFixed(2)}*\n\n`
  await sendQuickReplies(senderId, message, [
    { content_type: 'text', title: 'Checkout', payload: 'CHECKOUT' },
    { content_type: 'text', title: 'Clear Cart', payload: 'CLEAR_CART' },
    { content_type: 'text', title: "Today's Menu", payload: 'MENU' },
  ])
}

async function addToCart(senderId: string, session: any, itemName: string) {
  const { data: menuItem } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_today_menu', true)
    .eq('is_available', true)
    .ilike('name', `%${itemName}%`)
    .single()
  
  if (!menuItem) {
    await sendTextMessage(senderId, `Sorry, "${itemName}" is not available today. Reply with 'menu' to see available items.`)
    return
  }
  
  await addToCartById(senderId, session, menuItem.id)
}

async function addToCartById(senderId: string, session: any, itemId: string) {
  const { data: menuItem } = await supabase
    .from('menu_items')
    .select('*')
    .eq('id', itemId)
    .single()
  
  if (!menuItem) return
  
  const cartItems = session.cart_items || []
  const existingItem = cartItems.find((item: any) => item.id === itemId)
  
  if (existingItem) {
    existingItem.quantity += 1
  } else {
    cartItems.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: 1
    })
  }
  
  await supabase
    .from('bot_sessions')
    .update({ cart_items: cartItems })
    .eq('messenger_psid', senderId)
  
  await sendTextMessage(senderId, `Added ${menuItem.name} to your cart! Reply with 'cart' to view your order.`)
}

async function removeFromCart(senderId: string, session: any, itemId: string) {
  const cartItems = session.cart_items || []
  const updatedItems = cartItems.filter((item: any) => item.id !== itemId)
  
  await supabase
    .from('bot_sessions')
    .update({ cart_items: updatedItems })
    .eq('messenger_psid', senderId)
  
  await sendTextMessage(senderId, "Item removed from cart. Reply with 'cart' to view your order.")
}

async function clearCart(senderId: string, session: any) {
  await supabase
    .from('bot_sessions')
    .update({ cart_items: [] })
    .eq('messenger_psid', senderId)
  
  await sendQuickReplies(senderId, "Cart cleared! What next?", defaultQuickReplies())
}

async function printReceipt(senderId: string, session: any) {
  try {
    // Get the most recent order for this customer
    const sessionData = session.session_data || {}
    const customerName = sessionData.customer_name
    
    if (!customerName) {
      await sendTextMessage(senderId, "No customer information found. Please place an order first.")
      return
    }
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          unit_price,
          special_instructions,
          menu_items (name)
        )
      `)
      .eq('customer_name', customerName)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error || !orders || orders.length === 0) {
      await sendTextMessage(senderId, "No recent orders found. Please place an order first.")
      return
    }
    
    const order = orders[0]
    const orderItems = order.order_items || []
    
    let receipt = `🖨️ *RECEIPT*\n\n`
    receipt += `Order #${order.id}\n`
    receipt += `Customer: ${order.customer_name}\n`
    receipt += `Address: ${order.staff_notes?.replace('Order placed via Messenger - Address: ', '') || 'N/A'}\n`
    receipt += `Date: ${new Date(order.created_at).toLocaleString()}\n`
    receipt += `Status: ${order.status.toUpperCase()}\n\n`
    receipt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    receipt += `ITEMS ORDERED:\n\n`
    
    let total = 0
    orderItems.forEach((item: any) => {
      const itemTotal = item.quantity * item.unit_price
      total += itemTotal
      receipt += `${item.menu_items.name}\n`
      receipt += `  Qty: ${item.quantity} × ₱${item.unit_price.toFixed(2)} = ₱${itemTotal.toFixed(2)}\n`
      if (item.special_instructions) {
        receipt += `  Note: ${item.special_instructions}\n`
      }
      receipt += `\n`
    })
    
    receipt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    receipt += `TOTAL: ₱${total.toFixed(2)}\n\n`
    receipt += `Thank you for your order! 🙏\n`
    receipt += `Keep this receipt for your records.`
    
    await sendTextMessage(senderId, receipt)
    
  } catch (error) {
    console.error('Print receipt error:', error)
    await sendTextMessage(senderId, "Sorry, there was an error generating your receipt. Please try again later.")
  }
}

async function checkout(senderId: string, session: any) {
  const cartItems = session.cart_items || []
  
  if (cartItems.length === 0) {
    await sendTextMessage(senderId, "Your cart is empty. Reply with 'menu' to see today's items.")
    return
  }
  
  // Get fresh session data to ensure we have the latest customer info
  const { data: freshSession } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('messenger_psid', senderId)
    .single()
  
  if (!freshSession) {
    await sendTextMessage(senderId, "Session error. Please try again.")
    return
  }
  
  // Check if we need customer information
  console.log('Checkout - Fresh session:', freshSession)
  
  // Parse customer info from cart_items
  let customerName = 'Messenger Customer'
  let customerAddress = 'Not provided'
  
  const freshCartItems = freshSession.cart_items || []
  const customerNameItem = freshCartItems.find((item: any) => item.type === 'customer_name')
  const customerAddressItem = freshCartItems.find((item: any) => item.type === 'customer_address')
  
  if (customerNameItem) {
    customerName = customerNameItem.value
  }
  if (customerAddressItem) {
    customerAddress = customerAddressItem.value
  }
  
  // Only ask for customer info if we don't have it yet
  if (!customerNameItem) {
    console.log('No customer info found, asking for name')
    const { error } = await supabase
      .from('bot_sessions')
      .update({ stage: 'collecting_name' })
      .eq('messenger_psid', senderId)
    
    if (error) {
      console.error('Error setting collecting_name stage:', error)
      await sendTextMessage(senderId, `Sorry, there was an error: ${error.message}. Please try again.`)
      return
    }
    
    await sendTextMessage(senderId, "Please provide your name for the order:")
    return
  }
  
  if (!customerAddressItem) {
    console.log('No customer address found, asking for address')
    const { error } = await supabase
      .from('bot_sessions')
      .update({ stage: 'collecting_address' })
      .eq('messenger_psid', senderId)
    
    if (error) {
      console.error('Error setting collecting_address stage:', error)
      await sendTextMessage(senderId, `Sorry, there was an error: ${error.message}. Please try again.`)
      return
    }
    
    await sendTextMessage(senderId, "Please provide your block and lot number (e.g., Block 5, Lot 12):")
    return
  }
  
  try {
    // Calculate total (exclude customer info items)
    const menuItems = freshCartItems.filter((item: any) => item.type !== 'customer_name' && item.type !== 'customer_address')
    const total = menuItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    
    // Create order with customer information
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: customerName,
        total_amount: total,
        status: 'active',
        table_id: null,
        staff_notes: `Order placed via Messenger - Address: ${customerAddress}`
      })
      .select()
      .single()
    
    if (orderError) {
      console.error('Order creation error:', orderError)
      await sendTextMessage(senderId, `Order error: ${orderError.message}. Please try again.`)
      return
    }
    
    if (!order) {
      await sendTextMessage(senderId, "Sorry, there was an error placing your order. Please try again.")
      return
    }
    
    // Create order items (only for menu items, not customer info)
    const orderItems = menuItems.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      special_instructions: null
    }))
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
    
    if (itemsError) {
      console.error('Order items creation error:', itemsError)
      // Clean up the order if items failed
      await supabase.from('orders').delete().eq('id', order.id)
      await sendTextMessage(senderId, `Order error: ${itemsError.message}. Please try again.`)
      return
    }
    
    // Clear cart and reset customer info for next order
    await supabase
      .from('bot_sessions')
      .update({ 
        cart_items: [],
        stage: 'idle'
      })
      .eq('messenger_psid', senderId)
    
    let message = `✅ *Order Placed Successfully!*\n\n`
    message += `Order #${order.id}\n`
    message += `Customer: ${customerName}\n`
    message += `Address: ${customerAddress}\n`
    message += `Total: ₱${total.toFixed(2)}\n\n`
    message += `Your order is being prepared. You'll receive updates soon!\n\n`
    message += `Reply with 'menu' to place another order.`
    
    await sendTextMessage(senderId, message)
    
  } catch (error) {
    console.error('Checkout error:', error)
    await sendTextMessage(senderId, "Sorry, there was an error placing your order. Please try again.")
  }
}

async function placeOrder(senderId: string, session: any) {
  console.log('PLACE_ORDER called for senderId:', senderId)
  const cartItems = session.cart_items || []
  console.log('Cart items:', cartItems)
  
  if (cartItems.length === 0) {
    await sendTextMessage(senderId, "Your cart is empty. Reply with 'menu' to see today's items.")
    return
  }
  
  // Get fresh session data to ensure we have the latest customer info
  const { data: freshSession } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('messenger_psid', senderId)
    .single()
  
  if (!freshSession) {
    await sendTextMessage(senderId, "Session error. Please try again.")
    return
  }
  
  // Parse customer info from cart_items
  let customerName = 'Messenger Customer'
  let customerAddress = 'Not provided'
  
  const freshCartItems = freshSession.cart_items || []
  const customerNameItem = freshCartItems.find((item: any) => item.type === 'customer_name')
  const customerAddressItem = freshCartItems.find((item: any) => item.type === 'customer_address')
  
  if (customerNameItem) {
    customerName = customerNameItem.value
  }
  if (customerAddressItem) {
    customerAddress = customerAddressItem.value
  }
  
  // If we don't have customer info, ask for it first
  if (!customerNameItem || !customerAddressItem) {
    if (!customerNameItem) {
      console.log('No customer name found, asking for name')
      const { error } = await supabase
        .from('bot_sessions')
        .update({ stage: 'collecting_name' })
        .eq('messenger_psid', senderId)
      
      if (error) {
        console.error('Error setting collecting_name stage:', error)
        await sendTextMessage(senderId, `Sorry, there was an error: ${error.message}. Please try again.`)
        return
      }
      
      await sendTextMessage(senderId, "Please provide your name for the order:")
      return
    }
    
    if (!customerAddressItem) {
      console.log('No customer address found, asking for address')
      const { error } = await supabase
        .from('bot_sessions')
        .update({ stage: 'collecting_address' })
        .eq('messenger_psid', senderId)
      
      if (error) {
        console.error('Error setting collecting_address stage:', error)
        await sendTextMessage(senderId, `Sorry, there was an error: ${error.message}. Please try again.`)
        return
      }
      
      await sendTextMessage(senderId, "Please provide your block and lot number (e.g., Block 5, Lot 12):")
      return
    }
  }
  
  try {
    // Calculate total (exclude customer info items)
    const menuItems = freshCartItems.filter((item: any) => item.type !== 'customer_name' && item.type !== 'customer_address')
    const total = menuItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    
    // Create order with customer information
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: customerName,
        total_amount: total,
        status: 'active',
        table_id: null,
        staff_notes: `Order placed via Messenger - Address: ${customerAddress}`
      })
      .select()
      .single()
    
    if (orderError) {
      console.error('Order creation error:', orderError)
      await sendTextMessage(senderId, `Order error: ${orderError.message}. Please try again.`)
      return
    }
    
    if (!order) {
      await sendTextMessage(senderId, "Sorry, there was an error placing your order. Please try again.")
      return
    }
    
    // Create order items (only for menu items, not customer info)
    const orderItems = menuItems.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      special_instructions: null
    }))
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
    
    if (itemsError) {
      console.error('Order items creation error:', itemsError)
      // Clean up the order if items failed
      await supabase.from('orders').delete().eq('id', order.id)
      await sendTextMessage(senderId, `Order error: ${itemsError.message}. Please try again.`)
      return
    }
    
    // Clear cart and reset customer info for next order
    await supabase
      .from('bot_sessions')
      .update({ 
        cart_items: [],
        stage: 'idle'
      })
      .eq('messenger_psid', senderId)
    
    let message = `✅ *Order Placed Successfully!*\n\n`
    message += `Order #${order.id}\n`
    message += `Customer: ${customerName}\n`
    message += `Address: ${customerAddress}\n`
    message += `Total: ₱${total.toFixed(2)}\n\n`
    message += `Your order is being prepared. You'll receive updates soon!\n\n`
    message += `Reply with 'menu' to place another order.`
    
    await sendTextMessage(senderId, message)
    
  } catch (error) {
    console.error('Place order error:', error)
    await sendTextMessage(senderId, "Sorry, there was an error placing your order. Please try again.")
  }
}

async function sendWelcomeMessage(senderId: string) {
  const message = `👋 Welcome to Ate Lorie's POS!\n\nTap a button below to begin.`
  await sendQuickReplies(senderId, message, defaultQuickReplies())
}

export default async function handler(req: any, res: any) {
  // Webhook verification (GET)
  if (req.method === 'GET') {
    // Support webhook verification and profile setup via GET for convenience
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (req.query?.setup === 'profile' && req.query?.token === FB_VERIFY_TOKEN) {
      const result = await setupMessengerProfile()
      res.status(200).json(result)
    } else if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
      res.status(200).send(challenge)
    } else {
      res.status(403).send('Forbidden')
    }
    return
  }

  // Events (POST)
  if (req.method === 'POST') {
    if (req.query?.setup === 'profile' && req.query?.token === FB_VERIFY_TOKEN) {
      const result = await setupMessengerProfile()
      res.status(200).json(result)
      return
    }
    if (!verifySignature(req)) {
      // Signature failed; reject but avoid leaking details
      res.status(403).json({ ok: false })
      return
    }

    const body = req.body || {}
    if (body.object !== 'page') {
      res.status(200).json({ ok: true })
      return
    }

    try {
      for (const entry of body.entry || []) {
        const events = extractMessagingEvents(entry)
        for (const event of events) {
          const senderId = event.sender?.id
          if (!senderId) continue

          // Handle incoming messages
          if (event.message?.quick_reply?.payload) {
            await handlePostback(senderId, event.message.quick_reply.payload)
          } else if (event.message?.text) {
            const text = (event.message.text as string).trim().toLowerCase()
            await handleTextMessage(senderId, text)
          } else if (event.postback?.payload) {
            await handlePostback(senderId, event.postback.payload)
          }
        }
      }

      res.status(200).json({ ok: true })
    } catch (e) {
      res.status(200).json({ ok: true })
    }
    return
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).end('Method Not Allowed')
}


