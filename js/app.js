(function() {
  'use strict';

  const STORAGE_KEY = 'solarback_contestazioni';
  const STATI = {
    ricevuta: { label: 'Ricevuta', ordine: 0 },
    in_valutazione: { label: 'In Valutazione', ordine: 1 },
    info_richieste: { label: 'Informazioni Richieste', ordine: 2 },
    accolta: { label: 'Accolta', ordine: 3 },
    respinta: { label: 'Respinta', ordine: 3 },
    chiusa: { label: 'Chiusa', ordine: 4 }
  };

  let contestazioni = [];
  let fileCaricati = [];
  let prossimoId = 1;

  const DOM = {};

  function init() {
    cacheDOM();
    caricaDati();
    setupTabs();
    setupForm();
    setupDashboard();
    setupModal();
    setupMobileMenu();
    renderDashboard();
    renderStats();
    aggiornaContatore();
    aggiornaFiltriPartner();
    setDefaultDate();
  }

  function cacheDOM() {
    DOM.form = document.getElementById('contestazioneForm');
    DOM.partner = document.getElementById('partner');
    DOM.evento = document.getElementById('evento');
    DOM.idSopralluogo = document.getElementById('idSopralluogo');
    DOM.dataEvento = document.getElementById('dataEvento');
    DOM.motivazione = document.getElementById('motivazione');
    DOM.motivazioneCount = document.getElementById('motivazioneCount');
    DOM.uploadZone = document.getElementById('uploadZone');
    DOM.fileInput = document.getElementById('fileInput');
    DOM.fileList = document.getElementById('fileList');
    DOM.resetBtn = document.getElementById('resetBtn');
    DOM.submitBtn = document.querySelector('#contestazioneForm .btn-primary');

    DOM.navTabs = document.querySelectorAll('.nav-tab');
    DOM.sections = {
      form: document.getElementById('section-form'),
      dashboard: document.getElementById('section-dashboard')
    };
    DOM.contestazioniList = document.getElementById('contestazioniList');
    DOM.contestazioniCounter = document.getElementById('contestazioniCounter');

    DOM.filterSearch = document.getElementById('filterSearch');
    DOM.filterStato = document.getElementById('filterStato');
    DOM.filterPartner = document.getElementById('filterPartner');
    DOM.resetFiltri = document.getElementById('resetFiltri');

    DOM.modal = document.getElementById('detailModal');
    DOM.modalClose = document.getElementById('modalClose');
    DOM.modalTitle = document.getElementById('modalTitle');
    DOM.modalBody = document.getElementById('modalBody');

    DOM.stats = {
      totale: document.getElementById('statTotale'),
      ricevuta: document.getElementById('statRicevuta'),
      valutazione: document.getElementById('statValutazione'),
      accolta: document.getElementById('statAccolta'),
      respinta: document.getElementById('statRespinta')
    };

    DOM.toastContainer = document.getElementById('toastContainer');
  }

  function caricaDati() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        contestazioni = data.contestazioni || [];
        prossimoId = data.prossimoId || 1;
      } catch (e) {
        contestazioni = [];
        prossimoId = 1;
      }
    }
  }

  function salvaDati() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      contestazioni: contestazioni,
      prossimoId: prossimoId
    }));
  }

  function getNextId() {
    return String(prossimoId++).padStart(3, '0');
  }

  function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    DOM.dataEvento.value = today;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getStatoLabel(stato) {
    return STATI[stato] ? STATI[stato].label : stato;
  }

  function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '\u{1F4C4}';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return '\u{1F5BC}';
    return '\u{1F4CE}';
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setupTabs() {
    DOM.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        DOM.navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Object.keys(DOM.sections).forEach(key => {
          DOM.sections[key].classList.toggle('active', key === target);
        });
      });
    });
  }

  function setupForm() {
    DOM.motivazione.addEventListener('input', () => {
      DOM.motivazioneCount.textContent = DOM.motivazione.value.length;
      if (DOM.motivazione.value.length > 2000) {
        DOM.motivazione.value = DOM.motivazione.value.slice(0, 2000);
      }
    });

    DOM.uploadZone.addEventListener('click', () => DOM.fileInput.click());

    DOM.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      DOM.uploadZone.classList.add('dragover');
    });

    DOM.uploadZone.addEventListener('dragleave', () => {
      DOM.uploadZone.classList.remove('dragover');
    });

    DOM.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      DOM.uploadZone.classList.remove('dragover');
      gestisciFile(e.dataTransfer.files);
    });

    DOM.fileInput.addEventListener('change', () => {
      gestisciFile(DOM.fileInput.files);
      DOM.fileInput.value = '';
    });

    DOM.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (validaForm()) {
        inviaContestazione();
      }
    });

    DOM.resetBtn.addEventListener('click', resetForm);
  }

  function gestisciFile(files) {
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        mostraToast('Il file ' + file.name + ' supera i 10MB', 'error');
        continue;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        fileCaricati.push({
          name: file.name,
          size: file.size,
          type: file.type,
          data: e.target.result
        });
        aggiornaFileList();
      };
      reader.readAsDataURL(file);
    }
  }

  function aggiornaFileList() {
    DOM.fileList.innerHTML = '';
    fileCaricati.forEach((f, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span>' + getFileIcon(f.name) + '</span> ' +
        '<span>' + f.name + '</span>' +
        '<span class="file-size">' + formatFileSize(f.size) + '</span>' +
        '<button class="file-remove" data-index="' + i + '">&times;</button>';
      li.querySelector('.file-remove').addEventListener('click', () => {
        fileCaricati.splice(i, 1);
        aggiornaFileList();
      });
      DOM.fileList.appendChild(li);
    });
  }

  function validaForm() {
    let valido = true;
    const fields = [
      { el: DOM.partner, name: 'Partner' },
      { el: DOM.evento, name: 'Evento' },
      { el: DOM.idSopralluogo, name: 'ID Sopralluogo' },
      { el: DOM.dataEvento, name: 'Data Evento' },
      { el: DOM.motivazione, name: 'Motivazione' }
    ];

    fields.forEach(f => {
      f.el.style.borderColor = '';
      if (!f.el.value.trim()) {
        f.el.style.borderColor = '#dc2626';
        valido = false;
      }
    });

    DOM.uploadZone.style.borderColor = '';

    if (!valido) {
      mostraToast('Compila tutti i campi obbligatori', 'error');
      return false;
    }

    if (fileCaricati.length === 0) {
      DOM.uploadZone.style.borderColor = '#dc2626';
      mostraToast('Carica almeno un documento', 'error');
      return false;
    }

    return true;
  }

  function inviaContestazione() {
    const id = 'SB-' + getNextId();
    const nuova = {
      id: id,
      partner: DOM.partner.value,
      evento: DOM.evento.value,
      idSopralluogo: DOM.idSopralluogo.value.trim(),
      dataEvento: DOM.dataEvento.value,
      motivazione: DOM.motivazione.value.trim(),
      documentazione: fileCaricati.map(f => ({ name: f.name, size: f.size, type: f.type })),
      documentazioneData: fileCaricati.map(f => f.data),
      dataCreazione: new Date().toISOString(),
      stato: 'ricevuta',
      storico: [{
        data: new Date().toISOString(),
        stato: 'ricevuta',
        note: 'Contestazione ricevuta'
      }],
      noteCRM: '',
      decisione: ''
    };

    contestazioni.unshift(nuova);
    salvaDati();
    resetForm();
    renderDashboard();
    renderStats();
    aggiornaContatore();

    mostraToast('Contestazione ' + id + ' inviata con successo!', 'success');
  }

  function resetForm() {
    DOM.form.reset();
    DOM.motivazioneCount.textContent = '0';
    fileCaricati = [];
    DOM.fileList.innerHTML = '';
    DOM.uploadZone.style.borderColor = '';
    setDefaultDate();
    document.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach(el => {
      el.style.borderColor = '';
    });
  }

  function renderDashboard(filtri) {
    const search = (filtri && filtri.search) || DOM.filterSearch.value.toLowerCase().trim();
    const stato = (filtri && filtri.stato) || DOM.filterStato.value;
    const partner = (filtri && filtri.partner) || DOM.filterPartner.value;

    let filtrate = contestazioni;

    if (search) {
      filtrate = filtrate.filter(c =>
        c.id.toLowerCase().includes(search) ||
        c.partner.toLowerCase().includes(search) ||
        c.idSopralluogo.toLowerCase().includes(search) ||
        c.motivazione.toLowerCase().includes(search)
      );
    }

    if (stato) {
      filtrate = filtrate.filter(c => c.stato === stato);
    }

    if (partner) {
      filtrate = filtrate.filter(c => c.partner === partner);
    }

    if (filtrate.length === 0) {
      DOM.contestazioniList.innerHTML =
        '<div class="empty-state">' +
        '  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>' +
        '  <h3>Nessuna contestazione</h3>' +
        '  <p>' + (contestazioni.length === 0 ? 'Le contestazioni inviate appariranno qui.' : 'Nessuna corrispondenza per i filtri selezionati.') + '</p>' +
        '</div>';
      return;
    }

    let html = '';
    filtrate.forEach(c => {
      html +=
        '<div class="contestazione-card" data-id="' + c.id + '">' +
        '  <div class="contestazione-id">' + c.id + '</div>' +
        '  <div class="contestazione-info">' +
        '    <div class="info-main">' +
        '      <span><span class="label">Partner:</span> ' + escapeHtml(c.partner) + '</span>' +
        '      <span><span class="label">Sopralluogo:</span> ' + escapeHtml(c.idSopralluogo) + '</span>' +
        '      <span><span class="label">Evento:</span> ' + escapeHtml(c.evento) + '</span>' +
        '    </div>' +
        '    <div class="info-preview">' + escapeHtml(c.motivazione.slice(0, 120)) + (c.motivazione.length > 120 ? '...' : '') + '</div>' +
        '  </div>' +
        '  <div class="contestazione-meta">' +
        '    <span class="stato-badge stato-' + c.stato + '">' + getStatoLabel(c.stato) + '</span>' +
        '    <span class="contestazione-date">' + formatDate(c.dataCreazione) + '</span>' +
        '  </div>' +
        '</div>';
    });

    DOM.contestazioniList.innerHTML = html;

    DOM.contestazioniList.querySelectorAll('.contestazione-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const c = contestazioni.find(x => x.id === id);
        if (c) apriDettaglio(c);
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderStats() {
    const tot = contestazioni.length;
    const ricevute = contestazioni.filter(c => c.stato === 'ricevuta').length;
    const valutazione = contestazioni.filter(c => c.stato === 'in_valutazione').length;
    const accolte = contestazioni.filter(c => c.stato === 'accolta').length;
    const respinte = contestazioni.filter(c => c.stato === 'respinta').length;

    DOM.stats.totale.textContent = tot;
    DOM.stats.ricevuta.textContent = ricevute;
    DOM.stats.valutazione.textContent = valutazione;
    DOM.stats.accolta.textContent = accolte;
    DOM.stats.respinta.textContent = respinte;
  }

  function aggiornaContatore() {
    const aperte = contestazioni.filter(c =>
      c.stato === 'ricevuta' || c.stato === 'in_valutazione' || c.stato === 'info_richieste'
    ).length;
    DOM.contestazioniCounter.textContent = aperte;
    DOM.contestazioniCounter.style.display = aperte > 0 ? 'inline' : 'none';
  }

  function aggiornaFiltriPartner() {
    const partners = [...new Set(contestazioni.map(c => c.partner))];
    const select = DOM.filterPartner;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Tutti i partner</option>';
    partners.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
    select.value = currentValue;
  }

  function setupDashboard() {
    DOM.filterSearch.addEventListener('input', debounce(() => renderDashboard(), 200));
    DOM.filterStato.addEventListener('change', () => renderDashboard());
    DOM.filterPartner.addEventListener('change', () => renderDashboard());

    DOM.resetFiltri.addEventListener('click', () => {
      DOM.filterSearch.value = '';
      DOM.filterStato.value = '';
      DOM.filterPartner.value = '';
      renderDashboard();
    });
  }

  function setupModal() {
    DOM.modalClose.addEventListener('click', chiudiModal);
    DOM.modal.addEventListener('click', (e) => {
      if (e.target === DOM.modal) chiudiModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') chiudiModal();
    });
  }

  function apriDettaglio(c) {
    const docsHtml = c.documentazione && c.documentazione.length > 0
      ? c.documentazione.map(d =>
        '<span class="detail-doc">' + getFileIcon(d.name) + ' ' + d.name + ' <span style="color:var(--gray-600);font-size:12px">(' + formatFileSize(d.size) + ')</span></span>'
      ).join('')
      : '<span style="color:var(--gray-600)">Nessun documento</span>';

    const timelineHtml = c.storico.map((s, i) =>
      '<div class="timeline-item' + (i === c.storico.length - 1 ? ' current' : '') + '">' +
      '  <div class="timeline-date">' + formatDateTime(s.data) + '</div>' +
      '  <div class="timeline-stato">' + getStatoLabel(s.stato) + '</div>' +
      (s.note ? '<div class="timeline-note">' + s.note + '</div>' : '') +
      '</div>'
    ).join('');

    DOM.modalTitle.textContent = 'Dettaglio ' + c.id;
    DOM.modalBody.innerHTML =
      '<div class="detail-grid">' +
      '  <div class="detail-field"><span class="detail-label">ID</span><span class="detail-value">' + c.id + '</span></div>' +
      '  <div class="detail-field"><span class="detail-label">Stato</span><span class="detail-value"><span class="stato-badge stato-' + c.stato + '">' + getStatoLabel(c.stato) + '</span></span></div>' +
      '  <div class="detail-field"><span class="detail-label">Partner</span><span class="detail-value">' + escapeHtml(c.partner) + '</span></div>' +
      '  <div class="detail-field"><span class="detail-label">Evento</span><span class="detail-value">' + escapeHtml(c.evento) + '</span></div>' +
      '  <div class="detail-field"><span class="detail-label">ID Sopralluogo</span><span class="detail-value">' + escapeHtml(c.idSopralluogo) + '</span></div>' +
      '  <div class="detail-field"><span class="detail-label">Data Evento</span><span class="detail-value">' + formatDate(c.dataEvento) + '</span></div>' +
      '  <div class="detail-field full"><span class="detail-label">Data Creazione</span><span class="detail-value">' + formatDateTime(c.dataCreazione) + '</span></div>' +
      '  <div class="detail-field full"><span class="detail-label">Motivazione</span><span class="detail-value">' + escapeHtml(c.motivazione).replace(/\n/g, '<br>') + '</span></div>' +
      '</div>' +

      '<div class="detail-section-title">Documentazione</div>' +
      '<div class="detail-docs">' + docsHtml + '</div>' +

      '<div class="detail-section-title">Cronologia Stati</div>' +
      '<div class="timeline">' + timelineHtml + '</div>' +

      '<div class="detail-section-title">CRM & Gestione</div>' +
      '<div class="crm-notes">' +
      '  <label for="crmNote">Note CRM</label>' +
      '  <textarea id="crmNote" rows="3" placeholder="Aggiungi note interne...">' + escapeHtml(c.noteCRM || '') + '</textarea>' +
      '</div>' +
      '<div class="form-group" style="margin-top:12px">' +
      '  <label for="crmDecisione">Decisione</label>' +
      '  <textarea id="crmDecisione" rows="2" placeholder="Decisione finale...">' + escapeHtml(c.decisione || '') + '</textarea>' +
      '</div>' +

      '<div class="detail-section-title">Cambia Stato</div>' +
      '<div class="detail-actions">' +
      Object.keys(STATI).map(s =>
        '<button class="btn ' + (c.stato === s ? 'btn-primary' : 'btn-ghost') + ' btn-sm change-stato" data-stato="' + s + '">' + getStatoLabel(s) + '</button>'
      ).join('') +
      '</div>' +
      '<div class="detail-actions" style="border-top:none;padding-top:8px">' +
      '  <button class="btn btn-primary btn-sm" id="salvaCRM">Salva Note & Stato</button>' +
      '</div>';

    DOM.modal.classList.add('open');

    setTimeout(() => {
      const noteEl = document.getElementById('crmNote');
      const decisioneEl = document.getElementById('crmDecisione');

      document.querySelectorAll('.change-stato').forEach(btn => {
        btn.addEventListener('click', () => {
          const nuovoStato = btn.dataset.stato;
          const vecchioStato = c.stato;

          if (nuovoStato === vecchioStato) return;

          c.stato = nuovoStato;
          c.storico.push({
            data: new Date().toISOString(),
            stato: nuovoStato,
            note: 'Stato cambiato da ' + getStatoLabel(vecchioStato) + ' a ' + getStatoLabel(nuovoStato)
          });
          c.noteCRM = noteEl ? noteEl.value : c.noteCRM;
          c.decisione = decisioneEl ? decisioneEl.value : c.decisione;

          salvaDati();
          renderDashboard();
          renderStats();
          aggiornaContatore();
          aggiornaFiltriPartner();
          mostraToast('Stato aggiornato: ' + getStatoLabel(nuovoStato), 'success');
          chiudiModal();
        });
      });

      document.getElementById('salvaCRM').addEventListener('click', () => {
        c.noteCRM = noteEl.value;
        c.decisione = decisioneEl.value;
        salvaDati();
        mostraToast('Note CRM salvate', 'success');
        chiudiModal();
      });
    }, 50);
  }

  function chiudiModal() {
    DOM.modal.classList.remove('open');
  }

  function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        document.querySelector('.nav-tabs').classList.toggle('open');
      });
    }
  }

  function mostraToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function debounce(fn, delay) {
    let timer;
    return function() {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  document.addEventListener('DOMContentLoaded', init);
})();