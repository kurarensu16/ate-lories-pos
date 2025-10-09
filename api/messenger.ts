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
  
  if (text.includes('menu') || text === '1') {
    await showTodaysMenu(senderId)
  } else if (text === 'cart' || text === '2') {
    await showCart(senderId, session)
  } else if (text === 'checkout' || text === '3') {
    await checkout(senderId, session)
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
      cart_items: []
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
  
  let message = "🍽️ *Today's Menu*\n\n"
  
  for (const item of menuItems) {
    message += `• ${item.name} - $${item.price}\n`
    if (item.description) {
      message += `  ${item.description}\n`
    }
    message += "\n"
  }
  
  message += "Reply with 'add [item name]' to add to cart, or 'cart' to view your order."
  
  await sendTextMessage(senderId, message)
}

async function showCart(senderId: string, session: any) {
  const cartItems = session.cart_items || []
  
  if (cartItems.length === 0) {
    await sendTextMessage(senderId, "Your cart is empty. Reply with 'menu' to see today's items.")
    return
  }
  
  let message = "🛒 *Your Order*\n\n"
  let total = 0
  
  for (const item of cartItems) {
    const subtotal = item.price * item.quantity
    total += subtotal
    message += `${item.name} x${item.quantity} - $${subtotal.toFixed(2)}\n`
  }
  
  message += `\n*Total: $${total.toFixed(2)}*\n\n`
  message += "Reply with 'checkout' to place your order, or 'clear' to empty cart."
  
  await sendTextMessage(senderId, message)
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
  
  await sendTextMessage(senderId, "Cart cleared! Reply with 'menu' to see today's items.")
}

async function checkout(senderId: string, session: any) {
  const cartItems = session.cart_items || []
  
  if (cartItems.length === 0) {
    await sendTextMessage(senderId, "Your cart is empty. Reply with 'menu' to see today's items.")
    return
  }
  
  try {
    // Calculate total
    const total = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    
    // Create order first
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: 'Messenger Customer',
        total_amount: total,
        status: 'active',
        table_id: null,
        staff_notes: 'Order placed via Messenger'
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
    
    // Create order items
    const orderItems = cartItems.map((item: any) => ({
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
    
    // Clear cart
    await supabase
      .from('bot_sessions')
      .update({ cart_items: [] })
      .eq('messenger_psid', senderId)
    
    let message = `✅ *Order Placed Successfully!*\n\n`
    message += `Order #${order.id}\n`
    message += `Total: $${total.toFixed(2)}\n\n`
    message += `Your order is being prepared. You'll receive updates soon!\n\n`
    message += `Reply with 'menu' to place another order.`
    
    await sendTextMessage(senderId, message)
    
  } catch (error) {
    console.error('Checkout error:', error)
    await sendTextMessage(senderId, "Sorry, there was an error placing your order. Please try again.")
  }
}

async function sendWelcomeMessage(senderId: string) {
  const message = `👋 Welcome to Ate Lorie's POS!\n\n`
  + `I can help you:\n`
  + `• View today's menu\n`
  + `• Add items to your cart\n`
  + `• Place orders\n\n`
  + `Reply with:\n`
  + `• "menu" - See today's menu\n`
  + `• "cart" - View your order\n`
  + `• "add [item name]" - Add item to cart\n`
  + `• "checkout" - Place your order`
  
  await sendTextMessage(senderId, message)
}

export default async function handler(req: any, res: any) {
  // Webhook verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
      res.status(200).send(challenge)
    } else {
      res.status(403).send('Forbidden')
    }
    return
  }

  // Events (POST)
  if (req.method === 'POST') {
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
          if (event.message?.text) {
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


