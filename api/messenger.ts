// Minimal Facebook Messenger webhook for Vercel Serverless Functions
// - Verifies webhook (GET)
// - Accepts events (POST)
// - Sends basic text replies via Graph API

import crypto from 'crypto'

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const FB_APP_SECRET = process.env.FB_APP_SECRET
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN

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

function extractMessagingEvents(entry: any): any[] {
  const events = [] as any[]
  const messaging = entry.messaging || entry.standby || []
  for (const evt of messaging) events.push(evt)
  return events
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

          // Basic routing stub
          if (event.message?.text) {
            const text = (event.message.text as string).trim().toLowerCase()
            if (text.includes('menu')) {
              // Placeholder response for Today\'s Menu
              await sendTextMessage(senderId, "Here is today's menu. (Coming soon)")
            } else if (text === 'cart') {
              await sendTextMessage(senderId, 'Your cart is empty. (Coming soon)')
            } else {
              await sendTextMessage(senderId, "Hi! Reply with 'menu' to see today's items.")
            }
          } else if (event.postback?.payload) {
            await sendTextMessage(senderId, 'Action received. (Coming soon)')
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


