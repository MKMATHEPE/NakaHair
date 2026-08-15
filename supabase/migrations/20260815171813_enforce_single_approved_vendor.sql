create unique index if not exists vendor_requests_single_approved_vendor_idx
on public.vendor_requests ((1))
where status = 'approved';
