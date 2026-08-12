alter table public.vendor_products
  add column if not exists size_prices jsonb not null default '{}'::jsonb,
  add column if not exists hair_origin_prices jsonb not null default '{}'::jsonb;

update public.vendor_products as product
set size_prices = coalesce(
  (
    select jsonb_object_agg(option_name, product.price)
    from unnest(product.sizes) as option_name
  ),
  '{}'::jsonb
)
where size_prices = '{}'::jsonb;

update public.vendor_products as product
set hair_origin_prices = coalesce(
  (
    select jsonb_object_agg(option_name, product.price)
    from unnest(product.hair_origins) as option_name
  ),
  '{}'::jsonb
)
where hair_origin_prices = '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_products_size_prices_check'
      and conrelid = 'public.vendor_products'::regclass
  ) then
    alter table public.vendor_products
      add constraint vendor_products_size_prices_check
      check (jsonb_typeof(size_prices) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_products_hair_origin_prices_check'
      and conrelid = 'public.vendor_products'::regclass
  ) then
    alter table public.vendor_products
      add constraint vendor_products_hair_origin_prices_check
      check (jsonb_typeof(hair_origin_prices) = 'object');
  end if;
end $$;

notify pgrst, 'reload schema';
