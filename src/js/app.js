// spostato da index.html <script> e reso DOM-safe
document.addEventListener('DOMContentLoaded', () => {
  // inizializza la mappa (solo una volta) — disabilita il controllo zoom di default
  const map = L.map('map', { zoomControl: false }).setView([41.9, 12.5], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // aggiungi controllo zoom in basso a destra (overlay)
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // ensure Leaflet recalculates size after layout settles (sidebar present)
  setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 200);

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

  // Caricamento GeoJSON -> creazione markers raggruppati per categoria
  loadGeoJSON('data/centri.geojson').then(geojson => {
    const categories = {};            // name => L.LayerGroup
    const allMarkers = [];            // lista di tutti i marker per bounds

    (geojson.features || []).forEach(f => {
      const p = f.properties || {};
      const coords = (f.geometry && f.geometry.coordinates) || [];
      if (!coords || coords.length < 2) return;

      const latlng = L.latLng(coords[1], coords[0]);
      const cat = (p.category || 'Altro').trim() || 'Altro';

      if (!categories[cat]) {
        categories[cat] = L.layerGroup();
      }

      const marker = createMarker(latlng, 'default');
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
      marker.bindPopup(html, { className: 'popup--feature', maxWidth: 360 });

      categories[cat].addLayer(marker);
      allMarkers.push(marker);
    });

    // Aggiungi tutte le categorie alla mappa (visibili di default)
    Object.values(categories).forEach(g => g.addTo(map));

    // force Leaflet to recompute sizes / render tiles & markers
    setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 150);

    // costruisci la sidebar categorie
    const categoryListEl = document.getElementById('categoryList');
    if (categoryListEl) {
      categoryListEl.innerHTML = '';
      Object.keys(categories).sort().forEach(cat => {
        const count = categories[cat].getLayers().length;
        const row = document.createElement('div');
        row.className = 'category-row';
        row.innerHTML = `
          <label>
            <input type="checkbox" data-cat="${cat}" checked>
            <span class="category-name">${cat}</span>
            <span class="category-count">(${count})</span>
          </label>
        `;
        categoryListEl.appendChild(row);
      });

      // toggle singola categoria
      categoryListEl.addEventListener('change', (ev) => {
        const cb = ev.target.closest('input[type="checkbox"]');
        if (!cb) return;
        const cat = cb.dataset.cat;
        const rowEl = cb.closest('.category-row');
        if (cb.checked) {
          map.addLayer(categories[cat]);
          rowEl && rowEl.classList.remove('inactive');
        } else {
          map.removeLayer(categories[cat]);
          rowEl && rowEl.classList.add('inactive');
        }
        // re-render map after toggling layers
        setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 80);
      });
    }

    // toggle tutto
    const toggleAllOn = document.getElementById('toggleAllOn');
    const toggleAllOff = document.getElementById('toggleAllOff');
    if (toggleAllOn) toggleAllOn.addEventListener('click', () => {
      categoryListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        map.addLayer(categories[cb.dataset.cat]);
        cb.closest('.category-row')?.classList.remove('inactive');
      });
      setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 80);
    });
    if (toggleAllOff) toggleAllOff.addEventListener('click', () => {
      categoryListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        map.removeLayer(categories[cb.dataset.cat]);
        cb.closest('.category-row')?.classList.add('inactive');
      });
      setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 80);
    });

    // adatta la vista ai marker caricati
    try {
      if (allMarkers.length) {
        const fg = L.featureGroup(allMarkers);
        map.fitBounds(fg.getBounds(), { padding: [24, 24] });
        // dopo fitBounds, forziamo invalidate per sicurezza
        setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 120);
      }
    } catch (e) { /* ignore */ }
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

  /* --- Helper panel (UI helper text) --- */
  const helpBtn = document.getElementById('helpBtn');
  const helperPanel = document.getElementById('helperPanel');
  const helperClose = document.getElementById('helperClose');

  function openHelper(open = true) {
    if (!helperPanel) return;
    helperPanel.setAttribute('aria-hidden', (!open).toString());
    // aria-hidden expects "false" when visible
    helperPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) helperPanel.querySelector('.helper-body')?.focus();
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = helperPanel && helperPanel.getAttribute('aria-hidden') === 'false';
      openHelper(!isOpen);
    });
  }
  if (helperClose) helperClose.addEventListener('click', () => openHelper(false));

  // close helper on outside click / Esc
  document.addEventListener('click', (ev) => {
    if (!helperPanel || helperPanel.getAttribute('aria-hidden') === 'true') return;
    const inside = helperPanel.contains(ev.target) || (helpBtn && helpBtn.contains(ev.target));
    if (!inside) openHelper(false);
  }, { capture: true });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') openHelper(false); });

  // ---- Bulk import handlers ----
  const bulkBtn = document.getElementById('bulkBtn');
  const bulkModal = document.getElementById('bulkModal');
  const bulkClose = document.getElementById('bulkClose');
  const bulkCancel = document.getElementById('bulkCancel');
  const bulkInput = document.getElementById('bulkInput');
  const bulkParse = document.getElementById('bulkParse');
  const bulkClear = document.getElementById('bulkClear');
  const bulkPreview = document.getElementById('bulkPreview');
  const bulkCount = document.getElementById('bulkCount');
  const bulkSubmit = document.getElementById('bulkSubmit');

  function openBulk(open = true) {
    if (!bulkModal) return;
    bulkModal.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) bulkInput.focus();
  }

  if (bulkBtn) bulkBtn.addEventListener('click', (e) => { e.preventDefault(); openBulk(true); });

  if (bulkClose) bulkClose.addEventListener('click', () => openBulk(false));
  if (bulkCancel) bulkCancel.addEventListener('click', () => openBulk(false));
  document.querySelectorAll('.modal-backdrop').forEach(b => b.addEventListener('click', () => openBulk(false)));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') openBulk(false); });

  // parse helper: accepts raw pasted text and returns array of objects
  function parseBulkText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = lines.map((line, idx) => {
      // prefer semicolon, then tab, then comma
      let parts;
      if (line.includes(';')) parts = line.split(';').map(p => p.trim());
      else if (line.includes('\t')) parts = line.split('\t').map(p => p.trim());
      else if (line.split(',').length >= 6) parts = line.split(',').map(p => p.trim());
      else {
        // fallback: try splitting by ' | ' or ' - '
        if (line.includes(' | ')) parts = line.split(' | ').map(p => p.trim());
        else parts = [line];
      }

      // map fields: name;address;phone;category;lat;lng;description(optional)
      const [name, address, phone, category, lat, lng, ...rest] = parts;
      const description = rest.length ? rest.join(' ; ') : '';
      const coordsValid = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
      return {
        raw: line,
        idx,
        name: name || '',
        address: address || '',
        phone: phone || '',
        category: category || '',
        lat: coordsValid ? parseFloat(lat) : null,
        lng: coordsValid ? parseFloat(lng) : null,
        description: description || '',
        valid: Boolean(name && address && category && (coordsValid || true)) // coords optional but encouraged
      };
    });
    return parsed;
  }

  function renderBulkPreview(list) {
    if (!bulkPreview) return;
    bulkPreview.innerHTML = '';
    list.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'bulk-row';
      const left = document.createElement('div');
      left.style.flex = '1';
      const title = document.createElement('div');
      title.className = 'bulk-title';
      title.textContent = item.name || `Riga ${i+1}`;

      const sub = document.createElement('div');
      sub.className = 'bulk-sub';
      const parts = [];
      if (item.address) parts.push(`Indirizzo: ${item.address}`);
      if (item.phone) parts.push(`Telefono: ${item.phone}`);
      if (item.category) parts.push(`Categoria: ${item.category}`);
      if (item.lat !== null && item.lng !== null) {
        parts.push(`Coordinate: ${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}`);
      }
      sub.textContent = parts.join(' · ');

      left.appendChild(title);
      left.appendChild(sub);
      row.appendChild(left);

      const actions = document.createElement('div');
      actions.className = 'bulk-actions';

      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn--add';
      addBtn.textContent = 'Aggiungi';
      addBtn.disabled = !item.valid;
      addBtn.addEventListener('click', () => {
        // onClick: crea il marker e popup, poi apre il report modal con i dati
        const marker = createMarker([item.lng, item.lat], 'user');
        marker.addTo(map);
        marker.bindPopup(`
          <div class="popup-card">
            <div class="popup-icon" aria-hidden="true">📌</div>
            <div class="popup-body">
              <div class="popup-title">Coordinate selezionate</div>
              <div class="popup-sub">Lat: ${item.lat.toFixed(6)} · Lng: ${item.lng.toFixed(6)}</div>
              <div class="popup-actions">
                <button id="copyCoordBtn" class="btn" style="background:#fff;color:var(--primary);box-shadow:none;border:1px solid rgba(2,6,23,0.06)">Copia</button>
              </div>
              <div class="popup-meta">Trascina il marker per affinare la posizione.</div>
            </div>
          </div>
        `, { className: 'popup--selected', maxWidth: 380 }).openPopup();

        // apri il modal report con i dati già compilati
        openReportModal({
          name: item.name,
          address: item.address,
          phone: item.phone,
          category: item.category,
          description: '', // vuoto per il bulk
          lat: item.lat,
          lng: item.lng
        });

        // copia coordinate negli appunti (conferma all'utente)
        setTimeout(() => {
          navigator.clipboard.writeText(`${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}`)
            .then(() => showToast('Coordinate copiate negli appunti'))
            .catch(() => {});
        }, 100);
      });
      actions.appendChild(addBtn);

      row.appendChild(actions);
      bulkPreview.appendChild(row);
    });

    // aggiorna conteggio righe nel bulk
    const count = list.filter(i => i.valid).length;
    bulkCount.textContent = `${count} ${count === 1 ? 'voce' : 'voci'} pronte per l\'importazione`;
  }

  // bulk parse handler: reads text input, parses, and shows preview
  if (bulkParse) {
    bulkParse.addEventListener('click', () => {
      const text = bulkInput.value.trim();
      if (!text) {
        showToast('Inserisci del testo da analizzare');
        return;
      }

      // parse e mostra anteprima
      const parsed = parseBulkText(text);
      renderBulkPreview(parsed);
    });
  }

  // clear button: svuota l'input e l'anteprima
  if (bulkClear) {
    bulkClear.addEventListener('click', () => {
      bulkInput.value = '';
      bulkPreview.innerHTML = '';
      bulkCount.textContent = '0 voci pronte per l\'importazione';
    });
  }

  // submit handler: aggiunge i marker in bulk
  if (bulkSubmit) {
    bulkSubmit.addEventListener('click', () => {
      const rows = Array.from(bulkPreview.querySelectorAll('.bulk-row'));
      const validItems = rows.map(r => {
        const item = {
          name: r.querySelector('.bulk-title').textContent.trim(),
          address: r.querySelector('.bulk-sub').textContent.trim().replace(/Telefono: .*/, '').trim(),
          phone: r.querySelector('.bulk-sub').textContent.trim().replace(/.*Telefono: /, '').trim(),
          category: '', // lascia vuoto per ora
          lat: null,
          lng: null,
          description: ''
        };

        // estrai lat/lng da title se presente
        const coordsMatch = r.querySelector('.bulk-title').textContent.trim().match(/Lat: ([0-9.-]+) · Lng: ([0-9.-]+)/);
        if (coordsMatch) {
          item.lat = parseFloat(coordsMatch[1]);
          item.lng = parseFloat(coordsMatch[2]);
        }

        return item;
      }).filter(i => i.lat !== null && i.lng !== null); // filtra solo quelli con coordinate valide

      if (validItems.length === 0) {
        showToast('Nessuna voce valida da importare');
        return;
      }

      // aggiungi ogni marker alla mappa
      validItems.forEach(item => {
        const marker = createMarker([item.lng, item.lat], 'user');
        marker.addTo(map);
      });

      // adatta la vista per mostrare tutti i nuovi marker
      const fg = L.featureGroup(validItems.map(i => createMarker([i.lng, i.lat], 'user')));
      map.fitBounds(fg.getBounds(), { padding: [24, 24] });

      // mostra toast di conferma
      showToast(`Aggiunti ${validItems.length} centri alla mappa`);
    });
  }
});