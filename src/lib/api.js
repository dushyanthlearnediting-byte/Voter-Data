// All data access lives here. Components call only these functions.
// This file talks to Supabase (database + login). Ward-wise access is enforced
// by the database itself (Row Level Security), not just by this code.
//
// Role:   'admin' | 'sub_admin' | 'data_entry'
// Status: 'not_visited' | 'visited' | 'follow_up'
//
// User:  { id, name, email, phone, role, wardId, wardName }
// Ward:  { id, name, wardNumber }
// Voter: { id, fullName, relativeName, voterId, phone, wardId, wardName, age, gender,
//          boothName, wardSerial, address, status, notes, createdAt, createdBy }

import { supabase } from './supabase';

const VOTER_SELECT = '*, ward:wards(name), creator:profiles(full_name)';
const FETCH_LIMIT = 1000; // Supabase returns at most 1000 rows per request
const IMPORT_CHUNK = 500;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const STATUS_LABELS = {
  not_visited: 'Not visited',
  visited: 'Visited',
  follow_up: 'Follow-up needed',
};

// ---------- Helpers ----------
function friendlyError(error, fallback = 'Something went wrong') {
  if (!error) return new Error(fallback);
  const msg = error.message || fallback;
  if (error.code === '23505') return new Error('This Voter ID is already in the list');
  if (error.code === '23514') {
    if (msg.includes('phone')) return new Error('Enter a valid 10-digit mobile number (starting with 6-9)');
    if (msg.includes('age')) return new Error('Age must be between 18 and 120');
    return new Error('Some of the details are not valid');
  }
  if (error.code === '42501' || msg.includes('row-level security')) {
    return new Error('You do not have permission to do that');
  }
  if (error.code === 'PGRST116') return new Error('Not found, or you do not have access to it');
  if (msg === 'Failed to fetch') return new Error('No internet connection. Please try again.');
  return new Error(msg);
}

function blank(v) {
  if (v === undefined || v === null) return null;
  const s = typeof v === 'string' ? v.trim() : v;
  return s === '' ? null : s;
}

function mapVoter(r) {
  return {
    id: r.id,
    fullName: r.full_name,
    relativeName: r.relative_name || '',
    voterId: r.voter_id,
    phone: r.phone || '',
    wardId: r.ward_id,
    wardName: r.ward?.name || '',
    age: r.age,
    gender: r.gender || '',
    boothName: r.booth_name || '',
    wardSerial: r.ward_serial ?? null,
    address: r.address || '',
    status: r.status,
    notes: r.notes || '',
    createdAt: r.created_at,
    createdBy: r.creator?.full_name || '',
  };
}

function voterToDb(d) {
  return {
    full_name: (d.fullName || '').trim(),
    relative_name: blank(d.relativeName),
    voter_id: (d.voterId || '').trim().toUpperCase(),
    phone: blank(d.phone),
    ward_id: d.wardId,
    age: d.age ? Number(d.age) : null,
    gender: blank(d.gender),
    booth_name: blank(d.boothName),
    ward_serial: d.wardSerial === '' || d.wardSerial === null || d.wardSerial === undefined
      ? null
      : Number(d.wardSerial),
    address: blank(d.address),
    status: d.status || 'not_visited',
    notes: blank(d.notes),
  };
}

function mapProfile(p, fallbackEmail) {
  return {
    id: p.id,
    name: p.full_name,
    email: p.email || fallbackEmail || '',
    phone: p.phone || '',
    role: p.role,
    wardId: p.ward_id || null,
    wardName: p.ward?.name || null,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function loadExcelJS() {
  const mod = await import('exceljs');
  return mod.default || mod;
}

// ---------- Auth ----------
let currentUser = null;

async function loadProfile(authUser) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, ward:wards(name)')
    .eq('id', authUser.id)
    .maybeSingle();
  if (error) throw friendlyError(error);
  if (!data || !data.is_active) {
    await supabase.auth.signOut();
    return null;
  }
  return mapProfile(data, authUser.email);
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (error.message === 'Failed to fetch') throw friendlyError(error);
    throw new Error('Invalid email or password');
  }
  const user = await loadProfile(data.user);
  if (!user) throw new Error('Your account is not active. Please contact the admin.');
  currentUser = user;
  return user;
}

export async function logout() {
  currentUser = null;
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    currentUser = null;
    return null;
  }
  currentUser = await loadProfile(data.session.user);
  return currentUser;
}

// ---------- Wards ----------
export async function getWards() {
  const { data, error } = await supabase
    .from('wards')
    .select('id, ward_number, name')
    .order('ward_number');
  if (error) throw friendlyError(error);
  return data.map((w) => ({
    id: w.id,
    name: w.name || `Ward ${w.ward_number}`,
    wardNumber: w.ward_number,
  }));
}

// ---------- Users ----------
// Creating and removing accounts needs the secret key, so it runs inside the
// Supabase Edge Function "manage-users" (never in the browser).
async function callManageUsers(body) {
  const { data, error } = await supabase.functions.invoke('manage-users', { body });
  if (error) {
    let message = error.message;
    try {
      const j = await error.context.json();
      if (j && j.error) message = j.error;
    } catch (_) {
      /* keep default message */
    }
    throw new Error(message);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

export async function getUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, ward:wards(name)')
    .eq('is_active', true)
    .order('created_at');
  if (error) throw friendlyError(error);
  return data.map((p) => mapProfile(p));
}

export async function createUser(data) {
  return callManageUsers({
    action: 'create',
    name: data.name,
    email: data.email,
    phone: data.phone,
    password: data.password,
    role: data.role,
    wardId: data.wardId || null,
  });
}

export async function deleteUser(id) {
  return callManageUsers({ action: 'remove', userId: id });
}

// ---------- Voters ----------
export async function getVoters({ search = '', wardId = null, status = null, page = 1, pageSize = 50 } = {}) {
  let q = supabase.from('voters').select(VOTER_SELECT, { count: 'exact' });
  if (wardId) q = q.eq('ward_id', wardId);
  if (status) q = q.eq('status', status);

  // remove characters that have a special meaning in the filter syntax
  const s = search.trim().replace(/[%,()\\*"']/g, ' ').trim();
  if (s) {
    q = q.or(
      `full_name.ilike.%${s}%,voter_id.ilike.%${s}%,phone.ilike.%${s}%,relative_name.ilike.%${s}%`
    );
  }

  const from = (page - 1) * pageSize;
  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + pageSize - 1);
  if (error) throw friendlyError(error);

  const total = count ?? 0;
  return {
    data: data.map(mapVoter),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function addVoter(data) {
  const { data: row, error } = await supabase
    .from('voters')
    .insert(voterToDb(data))
    .select(VOTER_SELECT)
    .single();
  if (error) throw friendlyError(error);
  return mapVoter(row);
}

export async function updateVoter(id, data) {
  const { data: row, error } = await supabase
    .from('voters')
    .update(voterToDb(data))
    .eq('id', id)
    .select(VOTER_SELECT)
    .single();
  if (error) throw friendlyError(error);
  return mapVoter(row);
}

export async function deleteVoter(id) {
  const { data, error } = await supabase.from('voters').delete().eq('id', id).select('id');
  if (error) throw friendlyError(error);
  if (!data || data.length === 0) {
    throw new Error('Could not delete. You may not have permission, or it was already deleted.');
  }
}

// ---------- Dashboard ----------
// The numbers are calculated inside the database (function dashboard_stats),
// so the dashboard stays fast even with many thousands of voters.
export async function getDashboardStats() {
  const { data, error } = await supabase.rpc('dashboard_stats');
  if (error) throw friendlyError(error);
  return data;
}

// ---------- Export / Import (Excel .xlsx) ----------
async function fetchAllVoters(wardId) {
  const all = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from('voters')
      .select(VOTER_SELECT)
      .order('ward_id')
      .order('voter_id')
      .range(from, from + FETCH_LIMIT - 1);
    if (wardId) q = q.eq('ward_id', wardId);
    const { data, error } = await q;
    if (error) throw friendlyError(error);
    all.push(...data);
    if (data.length < FETCH_LIMIT) break;
    from += FETCH_LIMIT;
  }
  return all;
}

const COLUMNS = [
  { header: 'Name', key: 'name', width: 26 },
  { header: 'Relative Name', key: 'relative', width: 26 },
  { header: 'Voter ID', key: 'voterId', width: 16 },
  { header: 'Phone', key: 'phone', width: 14 },
  { header: 'Ward', key: 'ward', width: 12 },
  { header: 'Age', key: 'age', width: 7 },
  { header: 'Gender', key: 'gender', width: 10 },
  { header: 'Booth name', key: 'booth', width: 20 },
  { header: 'Ward serial', key: 'wardSerial', width: 12 },
  { header: 'Address', key: 'address', width: 30 },
  { header: 'Status', key: 'status', width: 18 },
  { header: 'Notes', key: 'notes', width: 30 },
];

function styleHeader(ws) {
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function exportVoters(wardId = null) {
  const rows = await fetchAllVoters(wardId);
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Voters');
  ws.columns = [...COLUMNS, { header: 'Added On', key: 'created', width: 14 }];
  rows.forEach((r) => {
    ws.addRow({
      name: r.full_name,
      relative: r.relative_name || '',
      voterId: r.voter_id,
      phone: r.phone || '',
      ward: r.ward?.name || '',
      age: r.age ?? '',
      gender: r.gender || '',
      booth: r.booth_name || '',
      wardSerial: r.ward_serial ?? '',
      address: r.address || '',
      status: STATUS_LABELS[r.status] || r.status,
      notes: r.notes || '',
      created: r.created_at ? new Date(r.created_at) : '',
    });
  });
  ws.getColumn('created').numFmt = 'dd-mmm-yyyy';
  styleHeader(ws);
  ws.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length + 1 } };

  const buffer = await wb.xlsx.writeBuffer();
  const wardLabel = wardId && rows[0]?.ward?.name ? rows[0].ward.name.replace(/\s+/g, '_') : wardId ? 'ward' : 'all';
  const filename = `voters_${wardLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadBlob(new Blob([buffer], { type: XLSX_MIME }), filename);
  return { count: rows.length, filename };
}

export async function downloadImportTemplate() {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Voters');
  ws.columns = COLUMNS;
  ws.addRow({
    name: 'Example Name',
    relative: 'Father or Husband Name',
    voterId: 'ABC1234567',
    phone: '9876543210',
    ward: '5',
    age: 35,
    gender: 'male',
    booth: 'North Primary School',
    wardSerial: 12,
    address: 'Main Road',
    status: 'Not visited',
    notes: '',
  });
  styleHeader(ws);
  const help = wb.addWorksheet('Instructions');
  help.columns = [{ width: 100 }];
  [
    'Fill the Voters sheet. Delete the example row before uploading.',
    'Required: Name and Voter ID. Everything else is optional (Phone can be added later in the app).',
    'Booth name and Ward serial are optional.',
    'Ward: the ward number (for example 5). Only the Main Admin needs this column. Sub-Admins always upload into their own ward.',
    'Phone: 10-digit mobile number starting with 6, 7, 8 or 9.',
    'Gender: male, female or other.  Status: Not visited, Visited or Follow-up needed.',
    'Voter IDs that already exist are skipped, not overwritten.',
  ].forEach((t) => help.addRow([t]));

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: XLSX_MIME }), 'voter_import_template.xlsx');
}

// --- import helpers ---
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES = {
  name: ['name', 'fullname', 'votername', 'electorname', 'electorsname'],
  relative: ['relativename', 'relativesname', 'fathername', 'husbandname', 'fatherhusbandname', 'fatherorhusbandname', 'guardianname'],
  voterId: ['voterid', 'epic', 'epicno', 'epicnumber', 'voteridnumber', 'voteridno', 'idcardno'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'mobileno'],
  ward: ['ward', 'wardno', 'wardnumber'],
  age: ['age'],
  gender: ['gender', 'sex'],
  booth: ['booth', 'boothname', 'pollingbooth', 'pollingboothname'],
  wardSerial: ['wardserial', 'serial', 'serialno', 'serialnumber', 'no'],
  address: ['address'],
  status: ['status'],
  notes: ['notes', 'remarks'],
};

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').trim();
    if ('result' in v) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    return '';
  }
  return String(v).trim();
}

function normGender(g) {
  const s = norm(g);
  if (!s) return '';
  if (s === 'm' || s === 'male') return 'male';
  if (s === 'f' || s === 'female') return 'female';
  return 'other';
}

function normStatus(s) {
  const n = norm(s);
  if (n === 'visited') return 'visited';
  if (n.startsWith('follow')) return 'follow_up';
  return 'not_visited';
}

export async function importVoters(file) {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error('Please upload an Excel .xlsx file (use the template). Older .xls or .csv files are not supported.');
  }
  const user = currentUser || (await getCurrentUser());
  if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
    throw new Error('You do not have permission to import.');
  }
  const wards = await getWards();

  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch (_) {
    throw new Error('Could not read this file. Please save it as .xlsx and try again.');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('The file has no sheets.');

  // find which column holds what, from the header row
  const colIndex = {};
  ws.getRow(1).eachCell((cell, col) => {
    const h = norm(cellText(cell.value));
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (colIndex[field] === undefined && aliases.includes(h)) colIndex[field] = col;
    }
  });
  if (!colIndex.name || !colIndex.voterId) {
    throw new Error('The first row must have the column headings "Name" and "Voter ID". Download the template to see the format.');
  }
  const get = (row, field) => (colIndex[field] ? cellText(row.getCell(colIndex[field]).value) : '');

  const errors = [];
  const seen = new Set();
  const toInsert = [];
  let totalRows = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = get(row, 'name');
    const voterId = get(row, 'voterId').toUpperCase();
    if (!name && !voterId) return; // empty line
    totalRows++;

    if (!name) return errors.push({ row: rowNumber, message: 'Name is missing' });
    if (!voterId) return errors.push({ row: rowNumber, message: 'Voter ID is missing' });
    if (seen.has(voterId)) return errors.push({ row: rowNumber, message: `Voter ID ${voterId} appears twice in the file` });

    let phone = get(row, 'phone').replace(/\D/g, '');
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return errors.push({ row: rowNumber, message: `Phone "${get(row, 'phone')}" is not a valid 10-digit mobile number` });
    }

    const ageText = get(row, 'age');
    let age = null;
    if (ageText) {
      age = Number(ageText);
      if (!Number.isInteger(age) || age < 18 || age > 120) {
        return errors.push({ row: rowNumber, message: `Age "${ageText}" is not valid (18 to 120)` });
      }
    }

    const wardSerialText = get(row, 'wardSerial');
    let wardSerial = null;
    if (wardSerialText) {
      wardSerial = Number(wardSerialText);
      if (!Number.isInteger(wardSerial)) {
        return errors.push({ row: rowNumber, message: `Ward serial "${wardSerialText}" must be a whole number` });
      }
    }

    let wardId;
    if (user.role === 'admin') {
      const m = get(row, 'ward').match(/\d+/);
      const ward = m ? wards.find((w) => w.wardNumber === Number(m[0])) : null;
      if (!ward) return errors.push({ row: rowNumber, message: `Ward "${get(row, 'ward')}" not found. Use the ward number.` });
      wardId = ward.id;
    } else {
      wardId = user.wardId;
    }

    seen.add(voterId);
    toInsert.push({
      full_name: name,
      relative_name: blank(get(row, 'relative')),
      voter_id: voterId,
      phone: phone || null,
      ward_id: wardId,
      age,
      gender: blank(normGender(get(row, 'gender'))),
      booth_name: blank(get(row, 'booth')),
      ward_serial: wardSerial,
      address: blank(get(row, 'address')),
      status: normStatus(get(row, 'status')),
      notes: blank(get(row, 'notes')),
    });
  });

  // insert in chunks; Voter IDs that already exist are skipped, never overwritten
  let added = 0;
  let skippedExisting = 0;
  for (let i = 0; i < toInsert.length; i += IMPORT_CHUNK) {
    const chunk = toInsert.slice(i, i + IMPORT_CHUNK);
    const { data, error } = await supabase
      .from('voters')
      .upsert(chunk, { onConflict: 'voter_id', ignoreDuplicates: true })
      .select('id');
    if (error) throw friendlyError(error, 'Import stopped because of an error');
    added += data.length;
    skippedExisting += chunk.length - data.length;
  }

  return {
    added,
    total: totalRows,
    skippedExisting,
    errors, // [{ row, message }]
  };
}

// ---------- Message templates and contact links ----------
export const PLACEHOLDERS = [
  { token: '(name)', label: 'Voter name' },
  { token: '(VoterId)', label: 'Voter ID' },
  { token: '(relative)', label: 'Relative name' },
  { token: '(phone)', label: 'Phone number' },
  { token: '(ward)', label: 'Ward' },
  { token: '(booth)', label: 'Booth name' },
  { token: '(age)', label: 'Age' },
  { token: '(gender)', label: 'Gender' },
  { token: '(No)', label: 'Ward serial number' },
];

const DEFAULT_MESSAGE = 'Hello (name), this is regarding your voter record (VoterId) in (ward).';
let messageTemplate = DEFAULT_MESSAGE;

export function getMessageTemplate() {
  const canEdit = currentUser?.role === 'admin';
  return {
    message: messageTemplate,
    canEdit,
    appliesTo: currentUser?.role === 'admin'
      ? 'All wards'
      : currentUser?.wardName || 'Your ward',
    isDefault: messageTemplate === DEFAULT_MESSAGE,
  };
}

export function saveMessageTemplate(message) {
  if (currentUser?.role !== 'admin') {
    throw new Error('Only an admin can change this message');
  }
  if (typeof message !== 'string') {
    throw new Error('Message template must be text');
  }
  messageTemplate = message;
  return messageTemplate;
}

export function renderMessage(template, voter = {}) {
  const values = {
    name: voter.fullName,
    voterid: voter.voterId,
    relative: voter.relativeName,
    phone: voter.phone,
    ward: voter.wardName,
    booth: voter.boothName,
    age: voter.age,
    gender: voter.gender,
    no: voter.wardSerial,
  };
  return String(template ?? '').replace(/\(([^)]+)\)/g, (match, key) => {
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(values, normalized)
      ? (values[normalized] ?? '').toString()
      : match;
  });
}

export function getContactLinks(voter, template) {
  const phone = String(voter?.phone || '').replace(/[^\d+]/g, '');
  const canContact = Boolean(phone);
  const message = renderMessage(template, voter);
  const encodedMessage = encodeURIComponent(message);
  const whatsappPhone = phone.replace(/\D/g, '');
  const whatsappNumber = whatsappPhone.length === 10 ? `91${whatsappPhone}` : whatsappPhone;
  return {
    canContact,
    call: canContact ? `tel:${phone}` : '',
    sms: canContact ? `sms:${phone}?body=${encodedMessage}` : '',
    whatsapp: canContact ? `https://wa.me/${whatsappNumber}?text=${encodedMessage}` : '',
    message,
  };
}
