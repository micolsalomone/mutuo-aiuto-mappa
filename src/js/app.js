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

  // Pulsante per proporre un nuovo centro (usa coordinate selezionate se presenti)
  const addBtn = document.getElementById('addBtn');
  if (addBtn) {
    addBtn.addEventListener('click', e => {
      e.preventDefault();
      const c = selectedLatLng || map.getCenter();

      const title = encodeURIComponent('Proposta: nuovo centro di mutuo aiuto');
      const lat = c.lat.toFixed(6);
      const lng = c.lng.toFixed(6);

      const body = encodeURIComponent(`
**Nome del centro:** 

**Indirizzo completo:** 

**Numero di telefono (visibile solo agli admin):**

**Categoria:** 

**Descrizione / Attività principali:** 

**Coordinate:**  
- Latitudine: ${lat}  
- Longitudine: ${lng}  
_(usa queste coordinate per localizzare il centro sulla mappa)_

---

_Se non sai come ottenerle, lascia pure i valori precompilati: rappresentano il punto che stai guardando ora al centro della mappa._
`);
      const issueUrl = `https://github.com/micolsalomone/mutuo-aiuto-mappa/issues/new?title=${title}&body=${body}`;
      window.open(issueUrl, '_blank');
    });
  }

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