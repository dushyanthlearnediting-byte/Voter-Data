// Supabase Edge Function: manage-users
// Creates and removes staff accounts. It runs on Supabase's servers, so the secret
// service-role key never reaches the browser.
//
// Rules:
//   - Admin can create admin / sub_admin / data_entry users (any ward) and remove users.
//   - Sub-Admin can create ONLY data_entry users in their own ward.
//   - Data Entry users can do nothing here.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Who is calling?
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Please sign in again.' }, 401);

    const admin = createClient(url, serviceKey);
    const { data: caller } = await admin
      .from('profiles')
      .select('id, role, ward_id, is_active')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (!caller || !caller.is_active) return json({ error: 'Your account is not active.' }, 403);
    if (caller.role !== 'admin' && caller.role !== 'sub_admin') {
      return json({ error: 'You do not have permission to manage users.' }, 403);
    }

    const body = await req.json();

    // ---------------- CREATE ----------------
    if (body.action === 'create') {
      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const phone = String(body.phone ?? '').trim();
      const password = String(body.password ?? '');
      const role = String(body.role ?? '');
      let wardId: string | null = body.wardId ? String(body.wardId) : null;

      if (!name) return json({ error: 'Name is required.' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email.' }, 400);
      if (password.length < 6) return json({ error: 'Password must be at least 6 characters.' }, 400);
      if (phone && !/^\d{10}$/.test(phone)) return json({ error: 'Phone must be 10 digits.' }, 400);
      if (!['admin', 'sub_admin', 'data_entry'].includes(role)) return json({ error: 'Invalid role.' }, 400);

      if (caller.role === 'sub_admin') {
        if (role !== 'data_entry') return json({ error: 'You can only add Data Entry users.' }, 403);
        wardId = caller.ward_id; // always their own ward, whatever the browser sent
      }

      if (role === 'admin') {
        wardId = null;
      } else {
        if (!wardId) return json({ error: 'Ward is required.' }, 400);
        const { data: ward } = await admin.from('wards').select('id').eq('id', wardId).maybeSingle();
        if (!ward) return json({ error: 'That ward does not exist.' }, 400);
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        const msg = createErr?.message ?? 'Could not create the login.';
        return json({ error: /already|registered|exists/i.test(msg) ? 'A user with this email already exists.' : msg }, 400);
      }

      const { error: profileErr } = await admin.from('profiles').insert({
        id: created.user.id,
        full_name: name,
        phone: phone || null,
        email,
        role,
        ward_id: wardId,
      });
      if (profileErr) {
        await admin.auth.admin.deleteUser(created.user.id); // undo, so nothing half-created is left
        return json({ error: profileErr.message }, 400);
      }

      return json({ ok: true, userId: created.user.id });
    }

    // ---------------- REMOVE ----------------
    if (body.action === 'remove') {
      if (caller.role !== 'admin') return json({ error: 'Only the Main Admin can remove users.' }, 403);
      const userId = String(body.userId ?? '');
      if (!userId) return json({ error: 'User is required.' }, 400);
      if (userId === caller.id) return json({ error: 'You cannot remove your own account.' }, 400);

      const { data: target } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle();
      if (!target) return json({ error: 'User not found.' }, 404);
      if (target.role === 'admin') return json({ error: 'Admin accounts cannot be removed here.' }, 403);

      // Switch the account off (not deleted) so the voters they entered keep their history.
      const { error: updErr } = await admin.from('profiles').update({ is_active: false }).eq('id', userId);
      if (updErr) return json({ error: updErr.message }, 400);
      await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });

      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
  }
});
