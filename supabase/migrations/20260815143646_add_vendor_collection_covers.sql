do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_products_cover_reference_unique'
      and conrelid = 'public.vendor_products'::regclass
  ) then
    alter table public.vendor_products
      add constraint vendor_products_cover_reference_unique
      unique (id, vendor_user_id, collection);
  end if;
end
$migration$;

create table if not exists public.vendor_collection_covers (
  vendor_user_id uuid not null references auth.users(id) on delete cascade,
  collection text not null,
  cover_product_id bigint not null,
  cover_image_url text not null,
  updated_at timestamptz not null default now(),
  primary key (vendor_user_id, collection),
  constraint vendor_collection_covers_collection_check
    check (collection in ('everyday', 'signature', 'luxe')),
  constraint vendor_collection_covers_image_check
    check (char_length(cover_image_url) between 1 and 2048),
  constraint vendor_collection_covers_product_fk
    foreign key (cover_product_id, vendor_user_id, collection)
    references public.vendor_products (id, vendor_user_id, collection)
    on delete cascade
);

create index if not exists vendor_collection_covers_product_owner_idx
  on public.vendor_collection_covers (cover_product_id, vendor_user_id, collection);

alter table public.vendor_collection_covers enable row level security;

revoke all on table public.vendor_collection_covers from public, anon, authenticated;
grant select, insert, update, delete on table public.vendor_collection_covers to service_role;
