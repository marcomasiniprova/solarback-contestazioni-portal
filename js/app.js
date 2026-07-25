(function() {
  'use strict';

  const STORAGE_KEY = 'solarback_contestazioni';
  const STATI = {
    ricevuta: { label: 'Ricevuta', ordine: 0 },
    in_valutazione: { label: 'In valutazione', ordine: 1 },
    info_richieste: { label: 'Info richieste', ordine: 2 },
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
    setupNav();
    setupForm();
    setupDashboard();
    setupModal();
    setupSidebarToggle();
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
    DOM.elementiOggettivi = document.getElementById('elementiOggettivi');
    DOM.uploadZone = document.getElementById('uploadZone');
    DOM.fileInput = document.getElementById('fileInput');
    DOM.fileList = document.getElementById('fileList');
    DOM.resetBtn = document.getElementById('resetBtn');
    DOM.topbarTitle = document.getElementById('topbarTitle');

    DOM.navItems = document.querySelectorAll('.nav-item');
    DOM.sections = {
      form: document.getElementById('section-form'),
      dashboard: document.getElementById('section-dashboard')
    };
    DOM.sidebar = document.getElementById('sidebar');
    DOM.menuToggle = document.getElementById('menuToggle');
    DOM.contestazioniList = document.getElementById('contestazioniList');
    DOM.contestazioniBadge = document.getElementById('contestazioniBadge');

    DOM.filterSearch = document.getElementById('filterSearch');
    DOM.filterStato = document.getElementById('filterStato');
    DOM.filterPartner = document.getElementById('filterPartner');
    DOM.resetFiltri = document.getElementById('resetFiltri');

    DOM.modal = document.getElementById('detailModal');
    DOM.modalClose = document.getElementById('modalClose');
    DOM.modalTitle = document.getElementById('modalTitle');
    DOM.modalBody = document.getElementById('modalBody');
    DOM.modalStatoBadge = document.getElementById('modalStatoBadge');

    DOM.stats = {
      totale: document.getElementById('statTotale'),
      ricevuta: document.getElementById('statRicevuta'),
      valutazione: document.getElementById('statValutazione'),
      info: document.getElementById('statInfo'),
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

  function setupNav() {
    DOM.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const target = item.dataset.tab;
        DOM.navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        Object.keys(DOM.sections).forEach(key => {
          DOM.sections[key].classList.toggle('active', key === target);
        });
        DOM.topbarTitle.textContent = target === 'form' ? 'Nuova Contestazione' : 'Contestazioni';
        if (window.innerWidth <= 900) {
          DOM.sidebar.classList.remove('open');
        }
      });
    });
  }

  function setupForm() {
    DOM.motivazione.addEventListener('input', () => {
      const len = DOM.motivazione.value.length;
      DOM.motivazioneCount.textContent = len;
      if (len > 2000) {
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
        mostraToast('Il file ' + file.name + ' supera i 10 MB', 'error');
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
      li.querySelector('.file-remove').addEventListener('click', function() {
        fileCaricati.splice(i, 1);
        aggiornaFileList();
      });
      DOM.fileList.appendChild(li);
    });
  }

  function validaForm() {
    let valido = true;
    const campi = [
      { el: DOM.partner },
      { el: DOM.evento },
      { el: DOM.idSopralluogo },
      { el: DOM.dataEvento },
      { el: DOM.motivazione }
    ];

    campi.forEach(c => {
      c.el.style.borderColor = '';
      if (!c.el.value.trim()) {
        c.el.style.borderColor = '#E04F4F';
        valido = false;
      }
    });

    DOM.uploadZone.style.borderColor = '';

    if (!valido) {
      mostraToast('Compila tutti i campi obbligatori', 'error');
      return false;
    }

    if (DOM.motivazione.value.trim().length < 50) {
      DOM.motivazione.style.borderColor = '#E04F4F';
      mostraToast('La motivazione deve contenere almeno 50 caratteri', 'error');
      return false;
    }

    if (fileCaricati.length === 0) {
      DOM.uploadZone.style.borderColor = '#E04F4F';
      mostraToast('Carica almeno un documento a supporto', 'error');
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
      elementiOggettivi: DOM.elementiOggettivi.value.trim(),
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
    aggiornaFiltriPartner();

    mostraToast('Contestazione ' + id + ' inviata con successo', 'success');
  }

  function resetForm() {
    DOM.form.reset();
    DOM.motivazioneCount.textContent = '0';
    fileCaricati = [];
    DOM.fileList.innerHTML = '';
    DOM.uploadZone.style.borderColor = '';
    setDefaultDate();
    document.querySelectorAll('.form-field input, .form-field select, .form-field textarea').forEach(el => {
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
        '  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>' +
        '  <h3>' + (contestazioni.length === 0 ? 'Nessuna contestazione' : 'Nessun risultato') + '</h3>' +
        '  <p>' + (contestazioni.length === 0 ? 'Le contestazioni inviate appariranno in questa sezione.' : 'Nessuna corrispondenza per i filtri selezionati.') + '</p>' +
        '</div>';
      return;
    }

    let html = '';
    filtrate.forEach(c => {
      html +=
        '<div class="contestazione-item" data-id="' + c.id + '">' +
        '  <div class="item-id">' + c.id + '</div>' +
        '  <div class="item-body">' +
        '    <div class="item-row">' +
        '      <span class="item-field"><span class="label">Partner:</span> ' + escapeHtml(c.partner) + '</span>' +
        '      <span class="item-field"><span class="label">Evento:</span> ' + escapeHtml(c.idSopralluogo) + '</span>' +
        '      <span class="item-field"><span class="label">Tipo:</span> ' + escapeHtml(c.evento) + '</span>' +
        '    </div>' +
        '    <div class="item-preview">' + escapeHtml(accorcia(c.motivazione, 100)) + '</div>' +
        '  </div>' +
        '  <div class="item-side">' +
        '    <span class="stato-badge stato-' + c.stato + '">' + getStatoLabel(c.stato) + '</span>' +
        '    <span class="item-date">' + formatDate(c.dataCreazione) + '</span>' +
        '  </div>' +
        '</div>';
    });

    DOM.contestazioniList.innerHTML = html;

    DOM.contestazioniList.querySelectorAll('.contestazione-item').forEach(card => {
      card.addEventListener('click', function() {
        const id = this.dataset.id;
        const c = contestazioni.find(x => x.id === id);
        if (c) apriDettaglio(c);
      });
    });
  }

  function accorcia(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '\u2026' : text;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderStats() {
    const tot = contestazioni.length;
    DOM.stats.totale.textContent = tot || '0';
    DOM.stats.ricevuta.textContent = contestazioni.filter(c => c.stato === 'ricevuta').length || '0';
    DOM.stats.valutazione.textContent = contestazioni.filter(c => c.stato === 'in_valutazione').length || '0';
    DOM.stats.info.textContent = contestazioni.filter(c => c.stato === 'info_richieste').length || '0';
    DOM.stats.accolta.textContent = contestazioni.filter(c => c.stato === 'accolta').length || '0';
    DOM.stats.respinta.textContent = contestazioni.filter(c => c.stato === 'respinta').length || '0';
  }

  function aggiornaContatore() {
    const aperte = contestazioni.filter(c =>
      c.stato === 'ricevuta' || c.stato === 'in_valutazione' || c.stato === 'info_richieste'
    ).length;
    DOM.contestazioniBadge.textContent = aperte;
    DOM.contestazioniBadge.style.display = aperte > 0 ? 'inline' : 'none';
  }

  function aggiornaFiltriPartner() {
    const partners = [...new Set(contestazioni.map(c => c.partner))];
    const select = DOM.filterPartner;
    const val = select.value;
    select.innerHTML = '<option value="">Tutti i partner</option>';
    partners.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
    select.value = val;
  }

  function setupDashboard() {
    DOM.filterSearch.addEventListener('input', debounce(function() { renderDashboard(); }, 200));
    DOM.filterStato.addEventListener('change', function() { renderDashboard(); });
    DOM.filterPartner.addEventListener('change', function() { renderDashboard(); });

    DOM.resetFiltri.addEventListener('click', function() {
      DOM.filterSearch.value = '';
      DOM.filterStato.value = '';
      DOM.filterPartner.value = '';
      renderDashboard();
    });
  }

  function setupModal() {
    DOM.modalClose.addEventListener('click', chiudiModal);
    DOM.modal.addEventListener('click', function(e) {
      if (e.target === DOM.modal) chiudiModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') chiudiModal();
    });
  }

  function apriDettaglio(c) {
    const docsHtml = c.documentazione && c.documentazione.length > 0
      ? c.documentazione.map(function(d) {
          return '<span class="detail-doc">' + getFileIcon(d.name) + ' ' + d.name + ' <span style="color:var(--text-disabled);font-size:11.5px">(' + formatFileSize(d.size) + ')</span></span>';
        }).join('')
      : '<span style="color:var(--text-disabled)">Nessun documento</span>';

    const timelineHtml = c.storico.map(function(s, i) {
      return '<div class="timeline-item' + (i === c.storico.length - 1 ? ' current' : '') + '">' +
        '  <div class="timeline-date">' + formatDateTime(s.data) + '</div>' +
        '  <div class="timeline-stato">' + getStatoLabel(s.stato) + '</div>' +
        (s.note ? '<div class="timeline-note">' + s.note + '</div>' : '') +
        '</div>';
    }).join('');

    const elementiHtml = c.elementiOggettivi
      ? '<div class="detail-item full"><span class="detail-label">Elementi oggettivi</span><div class="detail-value">' + escapeHtml(c.elementiOggettivi).replace(/\n/g, '<br>') + '</div></div>'
      : '';

    DOM.modalTitle.textContent = 'Contestazione ' + c.id;
    DOM.modalBody.innerHTML =
      '<div class="detail-grid">' +
      '  <div class="detail-item"><span class="detail-label">ID</span><span class="detail-value">' + c.id + '</span></div>' +
      '  <div class="detail-item"><span class="detail-label">Stato</span><span class="detail-value"><span class="stato-badge stato-' + c.stato + '">' + getStatoLabel(c.stato) + '</span></span></div>' +
      '  <div class="detail-item"><span class="detail-label">Partner</span><span class="detail-value">' + escapeHtml(c.partner) + '</span></div>' +
      '  <div class="detail-item"><span class="detail-label">Tipo evento</span><span class="detail-value">' + escapeHtml(c.evento) + '</span></div>' +
      '  <div class="detail-item"><span class="detail-label">ID evento</span><span class="detail-value">' + escapeHtml(c.idSopralluogo) + '</span></div>' +
      '  <div class="detail-item"><span class="detail-label">Data evento</span><span class="detail-value">' + formatDate(c.dataEvento) + '</span></div>' +
      '  <div class="detail-item full"><span class="detail-label">Data creazione</span><span class="detail-value">' + formatDateTime(c.dataCreazione) + '</span></div>' +
      '  <div class="detail-item full"><span class="detail-label">Motivazione</span><div class="detail-value multiline">' + escapeHtml(c.motivazione).replace(/\n/g, '<br>') + '</div></div>' +
      elementiHtml +
      '</div>' +

      '<div class="detail-section-title">Documentazione</div>' +
      '<div class="detail-docs">' + docsHtml + '</div>' +

      '<div class="detail-section-title">Cronologia</div>' +
      '<div class="timeline">' + timelineHtml + '</div>' +

      '<div class="detail-section-title">Gestione</div>' +
      '<div class="crm-section">' +
      '  <label for="crmNote">Note CRM</label>' +
      '  <textarea id="crmNote" rows="3" placeholder="Note interne...">' + escapeHtml(c.noteCRM || '') + '</textarea>' +
      '</div>' +
      '<div class="crm-section" style="margin-top:10px">' +
      '  <label for="crmDecisione">Decisione</label>' +
      '  <textarea id="crmDecisione" rows="2" placeholder="Esito della valutazione...">' + escapeHtml(c.decisione || '') + '</textarea>' +
      '</div>' +

      '<div class="detail-section-title">Cambia stato</div>' +
      '<div class="detail-actions">' +
      Object.keys(STATI).map(function(s) {
        return '<button class="btn ' + (c.stato === s ? 'btn-primary' : 'btn-outline') + ' btn-sm change-stato" data-stato="' + s + '">' + getStatoLabel(s) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="detail-actions" style="border-top:none;padding-top:8px">' +
      '  <button class="btn btn-primary btn-sm" id="salvaCRM">Salva modifiche</button>' +
      '</div>';

    DOM.modal.classList.add('open');

    setTimeout(function() {
      const noteEl = document.getElementById('crmNote');
      const decisioneEl = document.getElementById('crmDecisione');

      document.querySelectorAll('.change-stato').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const nuovoStato = this.dataset.stato;
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

      document.getElementById('salvaCRM').addEventListener('click', function() {
        c.noteCRM = noteEl.value;
        c.decisione = decisioneEl.value;
        salvaDati();
        mostraToast('Modifiche salvate', 'success');
        chiudiModal();
      });
    }, 50);
  }

  function chiudiModal() {
    DOM.modal.classList.remove('open');
  }

  function setupSidebarToggle() {
    DOM.menuToggle.addEventListener('click', function() {
      DOM.sidebar.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 900 &&
          DOM.sidebar.classList.contains('open') &&
          !DOM.sidebar.contains(e.target) &&
          !DOM.menuToggle.contains(e.target)) {
        DOM.sidebar.classList.remove('open');
      }
    });
  }

  function mostraToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() { toast.remove(); }, 300);
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