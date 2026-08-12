alter table public.vendor_products
  add column if not exists variant_prices jsonb not null default '[]'::jsonb;

update public.vendor_products as product
set variant_prices = case
  when cardinality(product.sizes) = 0 and cardinality(product.hair_origins) = 0 then '[]'::jsonb
  else (
    select jsonb_agg(
      jsonb_build_object(
        'hairOrigin', nullif(origin_name, ''),
        'size', nullif(size_name, ''),
        'price', round(
          product.price
          + (coalesce((product.hair_origin_prices ->> nullif(origin_name, ''))::numeric, product.price) - product.price)
          + (coalesce((product.size_prices ->> nullif(size_name, ''))::numeric, product.price) - product.price),
          2
        )
      )
      order by origin_name, size_name
    )
    from unnest(
      case when cardinality(product.hair_origins) = 0 then array['']::text[] else product.hair_origins end
    ) as origin_name
    cross join unnest(
      case when cardinality(product.sizes) = 0 then array['']::text[] else product.sizes end
    ) as size_name
  )
end
where variant_prices = '[]'::jsonb;

alter table public.vendor_products
  drop constraint if exists vendor_products_variant_prices_check;

alter table public.vendor_products
  add constraint vendor_products_variant_prices_check
  check (
    jsonb_typeof(variant_prices) = 'array'
    and jsonb_array_length(variant_prices) <= 400
  );

notify pgrst, 'reload schema';
