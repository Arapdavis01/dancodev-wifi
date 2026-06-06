let token = localStorage.getItem('admin_token');
let socket = null;
if (token) { checkToken(); }

// ============ SOCKET.IO REAL-TIME UPDATES ============
function initSocket() {
  if (socket) return;
  socket = io();
  
  socket.on('connect', () => {
    console.log('🔌 Real-time updates connected');
  });
  
  socket.on('plansUpdated', (data) => {
    console.log('🔄 Plans updated from another device');
    loadPlans();
  });
  
  socket.on('statsUpdated', () => {
    console.log('🔄 Stats updated');
    loadDashboard();
  });
  
  socket.on('sessionsUpdated', () => {
    console.log('🔄 Sessions updated');
    loadSessions();
  });
  
  socket.on('transactionsUpdated', () => {
    console.log('🔄 Transactions updated');
    loadTransactions();
  });
  
  socket.on('settingsUpdated', () => {
    console.log('🔄 Settings updated');
    loadCurrentPassword();
  });
}

async function checkToken() {
  try {
    const res = await fetch('/api/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) { showDashboard(); loadDashboard(); initSocket(); }
    else { localStorage.removeItem('admin_token'); token = null; }
  } catch(e) { localStorage.removeItem('admin_token'); token = null; }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye','fa-eye-slash'); }
  else { input.type = 'password'; icon.classList.replace('fa-eye-slash','fa-eye'); }
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  if (!username || !password) { errorEl.textContent = 'Fill all fields'; errorEl.style.display = 'block'; return; }
  try {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username, password})
    });
    const data = await res.json();
    if (data.success) { 
      token = data.token; 
      localStorage.setItem('admin_token', token); 
      showDashboard(); 
      loadDashboard();
      initSocket();
    }
    else { errorEl.textContent = data.error || 'Invalid'; errorEl.style.display = 'block'; }
  } catch(e) { errorEl.textContent = 'Connection error'; errorEl.style.display = 'block'; }
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard-screen').style.display = 'flex';
  document.getElementById('mobileMenuBtn').style.display = 'flex';
}

function logout() { 
  if (socket) socket.disconnect();
  localStorage.removeItem('admin_token'); 
  location.reload(); 
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.dropdown-toggle').forEach(t => {
    t.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      const p = this.closest('.nav-dropdown');
      document.querySelectorAll('.nav-dropdown').forEach(d => { if(d!==p) d.classList.remove('open'); });
      p.classList.toggle('open');
    });
  });
  document.querySelectorAll('.dropdown-item').forEach(i => {
    i.addEventListener('click', function(e) {
      e.preventDefault();
      const tab = this.getAttribute('data-tab');
      if(tab) { showTab(tab); closeSidebar(); }
    });
  });
  document.querySelectorAll('.nav-item:not(.dropdown-toggle)').forEach(i => {
    i.addEventListener('click', function(e) {
      const tab = this.getAttribute('data-tab');
      if(tab) { e.preventDefault(); showTab(tab); closeSidebar(); }
    });
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
});

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.getElementById('page-title').textContent = {
    dashboard:'Dashboard', sessions:'Active Sessions', transactions:'Transactions',
    plans:'WiFi Plans', mpesa:'M-Pesa API', mikrotik:'MikroTik', password:'Change Password', users:'Manage Users'
  }[name] || name;
  if(name==='dashboard') loadDashboard();
  if(name==='sessions') loadSessions();
  if(name==='transactions') loadTransactions();
  if(name==='plans') loadPlans();
  if(name==='mpesa') loadMpesaSettings();
  if(name==='mikrotik') loadMikrotikSettings();
  if(name==='password') loadCurrentPassword();
  if(name==='users') loadUsers();
}

async function apiCall(url, method='GET', body=null) {
  const opts = { method, headers: {'Content-Type':'application/json','Authorization':'Bearer '+token} };
  if(body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    if(res.status===401) { logout(); return null; }
    return await res.json();
  } catch(e) { return null; }
}

async function loadDashboard() {
  const data = await apiCall('/api/admin/stats');
  if(!data) return;
  document.getElementById('stat-revenue').textContent = 'Ksh '+(data.stats.totalRevenue||0);
  document.getElementById('stat-active').textContent = data.stats.activeSessions||0;
  document.getElementById('stat-transactions').textContent = data.stats.totalTransactions||0;
  document.getElementById('stat-today').textContent = 'Ksh '+(data.stats.todayRevenue||0);
  document.getElementById('activity-table').innerHTML = (data.stats.recentTransactions||[]).map(t => 
    `<tr><td data-label="Date">${new Date(t.created_at).toLocaleString()}</td><td data-label="Phone">${t.phone||'-'}</td><td data-label="Action">Payment</td><td data-label="Details">${t.plan_name} - Ksh ${t.amount}</td></tr>`
  ).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;">No activity</td></tr>';
}

async function loadSessions() {
  const data = await apiCall('/api/admin/sessions');
  document.getElementById('sessions-table').innerHTML = (data?.sessions||[]).map(s => {
    const active = new Date(s.expires_at) > new Date();
    return `<tr><td data-label="Username">${s.username}</td><td data-label="Phone">${s.phone||'-'}</td><td data-label="Plan">${s.plan_name}</td><td data-label="Started">${new Date(s.created_at).toLocaleString()}</td><td data-label="Expires">${new Date(s.expires_at).toLocaleString()}</td><td data-label="Status" class="${active?'status-active':''}">${active?'Active':'Expired'}</td></tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;">No sessions</td></tr>';
}

async function loadTransactions() {
  const data = await apiCall('/api/admin/transactions');
  document.getElementById('transactions-table').innerHTML = (data?.transactions||[]).map(t =>
    `<tr><td data-label="Date">${new Date(t.created_at).toLocaleDateString()}</td><td data-label="Phone">${t.phone}</td><td data-label="Plan">${t.plan_name}</td><td data-label="Amount">Ksh ${t.amount}</td><td data-label="Method">mpesa</td><td data-label="Receipt">${t.mpesa_receipt||'-'}</td><td data-label="Status"><span class="status-${t.status}">${t.status}</span></td></tr>`
  ).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;">No transactions</td></tr>';
}

function showAddPlan() {
  document.getElementById('plan-modal-overlay').style.display = 'flex';
  document.getElementById('plan-modal-title').textContent = 'Add New Plan';
  document.getElementById('plan-id').value = '';
  document.getElementById('plan-name').value = '';
  document.getElementById('plan-desc').value = '';
  document.getElementById('plan-duration').value = '';
  document.getElementById('plan-price').value = '';
  document.getElementById('plan-speed').value = '';
}

function closePlanModal() {
  document.getElementById('plan-modal-overlay').style.display = 'none';
}

function editPlan(id, name, desc, dur, price, speed) {
  document.getElementById('plan-modal-overlay').style.display = 'flex';
  document.getElementById('plan-modal-title').textContent = 'Edit Plan';
  document.getElementById('plan-id').value = id;
  document.getElementById('plan-name').value = name;
  document.getElementById('plan-desc').value = desc;
  document.getElementById('plan-duration').value = dur;
  document.getElementById('plan-price').value = price;
  document.getElementById('plan-speed').value = speed;
}

async function savePlan() {
  const id = document.getElementById('plan-id').value;
  const plan = {
    name: document.getElementById('plan-name').value,
    description: document.getElementById('plan-desc').value,
    duration_minutes: parseInt(document.getElementById('plan-duration').value),
    price_ksh: parseInt(document.getElementById('plan-price').value),
    speed_limit: document.getElementById('plan-speed').value
  };
  if (!plan.name || !plan.price_ksh) { alert('Name and price required'); return; }
  const url = id ? '/api/admin/plans/'+id : '/api/admin/plans';
  const method = id ? 'PUT' : 'POST';
  await apiCall(url, method, plan);
  closePlanModal();
  loadPlans();
}

async function loadPlans() {
  const data = await apiCall('/api/admin/plans');
  document.getElementById('plans-table').innerHTML = (data?.plans||[]).map(p => {
    const safeName = p.name.replace(/'/g, "\\'");
    const safeDesc = (p.description||'').replace(/'/g, "\\'");
    return `<tr>
      <td data-label="Name"><strong>${p.name}</strong></td>
      <td data-label="Duration">${p.duration_minutes} min</td>
      <td data-label="Price">Ksh ${p.price_ksh}</td>
      <td data-label="Speed">${p.speed_limit}</td>
      <td data-label="Status" class="${p.is_active?'status-active':''}">${p.is_active?'Active':'Inactive'}</td>
      <td data-label="Actions">
        <button class="action-btn edit" onclick="editPlan(${p.id},'${safeName}','${safeDesc}',${p.duration_minutes},${p.price_ksh},'${p.speed_limit}')"><i class="fas fa-edit"></i> Edit</button>
        <button class="action-btn delete" onclick="deletePlan(${p.id},'${safeName}')"><i class="fas fa-trash"></i> Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;">No plans</td></tr>';
}

function showConfirmModal(title, msg, itemName, callback) {
  const existing = document.getElementById('confirmModal');
  if(existing) existing.remove();
  const html = `<div class="confirm-overlay" id="confirmModal" onclick="closeConfirmModal()"><div class="confirm-card" onclick="event.stopPropagation()"><div class="confirm-icon"><i class="fas fa-exclamation-triangle"></i></div><h3>${title}</h3><p>${msg}</p><div class="confirm-item-name">${itemName}</div><div class="confirm-actions"><button class="btn-cancel-confirm" onclick="closeConfirmModal()"><i class="fas fa-times"></i> Cancel</button><button class="btn-delete-confirm" id="confirmDeleteBtn"><i class="fas fa-trash"></i> Delete</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(() => document.getElementById('confirmModal').classList.add('active'), 10);
  document.getElementById('confirmDeleteBtn').addEventListener('click', function() { closeConfirmModal(); if(callback) callback(); });
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if(modal) { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); }
}

function deletePlan(id, name) {
  showConfirmModal('Delete Plan', 'Are you sure you want to permanently delete this plan?', name, async () => {
    await apiCall('/api/admin/plans/'+id, 'DELETE');
    loadPlans();
  });
}

function deleteUser(key, name) {
  showConfirmModal('Delete User', 'Are you sure you want to permanently delete this user?', name, async () => {
    await apiCall('/api/admin/settings', 'POST', {key, value:'__DELETED__'});
    loadUsers();
  });
}

async function loadCurrentPassword() {
  const data = await apiCall('/api/admin/settings');
  if (data && data.settings) {
    const passSetting = data.settings.find(s => s.setting_key === 'admin_password');
    const display = document.getElementById('current-admin-password-display');
    if (display) {
      display.value = passSetting ? passSetting.setting_value : 'DancoDev@2024';
    }
  }
}

async function loadMikrotikSettings() {
  const data = await apiCall('/api/admin/settings');
  if(data) data.settings.forEach(s => { const el = document.getElementById(s.setting_key); if(el) el.value = s.setting_value; });
}
async function loadMpesaSettings() {
  const data = await apiCall('/api/admin/settings');
  if(data) data.settings.forEach(s => { const el = document.getElementById(s.setting_key); if(el) el.value = s.setting_value; });
}
async function saveMikrotikSettings() {
  ['mt-host','mt-user','mt-pass'].forEach(async k => { const v = document.getElementById(k)?.value; if(v) await apiCall('/api/admin/settings', 'POST', {key:k, value:v}); });
  alert('Saved!');
}
async function saveMpesaSettings() {
  ['mpesa-key','mpesa-secret','mpesa-passkey','mpesa-till','mpesa-shortcode'].forEach(async k => { const v = document.getElementById(k)?.value; if(v) await apiCall('/api/admin/settings', 'POST', {key:k, value:v}); });
  alert('Saved!');
}

async function changePassword() {
  const cp = document.getElementById('current-password').value;
  const np = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;
  if (!cp || !np || !confirm) { alert('Fill all fields'); return; }
  if (np !== confirm) { alert('Passwords do not match'); return; }
  if (np.length < 6) { alert('Password must be at least 6 characters'); return; }
  const result = await apiCall('/api/admin/settings', 'POST', {key:'admin_password', value:np});
  if (result && result.success) {
    const display = document.getElementById('current-admin-password-display');
    if (display) display.value = np;
    alert('✅ Password updated!');
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  }
}

function showAddUser() { document.getElementById('add-user-form').style.display = 'block'; }
async function addUser() {
  const name = document.getElementById('new-user-name').value;
  const username = document.getElementById('new-user-username').value;
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  if(!name||!username||!password) { alert('Fill all fields'); return; }
  await apiCall('/api/admin/settings', 'POST', {key:'user_'+username, value:JSON.stringify({name,username,password,role})});
  document.getElementById('add-user-form').style.display = 'none'; loadUsers();
}
async function loadUsers() {
  const data = await apiCall('/api/admin/settings');
  const users = (data?.settings||[]).filter(s => s.setting_key.startsWith('user_')).map(s => { try { return JSON.parse(s.setting_value); } catch(e) { return null; } }).filter(u => u);
  document.getElementById('users-table').innerHTML = users.map(u =>
    `<tr><td data-label="Name">${u.name}</td><td data-label="Username">${u.username}</td><td data-label="Role">${u.role||'admin'}</td><td data-label="Status" class="status-active">Active</td><td data-label="Actions"><button class="action-btn delete" onclick="deleteUser('user_${u.username}','${u.name}')"><i class="fas fa-trash"></i> Delete</button></td></tr>`
  ).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;">No users</td></tr>';
}