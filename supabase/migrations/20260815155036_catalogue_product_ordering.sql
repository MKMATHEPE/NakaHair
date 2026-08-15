create or replace function public.reorder_vendor_catalogue_product(
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
  current_featured boolean;
  current_position integer;
  target_position integer;
begin
  if p_direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_vendor_user_id::text, 1));

  select is_featured
  into current_featured
  from public.vendor_products
  where id = p_product_id
    and vendor_user_id = p_vendor_user_id;

  if not found then
    return false;
  end if;

  select position
  into current_position
  from (
    select id, row_number() over (
      order by display_order asc, created_at desc, id asc
    )::integer as position
    from public.vendor_products
    where vendor_user_id = p_vendor_user_id
      and is_featured = current_featured
  ) as ordered_products
  where id = p_product_id;

  target_position := current_position + p_direction;

  if target_position < 1 or not exists (
    select 1
    from (
      select row_number() over (
        order by display_order asc, created_at desc, id asc
      )::integer as position
      from public.vendor_products
      where vendor_user_id = p_vendor_user_id
        and is_featured = current_featured
    ) as ordered_products
    where position = target_position
  ) then
    return false;
  end if;

  with ordered_products as (
    select id, row_number() over (
      order by display_order asc, created_at desc, id asc
    )::integer as position
    from public.vendor_products
    where vendor_user_id = p_vendor_user_id
      and is_featured = current_featured
  )
  update public.vendor_products as product
  set display_order = case
      when ordered_products.position = current_position then target_position
      when ordered_products.position = target_position then current_position
      else ordered_products.position
    end,
    updated_at = now()
  from ordered_products
  where product.id = ordered_products.id
    and product.vendor_user_id = p_vendor_user_id;

  return true;
end;
$$;

revoke all on function public.reorder_vendor_catalogue_product(uuid, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.reorder_vendor_catalogue_product(uuid, bigint, integer)
  to service_role;

notify pgrst, 'reload schema';
