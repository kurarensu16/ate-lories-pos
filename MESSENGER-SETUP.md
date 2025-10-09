## Facebook Messenger Integration Setup

This guide prepares a basic Messenger webhook using Vercel Serverless Functions and connects it to your existing Supabase backend.

### 1) Create a Facebook Page and App
- Create a Facebook Page for your business
- Create a Facebook App in Meta for Developers
- Add the Messenger product to the app

### 2) Gather Credentials
- FB_PAGE_ACCESS_TOKEN (from Messenger settings, connected Page)
- FB_APP_SECRET (App settings > Basic)
- FB_VERIFY_TOKEN (you create this string)

### 3) Configure Environment Variables
Set these in Vercel Project Settings > Environment Variables:
- FB_PAGE_ACCESS_TOKEN
- FB_APP_SECRET
- FB_VERIFY_TOKEN
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE (server-side secure key)

Deploy after adding variables.

### 4) Webhook URL
After deploy, your webhook endpoint is:
- https://ate-lories-pos.vercel.app//api/messenger

In the Facebook App > Messenger > Webhooks:
- Callback URL: the endpoint above
- Verify Token: the value you set for FB_VERIFY_TOKEN
- Subscriptions: messages, messaging_postbacks
- Select your Page and subscribe

### 5) Permissions & App Review
- Enable pages_messaging
- Provide Privacy Policy URL, Terms URL, Data Deletion Instructions URL
- Use a test Page/user in Development Mode for initial testing

### 6) Next Steps (Implementation)
- Map PSID to a customer record in Supabase
- Maintain a session/cart per PSID
- Read Today’s Menu from `menu_items` where `is_today_menu = true`
- Create orders with `source = 'messenger'`

See `sql/20251008_messenger.sql` for suggested schema updates.


