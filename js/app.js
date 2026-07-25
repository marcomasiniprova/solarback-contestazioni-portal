const STORAGE_KEY = 'solarback_contestazioni';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf','image/jpeg','image/png'];

// ===== STATE =====
let contestazioni = [];
let files = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderContestazioni();
  updateStats();
  updateBadge();
  populatePartnerFilter();
  initEventListeners();
  setDefaultDate();
});

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    contestazioni = raw ? JSON.parse(raw) : [];
  } catch { contestazioni = []; }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contestazioni));
}

function setDefaultDate() {
  const el = document.getElementById('dataEvento');
  if (el) el.value = new Date().toISOString().slice(0,10);
}

// ===== ID GENERATION =====
function generateId() {
  const n = String(contestazioni.length + 1).padStart(4,'0');
  return 'CT-' + new Date().getFullYear() + '-' + n;
}

// ===== FORM SUBMISSION =====
document.getElementById('contestazioneForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const motivazione = document.getElementById('motivazione').value.trim();
  if (motivazione.length < 50) {
    showToast('La motivazione deve essere di almeno 50 caratteri (' + motivazione.length + '/' + 50 + ')', 'error');
    document.getElementById('motivazione').focus();
    return;
  }
  const data = {
    id: generateId(),
    partner: document.getElementById('partner').value,
    evento: document.getElementById('evento').value,
    idSopralluogo: document.getElementById('idSopralluogo').value.trim(),
    dataEvento: document.getElementById('dataEvento').value,
    motivazione,
    elementiOggettivi: document.getElementById('elementiOggettivi').value.trim(),
    documentazione: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
    stato: 'ricevuta',
    dataCreazione: new Date().toISOString(),
    note: [],
    timeline: [
      { data: new Date().toISOString(), evento: 'Contestazione ricevuta', autore: 'Sistema' }
    ]
  };
  contestazioni.unshift(data);
  saveData();
  resetForm();
  renderContestazioni();
  updateStats();
  updateBadge();
  populatePartnerFilter();
  showToast('Contestazione inviata con successo (ID: ' + data.id + ')', 'success');
});

// ===== RESET =====
document.getElementById('resetBtn').addEventListener('click', resetForm);
function resetForm() {
  document.getElementById('contestazioneForm').reset();
  files = [];
  renderFiles();
  document.getElementById('motivazioneCount').textContent = '0';
  setDefaultDate();
}

// ===== MOTIVAZIONE COUNTER =====
document.getElementById('motivazione').addEventListener('input', function() {
  const len = this.value.length;
  document.getElementById('motivazioneCount').textContent = len;
  if (len < 50 && len > 0) {
    this.classList.add('field-error');
  } else {
    this.classList.remove('field-error');
  }
});

// ===== FILE UPLOAD =====
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = 'var(--gold)';
  uploadZone.style.background = 'var(--gold-glow)';
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = '';
  uploadZone.style.background = '';
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = '';
  uploadZone.style.background = '';
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

function handleFiles(fileList) {
  for (const file of fileList) {
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
      showToast('Formato non supportato: ' + file.name, 'error');
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('File troppo grande: ' + file.name + ' (max 10 MB)', 'error');
      continue;
    }
    if (!files.find(f => f.name === file.name && f.size === file.size)) {
      files.push(file);
    }
  }
  renderFiles();
}

function renderFiles() {
  const list = document.getElementById('fileList');
  if (files.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = files.map((f,i) => {
    const size = f.size > 1024*1024 ? (f.size/1024/1024).toFixed(1)+' MB' : Math.round(f.size/1024)+' KB';
    return '<li><svg class="file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>' + f.name + '</span><span class="file-size">' + size + '</span><button class="file-remove" data-i="' + i + '">&times;</button></li>';
  }).join('');
  document.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      files.splice(parseInt(btn.dataset.i), 1);
      renderFiles();
    });
  });
}

// ===== DASHBOARD =====
function renderContestazioni(filtered) {
  const lista = document.getElementById('contestazioniList');
  const items = filtered || contestazioni;
  if (items.length === 0) {
    lista.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg><h3>Nessuna contestazione</h3><p>Le contestazioni inviate appariranno in questa sezione.</p></div>';
    return;
  }
  lista.innerHTML = items.map(c => {
    const data = new Date(c.dataCreazione).toLocaleDateString('it-IT');
    return '<div class="contestazione-card" data-id="' + c.id + '"><span class="card-id">' + c.id + '</span><span class="card-partner">' + esc(c.partner) + '</span><span class="card-evento">' + esc(c.idSopralluogo) + '</span><span class="badge badge-' + c.stato + '">' + statoLabel(c.stato) + '</span><span class="card-data">' + data + '</span></div>';
  }).join('');
  document.querySelectorAll('.contestazione-card').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.id));
  });
}

function statoLabel(s) {
  const map = { ricevuta:'Ricevuta', in_valutazione:'In valutazione', info_richieste:'Info richieste', accolta:'Accolta', respinta:'Respinta', chiusa:'Chiusa' };
  return map[s] || s;
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function updateStats() {
  const counts = { totale: contestazioni.length, ricevuta:0, in_valutazione:0, info_richieste:0, accolta:0, respinta:0 };
  contestazioni.forEach(c => { if (counts[c.stato]!==undefined) counts[c.stato]++; });
  Object.keys(counts).forEach(k => {
    const el = document.getElementById(k === 'totale' ? 'statTotale' : 'stat' + k.charAt(0).toUpperCase() + k.slice(1));
    if (el) el.textContent = counts[k];
  });
}

function updateBadge() {
  const badge = document.getElementById('contestazioniBadge');
  if (badge) badge.textContent = contestazioni.length;
}

function populatePartnerFilter() {
  const sel = document.getElementById('filterPartner');
  const partners = [...new Set(contestazioni.map(c => c.partner))];
  sel.innerHTML = '<option value="">Tutti i partner</option>' + partners.map(p => '<option value="' + esc(p) + '">' + esc(p) + '</option>').join('');
}

// ===== FILTERS =====
function applyFilters() {
  const search = document.getElementById('filterSearch').value.toLowerCase();
  const stato = document.getElementById('filterStato').value;
  const partner = document.getElementById('filterPartner').value;
  let filtered = contestazioni;
  if (search) filtered = filtered.filter(c => c.id.toLowerCase().includes(search) || c.partner.toLowerCase().includes(search) || c.idSopralluogo.toLowerCase().includes(search));
  if (stato) filtered = filtered.filter(c => c.stato === stato);
  if (partner) filtered = filtered.filter(c => c.partner === partner);
  renderContestazioni(filtered);
}

document.getElementById('filterSearch').addEventListener('input', applyFilters);
document.getElementById('filterStato').addEventListener('change', applyFilters);
document.getElementById('filterPartner').addEventListener('change', applyFilters);
document.getElementById('resetFiltri').addEventListener('click', () => {
  document.getElementById('filterSearch').value = '';
  document.getElementById('filterStato').value = '';
  document.getElementById('filterPartner').value = '';
  renderContestazioni();
});

// ===== MODAL =====
function openModal(id) {
  const c = contestazioni.find(x => x.id === id);
  if (!c) return;
  document.getElementById('modalTitle').textContent = c.id;
  const badge = document.getElementById('modalStatoBadge');
  badge.textContent = statoLabel(c.stato);
  badge.className = 'modal-badge badge badge-' + c.stato;
  const body = document.getElementById('modalBody');
  const dataEv = c.dataEvento ? new Date(c.dataEvento + 'T00:00:00').toLocaleDateString('it-IT') : '-';
  const dataCr = new Date(c.dataCreazione).toLocaleString('it-IT');
  body.innerHTML = '<div class="detail-section"><div class="detail-grid"><div><div class="detail-label">Partner</div><div class="detail-value">' + esc(c.partner) + '</div></div><div><div class="detail-label">Tipo evento</div><div class="detail-value">' + esc(c.evento) + '</div></div><div><div class="detail-label">ID Sopralluogo</div><div class="detail-value">' + esc(c.idSopralluogo) + '</div></div><div><div class="detail-label">Data evento</div><div class="detail-value">' + dataEv + '</div></div></div></div><div class="detail-section"><div class="detail-label">Motivazione</div><div class="detail-textarea">' + esc(c.motivazione) + '</div></div>' + (c.elementiOggettivi ? '<div class="detail-section"><div class="detail-label">Elementi oggettivi</div><div class="detail-textarea">' + esc(c.elementiOggettivi) + '</div></div>' : '') + (c.documentazione && c.documentazione.length ? '<div class="detail-section"><div class="detail-label">Documentazione (' + c.documentazione.length + ')</div><ul class="file-list">' + c.documentazione.map(d => '<li><svg class="file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>' + esc(d.name) + '</span></li>').join('') + '</ul></div>' : '') + '<div class="detail-section"><div class="detail-label">Data presentazione</div><div class="detail-value">' + dataCr + '</div></div>';
  if (c.timeline && c.timeline.length) {
    let tlHtml = '<div class="detail-section"><div class="detail-label">Timeline</div><div class="timeline">';
    c.timeline.forEach(t => {
      const d = new Date(t.data).toLocaleString('it-IT');
      tlHtml += '<div class="timeline-item"><div class="timeline-dot active"></div><div class="timeline-date">' + d + '</div><div class="timeline-text">' + esc(t.evento) + ' — ' + esc(t.autore) + '</div>' + (t.nota ? '<div class="timeline-note">' + esc(t.nota) + '</div>' : '') + '</div>';
    });
    tlHtml += '</div></div>';
    body.innerHTML += tlHtml;
  }
  body.innerHTML += '<div class="detail-section" style="display:flex;gap:8px;flex-wrap:wrap">' + getStateActions(c) + '</div>';
  document.getElementById('detailModal').classList.add('open');
  attachModalActions(c);
}

function getStateActions(c) {
  let actions = '';
  if (c.stato === 'ricevuta') actions = '<button class="btn btn-primary btn-sm" data-action="in_valutazione">Avvia valutazione</button><button class="btn btn-outline btn-sm" data-action="respinta">Respinta</button>';
  else if (c.stato === 'in_valutazione') actions = '<button class="btn btn-primary btn-sm" data-action="accolta">Accogli</button><button class="btn btn-outline btn-sm" data-action="info_richieste">Richiedi info</button><button class="btn btn-outline btn-sm" data-action="respinta">Respinta</button>';
  else if (c.stato === 'info_richieste') actions = '<button class="btn btn-primary btn-sm" data-action="accolta">Accogli</button><button class="btn btn-outline btn-sm" data-action="respinta">Respinta</button><button class="btn btn-outline btn-sm" data-action="in_valutazione">In valutazione</button>';
  else if (c.stato === 'accolta') actions = '<button class="btn btn-outline btn-sm" data-action="chiusa">Chiudi</button>';
  else if (c.stato === 'respinta') actions = '<button class="btn btn-outline btn-sm" data-action="chiusa">Chiudi</button>';
  return actions;
}

function attachModalActions(c) {
  document.querySelectorAll('.modal-body [data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newStato = btn.dataset.action;
      const nota = prompt('Nota operativa (opzionale):');
      c.stato = newStato;
      if (!c.timeline) c.timeline = [];
      const label = statoLabel(newStato);
      c.timeline.push({ data: new Date().toISOString(), evento: 'Stato cambiato in: ' + label, autore: 'Operatore', nota: nota || '' });
      saveData();
      renderContestazioni();
      updateStats();
      updateBadge();
      document.getElementById('detailModal').classList.remove('open');
      showToast('Contestazione ' + c.id + ' aggiornata a ' + label, 'success');
    });
  });
}

document.getElementById('modalClose').addEventListener('click', () => document.getElementById('detailModal').classList.remove('open'));
document.getElementById('detailModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) document.getElementById('detailModal').classList.remove('open'); });

// ===== TOAST =====
function showToast(msg, type) {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'success');
  t.innerHTML = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ===== SIDEBAR / TAB NAV =====
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + tab).classList.add('active');
    document.getElementById('topbarTitle').textContent = tab === 'form' ? 'Nuova Contestazione' : 'Contestazioni';
    document.getElementById('sidebar').classList.remove('open');
    if (tab === 'dashboard') { renderContestazioni(); populatePartnerFilter(); }
  });
});

// ===== CLOSE SIDEBAR ON CLICK OUTSIDE =====
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menuToggle');
  if (window.innerWidth <= 768 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});