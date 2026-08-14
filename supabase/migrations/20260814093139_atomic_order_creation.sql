alter table public.store_orders
  add column if not exists idempotency_key uuid;

create unique index if not exists store_orders_idempotency_key_idx
  on public.store_orders (idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_store_order_atomic(
  p_idempotency_key uuid,
  p_order_number text,
  p_customer_user_id uuid,
  p_email text,
  p_phone text,
  p_delivery_address text,
  p_delivery_method text,
  p_payment_method text,
  p_items jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing_order public.store_orders%rowtype;
  created_order public.store_orders%rowtype;
  stock_row record;
  vendor_row record;
begin
  if p_idempotency_key is null
     or p_order_number is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or p_subtotal < 0
     or p_delivery_fee < 0
     or p_total <> p_subtotal + p_delivery_fee then
    raise exception 'Invalid order payload';
  end if;

  -- Serialize retries of the same checkout without locking unrelated orders.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0)
  );

  select * into existing_order
  from public.store_orders
  where idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'orderNumber', existing_order.order_number,
      'total', existing_order.total
    );
  end if;

  -- Aggregate duplicate variants of the same product and lock products in a
  -- stable order to avoid overselling and reduce deadlock risk.
  for stock_row in
    select
      (item ->> 'vendorProductId')::bigint as product_id,
      sum((item ->> 'quantity')::integer)::integer as requested_quantity
    from jsonb_array_elements(p_items) as item
    where item ? 'vendorProductId'
    group by (item ->> 'vendorProductId')::bigint
    order by (item ->> 'vendorProductId')::bigint
  loop
    update public.vendor_products
    set stock_quantity = stock_quantity - stock_row.requested_quantity,
        updated_at = now()
    where id = stock_row.product_id
      and status = 'active'
      and stock_quantity >= stock_row.requested_quantity;

    if not found then
      raise sqlstate 'PGRST'
        using message = json_build_object(
          'code', 'insufficient_stock',
          'message', 'A product in your cart is no longer available in the requested quantity.'
        )::text,
        detail = json_build_object('status', 409)::text;
    end if;
  end loop;

  insert into public.store_orders (
    idempotency_key,
    order_number,
    customer_user_id,
    email,
    phone,
    delivery_address,
    delivery_method,
    payment_method,
    items,
    subtotal,
    delivery_fee,
    total
  )
  values (
    p_idempotency_key,
    p_order_number,
    p_customer_user_id,
    p_email,
    p_phone,
    p_delivery_address,
    p_delivery_method,
    p_payment_method,
    p_items,
    p_subtotal,
    p_delivery_fee,
    p_total
  )
  returning * into created_order;

  for vendor_row in
    select
      product.vendor_user_id,
      jsonb_agg(item order by item ->> 'name') as items,
      sum((item ->> 'price')::numeric * (item ->> 'quantity')::integer) as subtotal
    from jsonb_array_elements(p_items) as item
    join public.vendor_products as product
      on product.id = (item ->> 'vendorProductId')::bigint
    where item ? 'vendorProductId'
    group by product.vendor_user_id
  loop
    insert into public.vendor_orders (
      order_id,
      vendor_user_id,
      order_number,
      customer_email,
      customer_phone,
      delivery_address,
      delivery_method,
      items,
      subtotal
    )
    values (
      created_order.id,
      vendor_row.vendor_user_id,
      p_order_number,
      p_email,
      p_phone,
      p_delivery_address,
      p_delivery_method,
      vendor_row.items,
      vendor_row.subtotal
    );
  end loop;

  return jsonb_build_object(
    'orderNumber', created_order.order_number,
    'total', created_order.total
  );
end;
$function$;

revoke execute on function public.create_store_order_atomic(
  uuid, text, uuid, text, text, text, text, text, jsonb, numeric, numeric, numeric
) from public, anon, authenticated;

grant execute on function public.create_store_order_atomic(
  uuid, text, uuid, text, text, text, text, text, jsonb, numeric, numeric, numeric
) to service_role;

notify pgrst, 'reload schema';
