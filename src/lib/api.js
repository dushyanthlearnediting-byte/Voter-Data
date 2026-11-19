import { getSupabase } from '@/lib/supabase';

const DEFAULT_TEMPLATE =
  'Namaste (name), your voter ID is (VoterId). Please visit (booth) on election day. - Ward (ward)';

function throwIfError(error) {
  if (error) throw new Error(error.message || 'The request could not be completed.');
}

function normalizeStatus(status) {
  const value = String(status || 'not_visited').trim().toLowerCase();
  if (value === 'visited') return 'visited';
  if (value === 'follow_up' || value === 'follow-up needed') return 'follow_up';
  return 'not_visited';
}

function mapProfile(profile, ward) {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email || '',
    phone: profile.phone || '',
    role: profile.role,
    wardId: profile.ward_id,
    wardName: ward?.name || (ward?.ward_number ? `Ward ${ward.ward_number}` : null),
  };
}

function mapVoter(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    relativeName: row.relative_name || '',
    voterId: row.voter_id,
    phone: row.phone || '',
    wardId: row.ward_id,
    wardName: row.ward?.name || row.ward_name || '',
    boothName: row.booth_name || '',
    wardSerial: row.ward_serial,
    age: row.age,
    gender: row.gender || '',
    address: row.address || '',
    status: normalizeStatus(row.status),
    notes: row.notes || '',
    createdAt: row.created_at,
    createdBy: row.created_by || null,
  };
}

function mapVoterInput(data) {
  const fields = {
    fullName: 'full_name',
    relativeName: 'relative_name',
    voterId: 'voter_id',
    phone: 'phone',
    wardId: 'ward_id',
    boothName: 'booth_name',
    wardSerial: 'ward_serial',
    age: 'age',
    gender: 'gender',
    address: 'address',
    status: 'status',
    notes: 'notes',
  };
  const result = {};
  for (const [source, target] of Object.entries(fields)) {
    if (!Object.prototype.hasOwnProperty.call(data, source)) continue;
    let value = data[source];
    if (source === 'status') value = normalizeStatus(value);
    if (source === 'phone' || source === 'relativeName' || source === 'boothName' ||
        source === 'gender' || source === 'address' || source === 'notes') {
      value = value || null;
    }
    if (source === 'wardId') value = value || null;
    if ((source === 'wardSerial' || source === 'age') && value === '') value = null;
    result[target] = value;
  }
  return result;
}

async function loadProfile(authUser) {
  const client = getSupabase();
  const { data: profile, error } = await client
    .from('profiles')
    .select('id, full_name, email, phone, role, ward_id, is_active')
    .eq('id', authUser.id)
    .maybeSingle();
  throwIfError(error);
  if (!profile || !profile.is_active) {
    const { error: signOutError } = await client.auth.signOut();
    throwIfError(signOutError);
    return null;
  }

  let ward = null;
  if (profile.ward_id) {
    const { data, error: wardError } = await client
      .from('wards')
      .select('id, name, ward_number')
      .eq('id', profile.ward_id)
      .maybeSingle();
    throwIfError(wardError);
    ward = data;
  }
  return mapProfile({ ...profile, email: profile.email || authUser.email }, ward);
}

export async function login(email, password) {
  const client = getSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  throwIfError(error);
  const user = await loadProfile(data.user);
  if (!user) throw new Error('Your account is inactive or is not set up. Contact your administrator.');
  return user;
}

export async function logout() {
  const auth = getSupabase().auth;
  const { data, error: sessionError } = await auth.getSession();
  throwIfError(sessionError);
  if (!data.session) return;

  const { error } = await auth.signOut({ scope: 'local' });
  if (error?.name === 'AuthSessionMissingError') return;
  throwIfError(error);
}

export async function getCurrentUser() {
  const { data, error } = await getSupabase().auth.getSession();
  throwIfError(error);
  if (!data.session?.user) return null;
  return loadProfile(data.session.user);
}

export async function getWards() {
  const { data, error } = await getSupabase()
    .from('wards')
    .select('id, name, ward_number')
    .order('ward_number', { ascending: true });
  throwIfError(error);
  return (data || []).map((ward) => ({
    id: ward.id,
    name: ward.name || `Ward ${ward.ward_number}`,
  }));
}

export async function getUsers() {
  const client = getSupabase();
  const [{ data: profiles, error }, wards] = await Promise.all([
    client
      .from('profiles')
      .select('id, full_name, email, phone, role, ward_id')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    getWards(),
  ]);
  throwIfError(error);
  const wardsById = new Map(wards.map((ward) => [ward.id, ward]));
  return (profiles || []).map((profile) => mapProfile(profile, wardsById.get(profile.ward_id)));
}

async function invokeUserManagement(body) {
  const { data, error } = await getSupabase().functions.invoke('manage-users', { body });
  if (error) {
    const response = error.context;
    if (response && typeof response.json === 'function') {
      const details = await response.json().catch(() => null);
      if (details?.error) throw new Error(details.error);
    }
    throw new Error(error.message || 'User management request failed.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function createUser(data) {
  return invokeUserManagement({
    action: 'create',
    name: data.name,
    email: data.email,
    phone: data.phone,
    password: data.password,
    role: data.role,
    wardId: data.wardId,
  });
}

export async function deleteUser(id) {
  await invokeUserManagement({ action: 'remove', userId: id });
}

export async function getVoters({
  search = '',
  wardId = null,
  status = null,
  page = 1,
  pageSize = 50,
} = {}) {
  const { data, error } = await getSupabase().rpc('search_voters_page', {
    search_term: search.trim() || null,
    requested_ward_id: wardId || null,
    requested_status: status || null,
    requested_page: page,
    requested_page_size: pageSize,
  });
  throwIfError(error);
  return {
    data: (data?.data || []).map(mapVoter),
    total: Number(data?.total || 0),
    page: Number(data?.page || page),
    totalPages: Number(data?.totalPages || 1),
  };
}

export async function addVoter(data) {
  const { data: row, error } = await getSupabase()
    .from('voters')
    .insert(mapVoterInput(data))
    .select('*, ward:wards(id, name, ward_number)')
    .single();
  throwIfError(error);
  return mapVoter(row);
}

export async function updateVoter(id, data) {
  const { data: row, error } = await getSupabase()
    .from('voters')
    .update(mapVoterInput(data))
    .eq('id', id)
    .select('*, ward:wards(id, name, ward_number)')
    .maybeSingle();
  throwIfError(error);
  if (!row) throw new Error('Voter not found or you do not have permission to update it.');
  return mapVoter(row);
}

export async function deleteVoter(id) {
  const { data, error } = await getSupabase()
    .from('voters')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error('Voter not found or you do not have permission to delete it.');
}

export async function getDashboardStats() {
  const { data, error } = await getSupabase().rpc('dashboard_stats');
  throwIfError(error);
  if (!data) throw new Error('The dashboard returned no statistics.');
  return data;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportVoters(wardId = null) {
  const client = getSupabase();
  const voters = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    let query = client
      .from('voters')
      .select('*, ward:wards(id, name, ward_number)')
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (wardId) query = query.eq('ward_id', wardId);

    const { data, error } = await query;
    throwIfError(error);
    voters.push(...(data || []));
    if (!data || data.length < batchSize) break;
    offset += batchSize;
  }

  const rows = [
    ['Name', 'Voter ID', 'Phone', 'Ward', 'Booth', 'Serial number', 'Age', 'Gender', 'Address', 'Status', 'Notes', 'Created At'],
    ...voters.map((row) => {
      const voter = mapVoter(row);
      return [
        voter.fullName,
        voter.voterId,
        voter.phone,
        voter.wardName,
        voter.boothName,
        voter.wardSerial,
        voter.age,
        voter.gender,
        voter.address,
        voter.status,
        voter.notes,
        voter.createdAt,
      ];
    }),
  ];
  const filename = wardId ? `voters_ward_${wardId}.csv` : 'voters_all.csv';
  downloadCsv(filename, rows);
  return { count: voters.length, filename };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (quoted) throw new Error('The CSV file contains an unclosed quoted field.');
  return rows;
}

function parseNullableNumber(value, rowNumber, fieldName) {
  const text = String(value || '').trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be a whole number.`);
  }
  return parsed;
}

export async function importVoters(file) {
  const [text, wards, user] = await Promise.all([
    file.text(),
    getWards(),
    getCurrentUser(),
  ]);
  const rows = parseCsv(text);
  const records = rows.slice(1);
  if (!records.length) return { added: 0, total: 0 };

  const wardsByName = new Map(wards.map((ward) => [ward.name.toLowerCase(), ward]));
  const dbRows = records.map((cells, index) => {
    const rowNumber = index + 2;
    const fullName = String(cells[0] || '').trim();
    const voterId = String(cells[1] || '').trim();
    const wardLabel = String(cells[3] || '').trim();
    const ward = wards.find((item) => item.id === wardLabel) || wardsByName.get(wardLabel.toLowerCase());
    if (!fullName || !voterId) {
      throw new Error(`Row ${rowNumber}: name and voter ID are required.`);
    }
    if (!ward && !user?.wardId) {
      throw new Error(`Row ${rowNumber}: "${wardLabel || 'Ward'}" does not match an available ward.`);
    }
    const wardId = ward?.id || user.wardId;
    if (user?.role !== 'admin' && wardId !== user?.wardId) {
      throw new Error(`Row ${rowNumber}: you can only import voters in your assigned ward.`);
    }
    const phone = String(cells[2] || '').trim();
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      throw new Error(`Row ${rowNumber}: phone must be 10 digits starting with 6–9.`);
    }
    const status = normalizeStatus(cells[9]);
    return {
      full_name: fullName,
      voter_id: voterId,
      phone: phone || null,
      ward_id: wardId,
      booth_name: String(cells[4] || '').trim() || null,
      ward_serial: parseNullableNumber(cells[5], rowNumber, 'Serial number'),
      age: parseNullableNumber(cells[6], rowNumber, 'Age'),
      gender: String(cells[7] || '').trim() || null,
      address: String(cells[8] || '').trim() || null,
      status,
      notes: String(cells[10] || '').trim() || null,
    };
  });

  const { data, error } = await getSupabase()
    .from('voters')
    .insert(dbRows)
    .select('id');
  throwIfError(error);
  return { added: data?.length || 0, total: dbRows.length };
}

export const PLACEHOLDERS = [
  { token: '(name)', label: 'Voter name' },
  { token: '(VoterId)', label: 'Voter ID' },
  { token: '(relative)', label: 'Relative / house head' },
  { token: '(phone)', label: 'Phone number' },
  { token: '(ward)', label: 'Ward' },
  { token: '(booth)', label: 'Booth name' },
  { token: '(age)', label: 'Age' },
  { token: '(gender)', label: 'Gender' },
  { token: '(No)', label: 'Serial number' },
];

export async function getMessageTemplate() {
  const client = getSupabase();
  const [user, { data, error }] = await Promise.all([
    getCurrentUser(),
    client
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'message_template')
      .maybeSingle(),
  ]);
  throwIfError(error);
  const message = data?.setting_value || DEFAULT_TEMPLATE;
  const canEdit = user?.role === 'admin';
  let appliesTo = 'All staff';
  if (user?.role === 'sub_admin') appliesTo = user.wardName ? `Staff in ${user.wardName}` : 'Your ward staff';
  else if (user?.role === 'data_entry') appliesTo = 'You';
  return { message, canEdit, appliesTo, isDefault: message === DEFAULT_TEMPLATE };
}

export async function saveMessageTemplate(message) {
  const client = getSupabase();
  const user = await getCurrentUser();
  if (user?.role !== 'admin') throw new Error('Only admin can change this message.');
  const value = String(message || '').trim() || DEFAULT_TEMPLATE;
  const { error } = await client.from('app_settings').upsert({
    setting_key: 'message_template',
    setting_value: value,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'setting_key' });
  throwIfError(error);
  return value;
}

export function renderMessage(template, voter) {
  if (!template) return '';
  const values = [
    ['(name)', voter?.fullName || ''],
    ['(voterid)', voter?.voterId || ''],
    ['(relative)', voter?.relativeName || ''],
    ['(phone)', voter?.phone || ''],
    ['(ward)', voter?.wardName || ''],
    ['(booth)', voter?.boothName || ''],
    ['(age)', voter?.age != null ? String(voter.age) : ''],
    ['(gender)', voter?.gender ? voter.gender.charAt(0).toUpperCase() + voter.gender.slice(1) : ''],
    ['(no)', voter?.wardSerial != null ? String(voter.wardSerial) : ''],
  ];
  let result = String(template);
  for (const [token, value] of values) {
    result = result.replace(new RegExp(escapeRegExp(token), 'gi'), value);
  }
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getContactLinks(voter, template) {
  const phone = voter?.phone || '';
  if (!/^\d{10}$/.test(phone)) {
    return { canContact: false, call: '', sms: '', whatsapp: '', message: '' };
  }
  const message = renderMessage(template, voter);
  return {
    canContact: true,
    call: `tel:${phone}`,
    sms: `sms:${phone}?body=${encodeURIComponent(message)}`,
    whatsapp: `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`,
    message,
  };
}
