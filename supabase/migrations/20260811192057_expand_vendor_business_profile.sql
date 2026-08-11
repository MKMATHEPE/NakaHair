alter table public.vendor_requests
  add column if not exists contact_name text,
  add column if not exists business_type text,
  add column if not exists registration_number text,
  add column if not exists tax_number text,
  add column if not exists website_url text,
  add column if not exists social_media_url text,
  add column if not exists street_address text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists business_description text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_requests_business_type_check'
      and conrelid = 'public.vendor_requests'::regclass
  ) then
    alter table public.vendor_requests
      add constraint vendor_requests_business_type_check
      check (
        business_type is null or
        business_type in ('salon', 'stylist', 'retailer', 'wholesaler', 'online-store', 'other')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_requests_business_details_length_check'
      and conrelid = 'public.vendor_requests'::regclass
  ) then
    alter table public.vendor_requests
      add constraint vendor_requests_business_details_length_check
      check (
        char_length(contact_name) <= 120 and
        char_length(business_type) <= 50 and
        char_length(registration_number) <= 100 and
        char_length(tax_number) <= 100 and
        char_length(website_url) <= 500 and
        char_length(social_media_url) <= 500 and
        char_length(street_address) <= 200 and
        char_length(city) <= 100 and
        char_length(province) <= 100 and
        char_length(postal_code) <= 20 and
        char_length(business_description) <= 2000
      );
  end if;
end $$;

notify pgrst, 'reload schema';
