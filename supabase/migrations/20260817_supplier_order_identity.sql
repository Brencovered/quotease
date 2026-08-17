-- Tradie identity for supplier orders + per-supplier customer/account numbers

alter table public.profiles
  add column if not exists trading_name text;

alter table public.profiles
  add column if not exists ordering_contact_name text;

alter table public.supplier_contacts
  add column if not exists account_number text;
