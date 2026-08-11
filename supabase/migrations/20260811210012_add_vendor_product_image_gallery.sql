alter table public.vendor_products
  add column if not exists image_urls text[] not null default '{}';

update public.vendor_products
set image_urls = array[image_url]
where image_url is not null
  and image_url <> ''
  and cardinality(image_urls) = 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_products_image_urls_check'
      and conrelid = 'public.vendor_products'::regclass
  ) then
    alter table public.vendor_products
      add constraint vendor_products_image_urls_check
      check (cardinality(image_urls) <= 8 and array_position(image_urls, null) is null);
  end if;
end $$;

notify pgrst, 'reload schema';
