alter table public.vendor_products
  add column if not exists is_featured boolean not null default false,
  add column if not exists display_order integer not null default 0;

with ranked_products as (
  select
    id,
    row_number() over (
      partition by vendor_user_id, collection
      order by created_at asc, id asc
    )::integer as position
  from public.vendor_products
)
update public.vendor_products as product
set display_order = ranked.position
from ranked_products as ranked
where product.id = ranked.id
  and product.display_order = 0;

alter table public.vendor_products
  drop constraint if exists vendor_products_display_order_check;

alter table public.vendor_products
  add constraint vendor_products_display_order_check
  check (display_order >= 0);

alter table public.vendor_products
  drop constraint if exists vendor_products_featured_status_check;

alter table public.vendor_products
  add constraint vendor_products_featured_status_check
  check (not is_featured or status = 'active');

create index if not exists vendor_products_store_order_idx
  on public.vendor_products (
    collection,
    is_featured desc,
    display_order asc,
    created_at desc
  )
  where status = 'active' and stock_quantity > 0;

create or replace function public.enforce_vendor_featured_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  featured_count integer;
begin
  if not new.is_featured then
    return new;
  end if;

  if new.status <> 'active' then
    raise exception 'Only active products can be featured.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.vendor_user_id::text, 0));

  select count(*)
  into featured_count
  from public.vendor_products as product
  where product.vendor_user_id = new.vendor_user_id
    and product.is_featured
    and product.id <> new.id;

  if featured_count >= 4 then
    raise exception 'A vendor can feature no more than four products.';
  end if;

  return new;
end;
$$;

drop trigger if exists vendor_products_featured_limit on public.vendor_products;
create trigger vendor_products_featured_limit
before insert or update of is_featured, vendor_user_id, status
on public.vendor_products
for each row
execute function public.enforce_vendor_featured_limit();

create or replace function public.reorder_vendor_product(
  p_vendor_user_id uuid,
  p_product_id bigint,
  p_direction integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_collection text;
  current_position integer;
  target_product_id bigint;
begin
  if p_direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1.';
  end if;

  select collection
  into product_collection
  from public.vendor_products
  where id = p_product_id
    and vendor_user_id = p_vendor_user_id;

  if product_collection is null then
    return false;
  end if;

  perform 1
  from public.vendor_products
  where vendor_user_id = p_vendor_user_id
    and collection = product_collection
  for update;

  with ranked_products as (
    select
      id,
      row_number() over (
        order by display_order asc, created_at asc, id asc
      )::integer as position
    from public.vendor_products
    where vendor_user_id = p_vendor_user_id
      and collection = product_collection
  )
  update public.vendor_products as product
  set display_order = ranked.position
  from ranked_products as ranked
  where product.id = ranked.id;

  select display_order
  into current_position
  from public.vendor_products
  where id = p_product_id
    and vendor_user_id = p_vendor_user_id;

  select id
  into target_product_id
  from public.vendor_products
  where vendor_user_id = p_vendor_user_id
    and collection = product_collection
    and display_order = current_position + p_direction;

  if target_product_id is null then
    return false;
  end if;

  update public.vendor_products
  set display_order = case
    when id = p_product_id then current_position + p_direction
    when id = target_product_id then current_position
    else display_order
  end,
  updated_at = now()
  where id in (p_product_id, target_product_id)
    and vendor_user_id = p_vendor_user_id;

  return true;
end;
$$;

revoke all on function public.enforce_vendor_featured_limit() from public, anon, authenticated;
revoke all on function public.reorder_vendor_product(uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.reorder_vendor_product(uuid, bigint, integer) to service_role;

notify pgrst, 'reload schema';
