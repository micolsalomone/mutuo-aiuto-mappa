# Mutuo Aiuto — Mappa dei Centri

Breve mappa web per segnalare e consultare centri di mutuo aiuto in Italia: case delle donne, centri antiviolenza, case del popolo, centri sociali, sportelli immigrazione, sportelli di ascolto ecc. L'interfaccia è basata su Leaflet + OpenStreetMap e permette di aprire una issue GitHub precompilata per proporre un nuovo centro.

## Caratteristiche
- Visualizzazione dei punti (GeoJSON) sulla mappa.
- Popup con nome, indirizzo, telefono e categoria.
- Pulsante "Proponi un centro" che apre una issue GitHub con coordinate precompilate.
- Fallback incorporato quando il fetch del file `data/centri.geojson` fallisce (utile in locale).

## Tecnologie
- HTML, CSS, JavaScript
- Leaflet (mappa)
- OpenStreetMap (tile)
- Google Font: Inter

## Struttura del repository
- `index.html` — app lato client.
- `data/centri.geojson` — file GeoJSON con le feature (punti).
- (eventuali) immagini / risorse statiche.

## Eseguire in locale (Windows)
Metodo rapido con Python (serve un server HTTP perché fetch non funziona con file://):
- Apri PowerShell o Prompt dei comandi nella cartella del progetto:
  - Python 3 installato: `py -3 -m http.server 8000`
  - oppure: `python -m http.server 8000`
- Apri il browser: `http://localhost:8000/`

In alternativa usa l'estensione Live Server di VSCode.

Nota: il progetto include un semplice fallback JSON quando il fetch fallisce, ma è consigliabile servire i file via HTTP per comportamento coerente.

## Formato dei dati (GeoJSON)
Aggiungi nuove feature in `data/centri.geojson` seguendo questo schema:

```json
{
  "type": "Feature",
  "properties": {
    "name": "Nome del centro",
    "indirizzo": "Via ... , CAP Città",
    "phone": "0123 456789",
    "category": "Categoria (es: CAV, Casa delle Donne, Centro Sociale)",
    "description": "Breve descrizione (opzionale)"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [12.345678, 41.123456]
  }
}
```

Assicurati che `data/centri.geojson` sia un oggetto FeatureCollection valido.

## Come contribuire
- Rapida segnalazione: clicca "Proponi un centro" sulla mappa — apre una issue GitHub precompilata con le coordinate del centro visualizzato.
- Aggiunta diretta ai dati: apri una Pull Request aggiungendo la feature GeoJSON in `data/centri.geojson`.
- Segnala problemi o richieste di miglioramento tramite Issues.

## Note sulla privacy
I numeri di telefono e gli indirizzi pubblicati dovrebbero essere informazioni già pubbliche o condivise con consenso. Evitare di inserire dati sensibili.

## Licenza
- Codice: MIT
- Dati: suggerito CC BY 4.0 (o altra licenza aperta a scelta dei manutentori)