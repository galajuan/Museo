-- =========================================================
-- MuseoDavao — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- =========================================================

-- 1. PROFILES (extends auth.users) --------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  email text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. MUSEUMS (the 3 fixed venues, used to tag events/products) ---
create table if not exists public.museums (
  id text primary key, -- 'dabawenyo' | 'dbone' | 'national'
  name text not null,
  description text,
  address text,
  hours text,
  entrance_fee text
);

insert into public.museums (id, name, description, address, hours, entrance_fee) values
('dabawenyo','Museo Dabawenyo','The heritage museum of Davao City, housed in the old Court of First Instance building, tracing the city''s history from pre-colonial settlement to the present.','Magsaysay Park, Davao City','Tue–Sun, 8:00 AM – 5:00 PM','Free'),
('dbone','D''Bone Collector Museum','A natural history museum of cleaned animal bones and skeletons, founded by wildlife rescuer Darrell Blatchley, focused on marine conservation.','Bolton Extension, Davao City','Mon–Sun, 9:00 AM – 6:00 PM','₱60 (Adult) / ₱40 (Student)'),
('national','National Museum of the Philippines – Davao','A regional branch of the National Museum showcasing Mindanao''s ethnography, archaeology, and natural history.','San Pedro Street, Davao City','Tue–Sun, 9:00 AM – 4:00 PM','Free')
on conflict (id) do nothing;

-- 3. EVENTS --------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  museum_id text references public.museums(id),
  title text not null,
  description text,
  event_date date not null,
  event_time text,
  image_url text,
  created_at timestamptz default now()
);

-- 4. PRODUCTS (shop) ------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  museum_id text references public.museums(id),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  stock int not null default 0,
  image_url text,
  category text default 'souvenir',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. ORDERS ----------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  user_id uuid references public.profiles(id),
  guest_name text,
  guest_email text,
  guest_phone text,
  fulfillment text not null check (fulfillment in ('online','physical')), -- delivery vs walk-in pickup
  delivery_address text,
  payment_method text not null check (payment_method in ('gcash','bdo','bpi','cash')),
  payment_reference text,
  status text not null default 'pending' check (status in ('pending','paid','preparing','ready','completed','cancelled')),
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null,
  line_total numeric(10,2) not null
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;
alter table public.museums enable row level security;
alter table public.events enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- PROFILES policies
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- MUSEUMS: public read, admin write
create policy "museums_public_read" on public.museums for select using (true);
create policy "museums_admin_write" on public.museums for all using (public.is_admin());

-- EVENTS: public read, admin write
create policy "events_public_read" on public.events for select using (true);
create policy "events_admin_write" on public.events for all using (public.is_admin());

-- PRODUCTS: public read active items, admin full access
create policy "products_public_read" on public.products for select using (is_active = true or public.is_admin());
create policy "products_admin_write" on public.products for all using (public.is_admin());

-- ORDERS: owner or admin can read; anyone (incl. guests via anon key) can insert; only admin can update status
create policy "orders_select_own_or_admin" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());
create policy "orders_insert_anyone" on public.orders
  for insert with check (true);
create policy "orders_admin_update" on public.orders
  for update using (public.is_admin());

-- ORDER ITEMS: follow parent order visibility
create policy "order_items_select_own_or_admin" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );
create policy "order_items_insert_anyone" on public.order_items
  for insert with check (true);

-- =========================================================
-- SEED PRODUCTS (sample souvenirs — edit freely in Admin Dashboard)
-- =========================================================
insert into public.products (museum_id, name, description, price, stock, image_url, category) values
('dabawenyo','Davao Heritage Postcard Set','Set of 6 illustrated postcards of old Davao landmarks.',150.00,40,'','souvenir'),
('dbone','Whale Bone Replica Keychain','Miniature resin replica of a sperm whale rib bone.',180.00,25,'','souvenir'),
('national','Mindanao Weave Coin Purse','Handwoven T''nalak-pattern coin purse by local artisans.',250.00,30,'','souvenir')
on conflict do nothing;

-- =========================================================
-- HOW TO MAKE YOUR FIRST ADMIN ACCOUNT
-- 1. Sign up normally on the website (creates a 'customer' profile).
-- 2. Run this, replacing the email:
--    update public.profiles set role = 'admin' where email = 'you@example.com';
-- =========================================================
