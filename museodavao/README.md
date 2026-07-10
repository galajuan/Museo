# MuseoDavao

A single website that brings together Davao City's three museums — **Museo Dabawenyo**,
the **D'Bone Collector Museum**, and the **National Museum of the Philippines – Davao** —
with a shared events calendar, a chatbot ("The Docent"), an online shop, and an admin dashboard.

Built with plain **HTML, CSS, and JavaScript** + **Supabase** (database, auth, and row-level security).

---

## 1. Add your hero photo

Put your photo in `images/Hero2.jpeg` (exact filename). The homepage hero already references it —
nothing else to change.

## 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (free tier is enough).
2. Once it's ready, open **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run.
   This creates all tables, security rules, the 3 museums, and a few sample shop products.
3. Go to **Project Settings → API**. Copy your **Project URL** and **anon public** key.
4. Open `js/supabase-client.js` and paste them in:
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```
5. In **Authentication → Providers**, make sure **Email** is enabled (it is by default).
   For quick local testing, you can also turn off "Confirm email" under
   **Authentication → Settings** so new accounts can log in immediately.

## 3. Create your first admin account

1. Open the site → `login.html` → sign up normally with your own email. This creates a regular
   "customer" profile.
2. Back in Supabase → **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Log out and log back in — you'll now be redirected to `admin.html` and can add/edit/remove
   products and events, and manage orders.

## 4. Run the site

This is a static site — no build step. Easiest options:
- Open `index.html` directly in a browser, **or**
- Serve the folder locally for the best experience (avoids some browser file:// restrictions):
  ```
  npx serve .
  ```
  or, with Python:
  ```
  python3 -m http.server 8000
  ```

## Project structure

```
museodavao/
├── index.html              Home — hero, 3 wings, events, shop preview
├── museo-dabawenyo.html    Wing I
├── dbone-collection.html   Wing II
├── national-museum.html    Wing III
├── shop.html               Product grid + checkout
├── receipt.html            Downloadable / printable receipt
├── login.html               Login & signup
├── account.html             Customer order history
├── admin.html                Admin dashboard (products, events, orders)
├── css/style.css
├── js/
│   ├── supabase-client.js   ← put your Project URL + anon key here
│   ├── auth.js               Sign up / log in / session helpers
│   ├── layout.js              Shared header, footer, cart & chatbot shells
│   ├── cart.js                 localStorage shopping basket
│   ├── chatbot.js               "The Docent" — rule-based museum Q&A
│   ├── events.js                 Loads events for the homepage
│   ├── shop.js                    Product grid + checkout logic
│   ├── receipt.js                  Receipt render + PDF download/print
│   └── admin.js                     Admin dashboard CRUD
├── images/                    Put Hero2.jpeg here
└── supabase/schema.sql         Run this once in Supabase's SQL editor
```

## How ordering works

1. Visitor browses **Shop**, adds items to the basket (persisted in the browser via localStorage).
2. At checkout they choose:
   - **Walk-in pickup** or **Delivery** (fulfillment type)
   - **Payment method**: GCash, BDO, BPI, or Cash
   - For GCash/BDO/BPI, they enter a payment reference number so staff can match the payment.
3. An order is created in Supabase (`orders` + `order_items`), status starts as `pending`.
4. The customer lands on **receipt.html**, where they can **download a PDF** or **print** the receipt.
5. In **Admin → Orders**, staff move the order through `pending → paid → preparing → ready → completed`
   (or `cancelled`) as it's handled.

## About the chatbot

"The Docent" is a lightweight, keyword-driven assistant — no external API required, so it works
immediately with zero extra setup or cost. It answers questions about hours, tickets, addresses,
each museum's background, ordering, and payment methods, with a warm, human tone rather than
robotic replies. If you'd like to upgrade it to a full AI model later, `js/chatbot.js` is written
so you only need to replace the body of `md_answer()` with a call to your model of choice — the
rest of the UI (bubble, launcher, suggestions) stays the same.

## Notes & next steps

- Payments are **manual/reference-based** (no live payment gateway) — this matches how GCash/bank
  transfers are commonly handled by small Philippine shops: the customer pays outside the site and
  enters a reference number, and an admin confirms it in the dashboard.
- Product images: paste any public image URL into the Image URL field in the admin form (Supabase
  Storage works great for this if you want to host images yourself).
- Row Level Security is on for every table — customers can only see their own orders; only admins
  can write to products/events or update order status.
