This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

# Shankar Enterprises - Supabase SQL Reference

> **Purpose:** Copy-paste SQL reference for routine database checks and maintenance.
>
> **Important:** Run destructive statements only in the Supabase SQL Editor after replacing every placeholder such as `CUS000XX`, `ORD000XX`, and `PRD000XX`. Always run the preview `SELECT` first.

---

## 0. Safety rules

```sql
-- Use a transaction for manual data corrections.
begin;

-- Run your update/delete here.

-- Check the affected rows before making the change permanent.
-- Use ONE of the following:
commit;
-- rollback;
```

Recommended before a large change:

```sql
-- Supabase dashboard backups are preferred for a full restore.
-- For a quick table snapshot inside PostgreSQL:
create table public.orders_backup_yyyymmdd as
select * from public.orders;
```

Do not directly update or delete records from `storage.objects`. Use the Supabase Storage API or Storage dashboard for file operations.

---

# 1. Schema and database inspection

## 1.1 Show all public tables

```sql
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;
```

## 1.2 Show all tables with approximate row counts

```sql
select
  schemaname,
  relname as table_name,
  n_live_tup as approximate_rows
from pg_stat_user_tables
where schemaname = 'public'
order by relname;
```

## 1.3 Describe every public table and column

```sql
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

## 1.4 Describe one table

Replace `products` with `users`, `orders`, or `order_items`.

```sql
select
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
order by ordinal_position;
```

## 1.5 Show primary keys

```sql
select
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'PRIMARY KEY'
order by tc.table_name, kcu.ordinal_position;
```

## 1.6 Show foreign-key relationships

```sql
select
  tc.table_name as child_table,
  kcu.column_name as child_column,
  ccu.table_name as parent_table,
  ccu.column_name as parent_column,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
order by child_table, child_column;
```

## 1.7 Show indexes

```sql
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

## 1.8 Show database functions/RPCs

```sql
select
  routine_name,
  routine_type,
  data_type as return_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;
```

## 1.9 Refresh Supabase/PostgREST schema cache

```sql
notify pgrst, 'reload schema';
```

---

# 2. Customer and user queries

Current known `users` fields:

```text
user_id, name, phone, password, role, address, is_active, created_at
```

## 2.1 List all customers

```sql
select
  user_id,
  name,
  phone,
  role,
  address,
  is_active,
  created_at
from public.users
where role = 'CUSTOMER'
order by created_at desc;
```

## 2.2 Find a customer by ID or phone

```sql
select *
from public.users
where user_id = 'CUS000XX'
   or phone = 'REPLACE_PHONE_NUMBER';
```

## 2.3 Check whether a phone number already exists

```sql
select exists (
  select 1
  from public.users
  where phone = 'REPLACE_PHONE_NUMBER'
) as phone_already_exists;
```

## 2.4 Add a new customer

> Replace all sample values. Use a unique `user_id` and phone number.

```sql
insert into public.users (
  user_id,
  name,
  phone,
  password,
  role,
  address,
  is_active
)
values (
  'CUS000XX',
  'CUSTOMER NAME',
  'PHONE NUMBER',
  'TEMPORARY PASSWORD',
  'CUSTOMER',
  'CUSTOMER ADDRESS',
  true
)
returning
  user_id,
  name,
  phone,
  role,
  address,
  is_active,
  created_at;
```

> **Security note:** This query follows the current custom `users.password` design. Plain-text passwords are unsafe. If the project later moves to Supabase Auth or hashed passwords, do not use this query for credentials.

## 2.5 Update a customer password

Preview the account first:

```sql
select user_id, name, phone, role, is_active
from public.users
where user_id = 'CUS000XX';
```

Then update:

```sql
update public.users
set password = 'NEW TEMPORARY PASSWORD'
where user_id = 'CUS000XX'
  and role = 'CUSTOMER'
returning user_id, name, phone, role, is_active;
```

## 2.6 Update customer details

```sql
update public.users
set
  name = 'UPDATED NAME',
  phone = 'UPDATED PHONE',
  address = 'UPDATED ADDRESS'
where user_id = 'CUS000XX'
  and role = 'CUSTOMER'
returning user_id, name, phone, address, is_active;
```

## 2.7 Activate a customer

```sql
update public.users
set is_active = true
where user_id = 'CUS000XX'
  and role = 'CUSTOMER'
returning user_id, name, is_active;
```

## 2.8 Deactivate a customer

Preferred over deletion when the customer has order history:

```sql
update public.users
set is_active = false
where user_id = 'CUS000XX'
  and role = 'CUSTOMER'
returning user_id, name, is_active;
```

## 2.9 Check customer dependencies before deletion

```sql
select
  u.user_id,
  u.name,
  u.phone,
  count(distinct o.order_id) as order_count
from public.users u
left join public.orders o
  on o.customer_id = u.user_id
where u.user_id = 'CUS000XX'
group by u.user_id, u.name, u.phone;
```

## 2.10 Delete a customer only when no orders exist

```sql
begin;

-- Preview target customer.
select *
from public.users
where user_id = 'CUS000XX'
  and role = 'CUSTOMER';

-- Safe delete: blocked when orders exist.
delete from public.users u
where u.user_id = 'CUS000XX'
  and u.role = 'CUSTOMER'
  and not exists (
    select 1
    from public.orders o
    where o.customer_id = u.user_id
  )
returning u.user_id, u.name, u.phone;

commit;
```

If zero rows are returned, either the customer does not exist or the customer has linked orders. Deactivate the customer instead of erasing business history.

## 2.11 Count active and inactive customers

```sql
select
  is_active,
  count(*) as customer_count
from public.users
where role = 'CUSTOMER'
group by is_active
order by is_active desc;
```

---

# 3. Product queries

Current known `products` fields:

```text
product_id, category, product_name, price, available_quantity,
image_url, is_visible, created_at, updated_at, gst_rate, image_size_bytes
```

## 3.1 List all products

```sql
select
  product_id,
  category,
  product_name,
  price,
  available_quantity,
  gst_rate,
  is_visible,
  image_url,
  created_at,
  updated_at
from public.products
order by created_at desc;
```

## 3.2 Find one product

```sql
select *
from public.products
where product_id = 'PRD000XX';
```

## 3.3 Add a product

```sql
insert into public.products (
  product_id,
  category,
  product_name,
  price,
  available_quantity,
  image_url,
  image_size_bytes,
  gst_rate,
  is_visible
)
values (
  'PRD000XX',
  'CATEGORY',
  'PRODUCT NAME',
  0.00,
  0,
  null,
  0,
  0.00,
  true
)
returning *;
```

If `product_id` is generated automatically in the current database, omit `product_id` from both the column list and values list.

## 3.4 Update product price and quantity

```sql
update public.products
set
  price = 999.00,
  available_quantity = 25
where product_id = 'PRD000XX'
returning product_id, product_name, price, available_quantity;
```

## 3.5 Increase product stock

```sql
update public.products
set available_quantity = coalesce(available_quantity, 0) + 10
where product_id = 'PRD000XX'
returning product_id, product_name, available_quantity;
```

## 3.6 Reduce product stock safely

```sql
update public.products
set available_quantity = available_quantity - 2
where product_id = 'PRD000XX'
  and available_quantity >= 2
returning product_id, product_name, available_quantity;
```

If zero rows are returned, the product does not exist or there is insufficient stock.

## 3.7 Show or hide a product

```sql
-- Show product
update public.products
set is_visible = true
where product_id = 'PRD000XX';

-- Hide product
update public.products
set is_visible = false
where product_id = 'PRD000XX';
```

## 3.8 List low-stock and out-of-stock products

```sql
select
  product_id,
  product_name,
  available_quantity,
  case
    when available_quantity = 0 then 'OUT_OF_STOCK'
    when available_quantity <= 5 then 'LOW_STOCK'
    else 'IN_STOCK'
  end as stock_status
from public.products
where available_quantity <= 5
order by available_quantity, product_name;
```

## 3.9 Check whether a product is linked to orders

```sql
select
  p.product_id,
  p.product_name,
  count(oi.order_item_id) as linked_order_items
from public.products p
left join public.order_items oi
  on oi.product_id = p.product_id
where p.product_id = 'PRD000XX'
group by p.product_id, p.product_name;
```

## 3.10 Delete an unused product only

```sql
begin;

delete from public.products p
where p.product_id = 'PRD000XX'
  and not exists (
    select 1
    from public.order_items oi
    where oi.product_id = p.product_id
  )
returning p.product_id, p.product_name;

commit;
```

If the product has order history, set `is_visible = false` instead.

---

# 4. GST queries

## 4.1 Set future product GST default to zero

```sql
alter table public.products
alter column gst_rate set default 0.00;
```

## 4.2 Set all existing product GST values to zero

```sql
begin;

update public.products
set gst_rate = 0.00
where gst_rate is distinct from 0.00;

commit;
```

## 4.3 Set only existing 18% GST values to zero

```sql
update public.products
set gst_rate = 0.00
where gst_rate = 18;
```

## 4.4 Verify GST values and default

```sql
select
  column_name,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name = 'gst_rate';

select
  product_id,
  product_name,
  gst_rate
from public.products
order by product_id;
```

## 4.5 Important historical-order note

Changing `products.gst_rate` does not automatically rewrite GST snapshots already stored in `order_items` or totals stored in `orders`. Historical financial data should normally remain unchanged.

---

# 5. Order queries

Current known `orders` fields:

```text
order_id, customer_id, subtotal, gst_amount, total_amount,
paid_amount, payment_status, status, admin_note, created_at, updated_at
```

Current known `order_items` fields:

```text
order_item_id, order_id, product_id, product_name_snapshot,
quantity, price_at_order, gst_rate, gst_amount, line_total
```

## 5.1 List recent orders with customer details

```sql
select
  o.order_id,
  o.customer_id,
  u.name as customer_name,
  u.phone,
  o.subtotal,
  o.gst_amount,
  o.total_amount,
  o.paid_amount,
  o.payment_status,
  o.status,
  o.created_at,
  o.updated_at
from public.orders o
left join public.users u
  on u.user_id = o.customer_id
order by o.created_at desc;
```

## 5.2 View one complete order

```sql
select *
from public.orders
where order_id = 'ORD000XX';

select
  oi.*,
  p.product_name as current_product_name
from public.order_items oi
left join public.products p
  on p.product_id = oi.product_id
where oi.order_id = 'ORD000XX'
order by oi.order_item_id;
```

## 5.3 Show orders for one customer

```sql
select *
from public.orders
where customer_id = 'CUS000XX'
order by created_at desc;
```

## 5.4 Update order status

> Prefer the application's status-change RPC if it contains stock-restoration logic.

```sql
update public.orders
set
  status = 'DELIVERED',
  updated_at = now()
where order_id = 'ORD000XX'
returning order_id, status, updated_at;
```

Known statuses used by the application:

```text
PENDING, IN_PROCESS, PARTIAL, DELIVERED, CANCELLED
```

## 5.5 Update payment details

```sql
update public.orders
set
  paid_amount = 1000.00,
  payment_status = 'PARTIALLY_PAID',
  updated_at = now()
where order_id = 'ORD000XX'
returning
  order_id,
  total_amount,
  paid_amount,
  payment_status,
  updated_at;
```

Known payment statuses:

```text
NOT_PAID, PARTIALLY_PAID, PAID
```

## 5.6 Update admin note

```sql
update public.orders
set
  admin_note = 'REPLACE WITH NOTE',
  updated_at = now()
where order_id = 'ORD000XX'
returning order_id, admin_note, updated_at;
```

## 5.7 Permanently delete an order using the project RPC

The project uses `delete_order_permanently`, which restores `products.available_quantity` for non-cancelled orders before deleting the order items and order.

Preview first:

```sql
select *
from public.orders
where order_id = 'ORD000XX';

select *
from public.order_items
where order_id = 'ORD000XX';
```

Delete:

```sql
select public.delete_order_permanently('ORD000XX');
```

Verify:

```sql
select *
from public.orders
where order_id = 'ORD000XX';

select *
from public.order_items
where order_id = 'ORD000XX';
```

Both verification queries should return zero rows.

## 5.8 Recreate or repair the permanent-order-delete RPC

```sql
create or replace function public.delete_order_permanently(
  p_order_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_status text;
  v_item record;
begin
  select status::text
  into v_order_status
  from public.orders
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'Order % was not found.', p_order_id;
  end if;

  -- Cancelled orders were already restocked by the status-change flow.
  if v_order_status <> 'CANCELLED' then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id
    loop
      update public.products
      set available_quantity =
        coalesce(available_quantity, 0) + v_item.quantity
      where product_id = v_item.product_id;

      if not found then
        raise exception
          'Product % linked to order % was not found.',
          v_item.product_id,
          p_order_id;
      end if;
    end loop;
  end if;

  delete from public.order_items
  where order_id = p_order_id;

  delete from public.orders
  where order_id = p_order_id;

  if not found then
    raise exception 'Unable to delete order %.', p_order_id;
  end if;
end;
$$;

grant execute
on function public.delete_order_permanently(text)
to anon, authenticated;

notify pgrst, 'reload schema';
```

Do not replace this RPC with two unrelated frontend delete calls. The RPC keeps stock restoration and deletion in one transaction.

## 5.9 Order counts by status

```sql
select
  status,
  count(*) as order_count,
  coalesce(sum(total_amount), 0) as total_amount
from public.orders
group by status
order by status;
```

## 5.10 Delivered revenue

```sql
select
  count(*) as delivered_orders,
  coalesce(sum(total_amount), 0) as delivered_revenue
from public.orders
where status = 'DELIVERED';
```

## 5.11 Revenue by month

```sql
select
  date_trunc('month', created_at) as revenue_month,
  count(*) as delivered_orders,
  coalesce(sum(total_amount), 0) as delivered_revenue
from public.orders
where status = 'DELIVERED'
group by date_trunc('month', created_at)
order by revenue_month desc;
```

## 5.12 Orders with outstanding payment

```sql
select
  order_id,
  customer_id,
  total_amount,
  paid_amount,
  total_amount - paid_amount as outstanding_amount,
  payment_status,
  status,
  created_at
from public.orders
where coalesce(paid_amount, 0) < total_amount
order by created_at desc;
```

---

# 6. Storage queries

## 6.1 List Storage buckets

```sql
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
from storage.buckets
order by name;
```

## 6.2 List files in the `Products` bucket

```sql
select
  id,
  bucket_id,
  name,
  (metadata ->> 'size')::bigint as size_bytes,
  metadata ->> 'mimetype' as mime_type,
  created_at,
  updated_at
from storage.objects
where bucket_id = 'Products'
order by created_at desc;
```

## 6.3 Total image-storage usage

```sql
select
  count(*) as total_files,
  coalesce(
    sum((metadata ->> 'size')::bigint),
    0
  ) as total_bytes,
  round(
    coalesce(
      sum((metadata ->> 'size')::bigint),
      0
    ) / 1024.0 / 1024.0,
    2
  ) as total_mb
from storage.objects
where bucket_id = 'Products';
```

## 6.4 Show largest files

```sql
select
  name,
  (metadata ->> 'size')::bigint as size_bytes,
  round(
    (metadata ->> 'size')::numeric / 1024.0 / 1024.0,
    2
  ) as size_mb,
  created_at
from storage.objects
where bucket_id = 'Products'
order by (metadata ->> 'size')::bigint desc;
```

## 6.5 Recreate the storage-usage RPC

```sql
create or replace function public.get_products_storage_usage()
returns bigint
language sql
stable
security definer
set search_path = public, storage
as $$
  select
    coalesce(
      sum(
        coalesce(
          (metadata ->> 'size')::bigint,
          0
        )
      ),
      0
    )::bigint
  from storage.objects
  where bucket_id = 'Products';
$$;

revoke all
on function public.get_products_storage_usage()
from public;

grant execute
on function public.get_products_storage_usage()
to anon, authenticated;

notify pgrst, 'reload schema';
```

## 6.6 Test storage-usage RPC

```sql
select public.get_products_storage_usage();
```

---

# 7. Data-quality and maintenance queries

## 7.1 Find duplicate customer phone numbers

```sql
select
  phone,
  count(*) as duplicate_count,
  array_agg(user_id order by user_id) as user_ids
from public.users
where phone is not null
  and btrim(phone) <> ''
group by phone
having count(*) > 1
order by duplicate_count desc, phone;
```

## 7.2 Find orders whose customer is missing

```sql
select o.*
from public.orders o
left join public.users u
  on u.user_id = o.customer_id
where u.user_id is null;
```

## 7.3 Find order items whose order is missing

```sql
select oi.*
from public.order_items oi
left join public.orders o
  on o.order_id = oi.order_id
where o.order_id is null;
```

## 7.4 Find order items whose product is missing

```sql
select oi.*
from public.order_items oi
left join public.products p
  on p.product_id = oi.product_id
where p.product_id is null;
```

## 7.5 Find invalid negative values

```sql
select *
from public.products
where price < 0
   or available_quantity < 0
   or gst_rate < 0;

select *
from public.orders
where subtotal < 0
   or gst_amount < 0
   or total_amount < 0
   or paid_amount < 0;

select *
from public.order_items
where quantity <= 0
   or price_at_order < 0
   or gst_amount < 0
   or line_total < 0;
```

## 7.6 Compare order totals with item totals

```sql
select
  o.order_id,
  o.subtotal as stored_subtotal,
  coalesce(sum(oi.price_at_order * oi.quantity), 0) as calculated_subtotal,
  o.gst_amount as stored_gst,
  coalesce(sum(oi.gst_amount), 0) as calculated_gst,
  o.total_amount as stored_total,
  coalesce(sum(oi.line_total), 0) as calculated_total
from public.orders o
left join public.order_items oi
  on oi.order_id = o.order_id
group by
  o.order_id,
  o.subtotal,
  o.gst_amount,
  o.total_amount
having
  o.subtotal is distinct from
    coalesce(sum(oi.price_at_order * oi.quantity), 0)
  or o.gst_amount is distinct from
    coalesce(sum(oi.gst_amount), 0)
  or o.total_amount is distinct from
    coalesce(sum(oi.line_total), 0)
order by o.order_id;
```

## 7.7 Products without images

```sql
select
  product_id,
  product_name,
  is_visible,
  created_at
from public.products
where image_url is null
   or btrim(image_url) = ''
order by created_at desc;
```

## 7.8 Product rows with image URL but no recorded image size

```sql
select
  product_id,
  product_name,
  image_url,
  image_size_bytes
from public.products
where image_url is not null
  and coalesce(image_size_bytes, 0) = 0
order by created_at desc;
```

---

# 8. Quick dashboard queries

## 8.1 Dashboard totals

```sql
select
  (select count(*) from public.products) as total_products,
  (
    select count(*)
    from public.users
    where role = 'CUSTOMER'
  ) as total_customers,
  (select count(*) from public.orders) as total_orders,
  (
    select count(*)
    from public.orders
    where status = 'DELIVERED'
  ) as delivered_orders,
  (
    select coalesce(sum(total_amount), 0)
    from public.orders
    where status = 'DELIVERED'
  ) as delivered_revenue;
```

## 8.2 New products by day

```sql
select
  created_at::date as created_date,
  count(*) as products_added
from public.products
group by created_at::date
order by created_date desc;
```

## 8.3 Orders by day

```sql
select
  created_at::date as order_date,
  count(*) as order_count
from public.orders
group by created_at::date
order by order_date desc;
```

## 8.4 Delivered revenue by day

```sql
select
  created_at::date as revenue_date,
  count(*) as delivered_orders,
  coalesce(sum(total_amount), 0) as delivered_revenue
from public.orders
where status = 'DELIVERED'
group by created_at::date
order by revenue_date desc;
```

---

# 9. Fast troubleshooting queries

## 9.1 Confirm a required column exists

```sql
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name = 'available_quantity';
```

## 9.2 Confirm an RPC exists

```sql
select
  routine_name,
  data_type as return_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'delete_order_permanently';
```

## 9.3 Show current database triggers

```sql
select
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;
```

## 9.4 Show Row Level Security status

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

## 9.5 Show RLS policies

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

---

# 10. Placeholder checklist

Before running a write/delete query, replace:

```text
CUS000XX                Customer ID
ORD000XX                Order ID
PRD000XX                Product ID
CUSTOMER NAME           Customer name
PHONE NUMBER            Customer phone
TEMPORARY PASSWORD      Current custom-login password
CUSTOMER ADDRESS        Customer address
```

Always run the matching `SELECT` first and verify that exactly the intended record is returned.

