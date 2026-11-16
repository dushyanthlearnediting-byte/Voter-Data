-- Run AFTER you created your login in Supabase: Authentication > Users > Add user (tick Auto Confirm).
-- Replace YOUR_EMAIL_HERE with the same email.
insert into public.profiles (id, full_name, role, email)
select id, 'Main Admin', 'admin', email
from auth.users
where email = 'YOUR_EMAIL_HERE';
