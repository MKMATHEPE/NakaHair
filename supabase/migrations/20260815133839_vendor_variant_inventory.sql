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

  -- Lock and decrement inventory for each selected product variant. Products
  -- created before variant inventory continue to use product-level stock only.
  for stock_row in
    select
      (item ->> 'vendorProductId')::bigint as product_id,
      coalesce(item ->> 'selectedOrigin', '') as selected_origin,
      coalesce(item ->> 'selectedSize', '') as selected_size,
      sum((item ->> 'quantity')::integer)::integer as requested_quantity
    from jsonb_array_elements(p_items) as item
    where item ? 'vendorProductId'
    group by
      (item ->> 'vendorProductId')::bigint,
      coalesce(item ->> 'selectedOrigin', ''),
      coalesce(item ->> 'selectedSize', '')
    order by
      (item ->> 'vendorProductId')::bigint,
      coalesce(item ->> 'selectedOrigin', ''),
      coalesce(item ->> 'selectedSize', '')
  loop
    update public.vendor_products as product
    set stock_quantity = product.stock_quantity - stock_row.requested_quantity,
        variant_prices = case
          when exists (
            select 1
            from jsonb_array_elements(product.variant_prices) as variant
            where coalesce(variant ->> 'hairOrigin', '') = stock_row.selected_origin
              and coalesce(variant ->> 'size', '') = stock_row.selected_size
              and variant ? 'stock'
          ) then (
            select jsonb_agg(
              case
                when coalesce(variant ->> 'hairOrigin', '') = stock_row.selected_origin
                  and coalesce(variant ->> 'size', '') = stock_row.selected_size
                then jsonb_set(
                  variant,
                  '{stock}',
                  to_jsonb((variant ->> 'stock')::integer - stock_row.requested_quantity),
                  false
                )
                else variant
              end
              order by position
            )
            from jsonb_array_elements(product.variant_prices) with ordinality as variants(variant, position)
          )
          else product.variant_prices
        end,
        updated_at = now()
    where product.id = stock_row.product_id
      and product.status = 'active'
      and product.stock_quantity >= stock_row.requested_quantity
      and not exists (
        select 1
        from jsonb_array_elements(product.variant_prices) as variant
        where coalesce(variant ->> 'hairOrigin', '') = stock_row.selected_origin
          and coalesce(variant ->> 'size', '') = stock_row.selected_size
          and variant ? 'stock'
          and (variant ->> 'stock')::integer < stock_row.requested_quantity
      );

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
