// All data access lives here. Components call only these functions.
// Right now everything returns fake/sample data with simulated latency.
// Later these can be swapped to real Supabase calls without touching components.

const DELAY = 450;

function delay(ms = DELAY) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Types (documented as comments for now) ----------
// Role: 'admin' | 'sub_admin' | 'data_entry'
// Status: 'not_visited' | 'visited' | 'follow_up'
//
// User: { id, name, email, phone, role, wardId, wardName }
// Ward: { id, name }
// Voter: { id, fullName, voterId, phone, wardId, wardName, boothName, wardSerial, age, gender, address, status, notes, createdAt, createdBy }

// ---------- Static sample data ----------
const WARDS = [
  { id: 1, name: 'Ward 1' },
  { id: 2, name: 'Ward 2' },
  { id: 3, name: 'Ward 3' },
  { id: 4, name: 'Ward 4' },
  { id: 5, name: 'Ward 5' },
  { id: 6, name: 'Ward 6' },
];

const USERS = [
  { id: 'u1', name: 'Admin User', email: 'admin@ward.gov', phone: '9000000001', role: 'admin', wardId: null, wardName: null },
  { id: 'u2', name: 'Sneha Rao', email: 'subadmin5@ward.gov', phone: '9000000002', role: 'sub_admin', wardId: 5, wardName: 'Ward 5' },
  { id: 'u3', name: 'Ravi Kumar', email: 'data5@ward.gov', phone: '9000000003', role: 'data_entry', wardId: 5, wardName: 'Ward 5' },
  { id: 'u4', name: 'Priya Nair', email: 'dataentry1@ward.gov', phone: '9000000004', role: 'data_entry', wardId: 1, wardName: 'Ward 1' },
];

// Credentials map for fake login
const CREDENTIALS = {
  'admin@ward.gov': { password: 'admin123', userId: 'u1' },
  'subadmin5@ward.gov': { password: 'sub123', userId: 'u2' },
  'data5@ward.gov': { password: 'data123', userId: 'u3' },
  'dataentry1@ward.gov': { password: 'data123', userId: 'u4' },
};

// Pre-computed list of data entry users for createdBy assignment
const DATA_ENTRY_USERS = USERS.filter((u) => u.role === 'data_entry');

const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohit', 'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Kiara', 'Myra', 'Anika', 'Navya', 'Riya', 'Sneha', 'Karthik', 'Deepa', 'Lakshmi', 'Meena', 'Neha', 'Pooja', 'Ramesh', 'Suresh', 'Geeta', 'Harish'];
const LAST_NAMES = ['Sharma', 'Reddy', 'Iyer', 'Gupta', 'Nair', 'Rao', 'Patel', 'Singh', 'Kumar', 'Menon', 'Pillai', 'Das', 'Bose', 'Joshi', 'Verma'];

const BOOTH_NAMES = ['Booth 1 - Govt School', 'Booth 2 - Community Hall', 'Booth 3 - PG College', 'Booth 4 - Anganwadi', 'Booth 5 - Town Library'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomPhone() {
  let p = '9';
  for (let i = 0; i < 9; i++) p += Math.floor(Math.random() * 10);
  return p;
}
function randomVoterId() {
  let id = '';
  for (let i = 0; i < 10; i++) id += Math.floor(Math.random() * 36).toString(36).toUpperCase();
  return id;
}
function randomAddress(wardName) {
  const streets = ['Gandhi Rd', 'Nehru St', 'MG Road', 'Patel Ave', 'Subhash Marg', 'Azad Lane', 'Lake View', 'Hill Top'];
  return `${Math.floor(Math.random() * 200) + 1}, ${pick(streets)}, ${wardName}`;
}
function randomBooth() {
  return pick(BOOTH_NAMES);
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function generateVoters() {
  const statuses = ['not_visited', 'visited', 'follow_up'];
  const list = [];
  const today = new Date();
  const createdTodayIds = new Set();
  for (let i = 0; i < 320; i++) {
    const ward = pick(WARDS);
    const status = pick(statuses);
    const createdDate = new Date(today.getTime() - Math.floor(Math.random() * 20) * 86400000);
    // make ~30 records created today
    if (i < 30) {
      createdDate.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
      createdDate.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
      createdTodayIds.add(i);
    }
    list.push({
      id: `v${i + 1}`,
      fullName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      voterId: randomVoterId(),
      phone: randomPhone(),
      wardId: ward.id,
      wardName: ward.name,
      boothName: randomBooth(),
      wardSerial: Math.floor(Math.random() * 800) + 1,
      age: 18 + Math.floor(Math.random() * 60),
      gender: pick(['male', 'female', 'other']),
      address: randomAddress(ward.name),
      status,
      notes: Math.random() < 0.25 ? 'Door locked on visit. Follow up next week.' : '',
      createdAt: createdDate.toISOString(),
      createdBy: pick(DATA_ENTRY_USERS).name,
    });
  }
  // ensure today's count is 30
  return { list, todayCount: createdTodayIds.size };
}

const { list: VOTERS, todayCount: TODAY_COUNT } = generateVoters();

// In-memory session
let SESSION = null;

// ---------- Auth ----------
export async function login(email, password) {
  await delay();
  const cred = CREDENTIALS[email.toLowerCase()];
  if (!cred || cred.password !== password) {
    throw new Error('Invalid email or password');
  }
  const user = USERS.find((u) => u.id === cred.userId);
  SESSION = user;
  return SESSION;
}

export async function logout() {
  await delay(150);
  SESSION = null;
}

export async function getCurrentUser() {
  await delay(150);
  return SESSION;
}

// ---------- Wards ----------
export async function getWards() {
  await delay(200);
  return [...WARDS];
}

// ---------- Users ----------
export async function getUsers() {
  await delay();
  return [...USERS];
}

export async function createUser(data) {
  await delay();
  const ward = WARDS.find((w) => w.id === data.wardId) || null;
  const newUser = {
    id: `u${USERS.length + 1}`,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    wardId: ward ? ward.id : null,
    wardName: ward ? ward.name : null,
  };
  USERS.push(newUser);
  return newUser;
}

export async function deleteUser(id) {
  await delay(250);
  const idx = USERS.findIndex((u) => u.id === id);
  if (idx >= 0) USERS.splice(idx, 1);
}

// ---------- Voters ----------
export async function getVoters({ search = '', wardId = null, status = null, page = 1, pageSize = 50 } = {}) {
  await delay();
  let items = [...VOTERS];
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (v) =>
        v.fullName.toLowerCase().includes(q) ||
        v.voterId.toLowerCase().includes(q) ||
        v.phone.includes(q) ||
        (v.wardSerial != null && String(v.wardSerial).includes(q))
    );
  }
  if (wardId) items = items.filter((v) => v.wardId === Number(wardId));
  if (status) items = items.filter((v) => v.status === status);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return { data, total, page, totalPages };
}

export async function addVoter(data) {
  await delay();
  const ward = WARDS.find((w) => w.id === Number(data.wardId));
  const newVoter = {
    id: `v${VOTERS.length + 1}`,
    fullName: data.fullName,
    voterId: data.voterId,
    phone: data.phone,
    wardId: ward ? ward.id : null,
    wardName: ward ? ward.name : '',
    boothName: data.boothName || '',
    wardSerial: data.wardSerial ? Number(data.wardSerial) : null,
    age: data.age || null,
    gender: data.gender || '',
    address: data.address || '',
    status: data.status || 'not_visited',
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    createdBy: SESSION ? SESSION.name : 'Unknown',
  };
  VOTERS.unshift(newVoter);
  return newVoter;
}

export async function updateVoter(id, data) {
  await delay();
  const idx = VOTERS.findIndex((v) => v.id === id);
  if (idx < 0) throw new Error('Voter not found');
  const ward = data.wardId ? WARDS.find((w) => w.id === Number(data.wardId)) : null;
  VOTERS[idx] = {
    ...VOTERS[idx],
    ...data,
    wardId: ward ? ward.id : VOTERS[idx].wardId,
    wardName: ward ? ward.name : VOTERS[idx].wardName,
  };
  return VOTERS[idx];
}

export async function deleteVoter(id) {
  await delay(250);
  const idx = VOTERS.findIndex((v) => v.id === id);
  if (idx >= 0) VOTERS.splice(idx, 1);
}

// ---------- Dashboard ----------
export async function getDashboardStats() {
  await delay();
  const total = VOTERS.length;
  const wardCounts = WARDS.map((w) => ({
    wardId: w.id,
    wardName: w.name,
    count: VOTERS.filter((v) => v.wardId === w.id).length,
  }));
  const statusBreakdown = {
    not_visited: VOTERS.filter((v) => v.status === 'not_visited').length,
    visited: VOTERS.filter((v) => v.status === 'visited').length,
    follow_up: VOTERS.filter((v) => v.status === 'follow_up').length,
  };

  // Per data-entry-person breakdown: how many records each person entered,
  // and how many of those are marked visited.
  const contributors = DATA_ENTRY_USERS.map((u) => {
    const entered = VOTERS.filter((v) => v.createdBy === u.name);
    const sorted = entered.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      userId: u.id,
      name: u.name,
      wardId: u.wardId,
      wardName: u.wardName,
      total: entered.length,
      visited: entered.filter((v) => v.status === 'visited').length,
      notVisited: entered.filter((v) => v.status === 'not_visited').length,
      followUp: entered.filter((v) => v.status === 'follow_up').length,
      todays: entered.filter((v) => isToday(v.createdAt)).length,
      lastEntryAt: sorted[0] ? sorted[0].createdAt : null,
    };
  })
    .filter((c) => c.total > 0)
    .sort((a, b) => new Date(b.lastEntryAt || 0) - new Date(a.lastEntryAt || 0));

  return { total, wardCounts, statusBreakdown, contributors, todaysEntries: TODAY_COUNT };
}

// ---------- Export / Import ----------
export async function exportVoters(wardId = null) {
  await delay(600);
  let items = [...VOTERS];
  if (wardId) items = items.filter((v) => v.wardId === Number(wardId));
  // Build CSV content (Excel-compatible)
  const headers = ['Name', 'Voter ID', 'Phone', 'Ward', 'Booth', 'Serial', 'Age', 'Gender', 'Address', 'Status', 'Notes', 'Created At'];
  const rows = items.map((v) => [
    v.fullName,
    v.voterId,
    v.phone,
    v.wardName,
    v.boothName || '',
    v.wardSerial || '',
    v.age || '',
    v.gender || '',
    v.address,
    v.status,
    v.notes,
    v.createdAt,
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const filename = wardId ? `voters_ward_${wardId}.csv` : 'voters_all.csv';
  // trigger download
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { count: items.length, filename };
}

export async function importVoters(file) {
  await delay(800);
  // Fake import: parse a few rows from the CSV and add them
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  let added = 0;
  // skip header
  for (let i = 1; i < lines.length && i < 200; i++) {
    const cells = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
    if (cells.length < 3) continue;
    const wardName = cells[3] || 'Ward 5';
    const ward = WARDS.find((w) => w.name === wardName) || WARDS[4];
    VOTERS.unshift({
      id: `v${VOTERS.length + 1}`,
      fullName: cells[0] || 'Imported',
      voterId: cells[1] || randomVoterId(),
      phone: cells[2] || randomPhone(),
      wardId: ward.id,
      wardName: ward.name,
      boothName: cells[4] || '',
      wardSerial: cells[5] ? Number(cells[5]) : null,
      age: cells[6] ? Number(cells[6]) : null,
      gender: cells[7] || '',
      address: cells[8] || '',
      status: cells[9] || 'not_visited',
      notes: cells[10] || '',
      createdAt: new Date().toISOString(),
      createdBy: SESSION ? SESSION.name : 'Import',
    });
    added++;
  }
  return { added, total: lines.length - 1 };
}

// ---------- Message template ----------
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

const DEFAULT_TEMPLATE =
  'Namaste (name), your voter ID is (VoterId). Please visit (booth) on election day. - Ward (ward)';

let MESSAGE_TEMPLATE = DEFAULT_TEMPLATE;

export async function getMessageTemplate() {
  await delay(200);
  const role = SESSION?.role;
  // Only admin can edit the template; sub_admin/data_entry are read-only
  const canEdit = role === 'admin';
  let appliesTo = 'All staff';
  if (role === 'sub_admin') appliesTo = SESSION?.wardName ? `Staff in ${SESSION.wardName}` : 'Your ward staff';
  else if (role === 'data_entry') appliesTo = 'You';
  return {
    message: MESSAGE_TEMPLATE,
    canEdit,
    appliesTo,
    isDefault: MESSAGE_TEMPLATE === DEFAULT_TEMPLATE,
  };
}

export async function saveMessageTemplate(message) {
  await delay(400);
  if (SESSION?.role !== 'admin') throw new Error('Only admin can change this message');
  MESSAGE_TEMPLATE = String(message || '').trim() || DEFAULT_TEMPLATE;
  return MESSAGE_TEMPLATE;
}

const RELATIVE_NAMES = ['S/o Sharma', 'D/o Reddy', 'W/o Iyer', 'S/o Gupta'];

export function renderMessage(template, voter) {
  if (!template) return '';
  const t = String(template);
  const v = voter || {};
  // Build a case-insensitive map of placeholder -> value
  const replacements = [
    ['(name)', v.fullName || ''],
    ['(voterid)', v.voterId || ''],
    ['(relative)', v.relativeName || pick(RELATIVE_NAMES)],
    ['(phone)', v.phone || ''],
    ['(ward)', v.wardName || ''],
    ['(booth)', v.boothName || ''],
    ['(age)', v.age != null ? String(v.age) : ''],
    ['(gender)', v.gender ? v.gender.charAt(0).toUpperCase() + v.gender.slice(1) : ''],
    ['(no)', v.wardSerial != null ? String(v.wardSerial) : ''],
  ];
  let out = t;
  for (const [token, value] of replacements) {
    const re = new RegExp(escapeRegExp(token), 'gi');
    out = out.replace(re, value);
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getContactLinks(voter, template) {
  const phone = voter?.phone || '';
  const hasPhone = /^\d{10}$/.test(phone);
  if (!hasPhone) {
    return { canContact: false, call: '', sms: '', whatsapp: '', message: '' };
  }
  const message = renderMessage(template, voter);
  const cleanPhone = phone.replace(/\D/g, '');
  const intlPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  return {
    canContact: true,
    call: `tel:${cleanPhone}`,
    sms: `sms:${cleanPhone}?body=${encodeURIComponent(message)}`,
    whatsapp: `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`,
    message,
  };
}
