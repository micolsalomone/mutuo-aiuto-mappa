// spostato da index.html <script> e reso DOM-safe
document.addEventListener('DOMContentLoaded', () => {
  // inizializza la mappa (solo una volta)
  const map = L.map('map').setView([41.9, 12.5], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // funzione toast globale (ora visibile a tutti i listener)
  function showToast(msg, ms = 1400) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    // forzare reflow prima di cambiare opacity
    void t.offsetWidth;
    t.style.opacity = '1';
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.style.display = 'none', 200);
    }, ms);
  }

  /* helper per creare un'icona SVG personalizzata.
     Modifica variabili CSS sopra per cambiare colori/dimensioni facilmente. */
  function markerSvgHtml(color, size = 36, height = 46) {
    const shadow = getComputedStyle(document.documentElement).getPropertyValue('--marker-shadow').trim() || 'rgba(0,0,0,0.12)';
    return `
      <svg width="${size}" height="${height}" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- ombra -->
        <ellipse class="pin-shadow" cx="18" cy="36" rx="10" ry="3" fill="${shadow}" opacity="0.22"/>
        <!-- corpo pin (goccia) - riempimento pieno -->
        <path class="pin-fill" d="M18 2C12.5 2 8 6.5 8 12c0 6.8 8 18 10 22 2-4 10-15.2 10-22 0-5.5-4.5-10-10-10z" fill="${color}"/>
      </svg>
    `;
  }

  function createMarker(latlng, type = 'default', options = {}) {
    const cs = getComputedStyle(document.documentElement);
    const size = parseInt(cs.getPropertyValue('--marker-size')) || 36;
    const height = parseInt(cs.getPropertyValue('--marker-height')) || 46;

    const color = (type === 'user')
      ? cs.getPropertyValue('--marker-user').trim()
      : cs.getPropertyValue('--marker-default').trim();

    const icon = L.divIcon({
      className: `custom-marker custom-marker--${type}`,
      html: markerSvgHtml(color, size, height),
      iconSize: [size, height],
      iconAnchor: [Math.round(size/2), Math.round(height - 8)],
      popupAnchor: [0, -Math.round(height * 0.7)]
    });

    return L.marker(latlng, Object.assign({ icon }, options));
  }

  // funzione per caricare GeoJSON anche se fetch fallisce in locale
  async function loadGeoJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Errore fetch');
      return await res.json();
    } catch (e) {
      console.warn('Impossibile caricare da fetch, fallback in locale:', e);
      return JSON.parse(`{
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {
              "name": "Casa delle donne Lucha y Siesta",
              "indirizzo": "Via Lucio Sestio, 10, 00174 Roma RM",
              "phone": "",
              "category": "CAV e Casa delle Donne"
            },
            "geometry": {
              "type": "Point",
              "coordinates": [12.5540227, 41.8595571]
            }
          }
        ]
      }`);
    }
  }

  loadGeoJSON('data/centri.geojson').then(geojson => {
    const layer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        return createMarker(latlng, 'default');
      },
      onEachFeature: (f, l) => {
        const p = f.properties || {};
        const html = `
          <div class="popup-card">
            <div class="popup-icon" aria-hidden="true">📍</div>
            <div class="popup-body">
              <div class="popup-title">${p.name || 'Centro'}</div>
              <div class="popup-sub">${p.indirizzo || ''}</div>
              ${p.phone ? `<div class="popup-meta">Tel: ${p.phone}</div>` : ''}
              <div class="popup-meta">${p.category || ''}</div>
            </div>
          </div>
        `;
        l.bindPopup(html, { className: 'popup--feature', maxWidth: 360 });
      }
    });
    layer.addTo(map);
    try { map.fitBounds(layer.getBounds()); } catch (e) {}
  });

  // blocco latitudine e longitudine su mappa
  const coordsEl = document.getElementById('coords');
  let selectedMarker = null;
  let selectedLatLng = null;

  map.on('move', () => {
    const c = map.getCenter();
    if (!selectedLatLng) {
      coordsEl.style.display = 'block';
      coordsEl.textContent =
        `Latitudine: ${c.lat.toFixed(5)} | Longitudine: ${c.lng.toFixed(5)}`;
    }
  });

  // seleziona coordinate cliccando sulla mappa (simile a Google Maps)
  map.on('click', (e) => {
    selectedLatLng = e.latlng;
    if (selectedMarker) map.removeLayer(selectedMarker);
    selectedMarker = createMarker(selectedLatLng, 'user', { draggable: true }).addTo(map);

    selectedMarker.bindPopup(`
      <div class="popup-card">
        <div class="popup-icon" aria-hidden="true">📌</div>
        <div class="popup-body">
          <div class="popup-title">Coordinate selezionate</div>
          <div class="popup-sub">Lat: ${selectedLatLng.lat.toFixed(6)} · Lng: ${selectedLatLng.lng.toFixed(6)}</div>
          <div class="popup-actions">
            <button id="copyCoordBtn" class="btn" style="background:#fff;color:var(--primary);box-shadow:none;border:1px solid rgba(2,6,23,0.06)">Copia</button>
          </div>
          <div class="popup-meta">Trascina il marker per affinare la posizione.</div>
        </div>
      </div>
    `, { className: 'popup--selected', maxWidth: 380 }).openPopup();

    coordsEl.style.display = 'block';
    coordsEl.textContent =
      `Latitudine: ${selectedLatLng.lat.toFixed(6)} | Longitudine: ${selectedLatLng.lng.toFixed(6)} (selezionate)`;

    setTimeout(() => {
      const copyBtn = document.getElementById('copyCoordBtn');
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        const text = `${selectedLatLng.lat.toFixed(6)}, ${selectedLatLng.lng.toFixed(6)}`;
        try {
          await navigator.clipboard.writeText(text);
          showToast('Coordinate copiate negli appunti');
        } catch {
          try { prompt('Copia le coordinate', text); } catch {}
          showToast('Copia non disponibile automaticamente — copia manuale');
        }
      });
    }, 0);

    selectedMarker.on('drag', (ev) => {
      selectedLatLng = ev.latlng;
      coordsEl.textContent =
        `Latitudine: ${selectedLatLng.lat.toFixed(6)} | Longitudine: ${selectedLatLng.lng.toFixed(6)} (selezionate)`;
    });

    selectedMarker.on('popupclose', () => {});
  });

  // Replace existing addBtn behavior with modal form flow
  const reportModal = document.getElementById('reportModal');
  const reportForm = document.getElementById('reportForm');
  const reportClose = document.getElementById('reportClose');
  const reportCancel = document.getElementById('reportCancel');
  const copyCoordsInForm = document.getElementById('copyCoordsInForm');

  function openReportModal(prefill = {}) {
    if (!reportModal) return;
    // prefill form fields
    reportForm.name.value = prefill.name || '';
    reportForm.address.value = prefill.address || '';
    reportForm.phone.value = prefill.phone || '';
    reportForm.category.value = prefill.category || '';
    reportForm.description.value = prefill.description || '';

    // coordinates: prefer selectedLatLng, then provided prefill, then map center
    const coords = (window.__selectedLatLng && window.__selectedLatLng.lat)
      ? window.__selectedLatLng
      : (prefill.lat && prefill.lng ? { lat: prefill.lat, lng: prefill.lng } : map.getCenter());

    reportForm.lat.value = coords.lat.toFixed(6);
    reportForm.lng.value = coords.lng.toFixed(6);

    reportModal.setAttribute('aria-hidden', 'false');
    // focus first input
    reportForm.name.focus();
  }

  function closeReportModal() {
    if (!reportModal) return;
    reportModal.setAttribute('aria-hidden', 'true');
  }

  // wire open modal to the main add button
  const addBtnEl = document.getElementById('addBtn');
  if (addBtnEl) {
    addBtnEl.removeEventListener && addBtnEl.removeEventListener('click', () => {});
    addBtnEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      openReportModal();
    });
  }

  // close handlers
  if (reportClose) reportClose.addEventListener('click', closeReportModal);
  if (reportCancel) reportCancel.addEventListener('click', closeReportModal);
  // click backdrop to close
  document.querySelectorAll('.modal-backdrop').forEach(b => b.addEventListener('click', closeReportModal));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeReportModal(); });

  // make global reference for selectedLatLng used by modal prefill
  // we already update selectedLatLng in the click/drag handlers; expose it
  window.__selectedLatLng = window.__selectedLatLng || null;
  // ensure selectedLatLng updates are mirrored
  const originalMapClick = map._events && map._events.click ? null : null;
  // (selectedLatLng is updated earlier in this file when clicking map; keep that behavior)
  // copy coords in form to clipboard
  if (copyCoordsInForm) {
    copyCoordsInForm.addEventListener('click', async () => {
      const text = `${reportForm.lat.value}, ${reportForm.lng.value}`;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Coordinate copiate negli appunti');
      } catch {
        try { prompt('Copia le coordinate', text); } catch {}
        showToast('Copia non disponibile automaticamente — copia manuale');
      }
    });
  }

  // submit handler: build issue url and open GitHub issue page
  if (reportForm) {
    reportForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      // basic validation handled by required attributes; double-check
      const name = reportForm.name.value.trim();
      const address = reportForm.address.value.trim();
      const category = reportForm.category.value.trim();
      const phone = reportForm.phone.value.trim();
      const description = reportForm.description.value.trim();
      const lat = reportForm.lat.value.trim();
      const lng = reportForm.lng.value.trim();

      if (!name || !address || !category || !lat || !lng) {
        showToast('Compila i campi obbligatori (*)');
        return;
      }

      const title = `Nuovo centro: ${name}`;
      const body = [
        `**Nome del centro:** ${name}`,
        `**Indirizzo completo:** ${address}`,
        phone ? `**Telefono:** ${phone}` : '',
        `**Categoria:** ${category}`,
        description ? `**Descrizione:**\n${description}` : '',
        `**Coordinate:**\n- Latitudine: ${lat}\n- Longitudine: ${lng}`,
        '',
        '_Segnalo questo centro tramite la mappa — verrà revisionato dai manutentori prima della pubblicazione._'
      ].filter(Boolean).join('\n\n');

      const url = `https://github.com/micolsalomone/mutuo-aiuto-mappa/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank');
      showToast('Apro la issue per la segnalazione');
      closeReportModal();
    });
  }

  // Keep window.__selectedLatLng in sync with selectedMarker updates used elsewhere
  // Hook into the selectedMarker drag/listener in the existing code by setting on map click/drag
  // If your code defines selectedLatLng variable in outer scope, map click handlers already update it.
  // Mirror it to window.__selectedLatLng when present:
  const originalSetSelected = () => {};
  // simple periodic sync (lightweight): update global ref after interactions
  setInterval(() => {
    // if selectedLatLng exists in this file scope, assign to window variable
    if (typeof selectedLatLng !== 'undefined' && selectedLatLng) window.__selectedLatLng = selectedLatLng;
  }, 300);

  /* --- HOTLINE UI: dati, rendering e comportamenti --- */
  const HOTLINES = [
    {
      category: 'Assistenza generale',
      items: [
        { label: 'Servizi Sociali (Comune)', number: '800123456' },
        { label: 'Casa famiglia (segnalazione)', number: '800654321' }
      ]
    },
    {
      category: 'Violenza e minori',
      items: [
        { label: 'Telefono Viola (violenza domestica)', number: '1522' },
        { label: 'Telefono Azzurro (minori)', number: '114' }
      ]
    },
    {
      category: 'Immigrazione e supporto',
      items: [
        { label: 'Sportello immigrazione', number: '800987654' }
      ]
    },
    {
      category: 'App e servizi digitali',
      items: [
        { label: 'YouPol (segnalazioni)', number: 'YouPol (app)' }
      ]
    }
  ];

  const hotlineBtn = document.getElementById('hotlineBtn');
  const hotlinePanel = document.getElementById('hotlinePanel');
  const hotlineClose = document.getElementById('hotlineClose');
  const hotlineList = document.querySelector('.hotline-list');
  const hotlineCopyAll = document.getElementById('hotlineCopyAll');

  function renderHotlines() {
    hotlineList.innerHTML = '';
    HOTLINES.forEach(group => {
      const g = document.createElement('div');
      g.className = 'hotline-group';
      const h = document.createElement('div');
      h.className = 'hotline-group-title';
      h.textContent = group.category;
      g.appendChild(h);

      group.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'hotline-item';

        const info = document.createElement('div');
        info.className = 'hotline-info';
        const name = document.createElement('div');
        name.className = 'hotline-label';
        name.textContent = item.label;
        const num = document.createElement('div');
        num.className = 'hotline-number';
        num.textContent = item.number;
        info.appendChild(name);
        info.appendChild(num);

        const actions = document.createElement('div');
        actions.className = 'hotline-actions';

        if (/^[0-9+\s-()]+$/.test(String(item.number))) {
          const a = document.createElement('a');
          a.className = 'hotline-action-link';
          a.href = `tel:${item.number.replace(/\s+/g,'')}`;
          a.title = `Chiama ${item.number}`;
          a.textContent = 'Chiama';
          actions.appendChild(a);
        }

        const copy = document.createElement('button');
        copy.className = 'hotline-action-copy btn';
        copy.type = 'button';
        copy.dataset.number = item.number;
        copy.textContent = 'Copia';
        actions.appendChild(copy);

        row.appendChild(info);
        row.appendChild(actions);
        g.appendChild(row);
      });

      hotlineList.appendChild(g);
    });
  }

  function openHotline(open = true) {
    hotlinePanel.classList.toggle('open', open);
    hotlinePanel.setAttribute('aria-hidden', (!open).toString());
    hotlineBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (hotlineBtn) {
    hotlineBtn.addEventListener('click', () => {
      const isOpen = hotlinePanel.classList.contains('open');
      if (!isOpen) { renderHotlines(); }
      openHotline(!isOpen);
    });
  }

  if (hotlineClose) hotlineClose.addEventListener('click', () => openHotline(false));

  document.addEventListener('click', (ev) => {
    if (!hotlinePanel.classList.contains('open')) return;
    const inside = hotlinePanel.contains(ev.target) || hotlineBtn.contains(ev.target);
    if (!inside) openHotline(false);
  }, { capture: true });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') openHotline(false);
  });

  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.hotline-action-copy');
    if (btn) {
      const num = btn.dataset.number;
      try {
        await navigator.clipboard.writeText(num);
        showToast(`Numero copiato: ${num}`);
      } catch {
        try { prompt('Copia il numero', num); } catch {}
        showToast('Copia non disponibile automaticamente — copia manuale');
      }
    }
  });

  if (hotlineCopyAll) {
    hotlineCopyAll.addEventListener('click', async () => {
      const list = HOTLINES.flatMap(g => g.items.map(i => `${g.category} — ${i.label}: ${i.number}`)).join('\n');
      try {
        await navigator.clipboard.writeText(list);
        showToast('Tutti i numeri copiati negli appunti');
      } catch {
        try { prompt('Copia i numeri', list); } catch {}
        showToast('Copia non disponibile automaticamente — copia manuale');
      }
    });
  }

  // ensure panel starts hidden
  openHotline(false);
});