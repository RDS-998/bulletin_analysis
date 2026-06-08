# Lazio Civil Protection Analyzer & Social Generator

Questo è un applicativo web interno progettato per semplificare e automatizzare il lavoro di analisi dei bollettini giornalieri della **Protezione Civile della Regione Lazio** (Criticità Idrogeologica/Idraulica e Rischio Incendi Boschivi AIB) e per generare istantaneamente sia il testo dei post social che le grafiche pronte per la pubblicazione (formato Post 1:1 e Instagram Story 9:16).

---

## 🌟 Caratteristiche

- **Scraping in tempo reale**: Recupera i PDF dei bollettini direttamente dai portali ufficiali della Regione Lazio.
- **Parsing Intelligente**: Estrae automaticamente i livelli di allerta per le zone meteo A-G e i livelli di pericolo per le zone AIB 1-14.
- **Cache dei PDF**: Memorizza localmente i documenti per evitare download duplicati e velocizzare le richieste successive.
- **Inserimento Manuale / Override**: Consente di modificare i livelli tramite un'interfaccia a griglia interattiva prima di generare l'output.
- **Generatore di Copia Social**: Crea un testo pronto da copiare, completo di emoji colorate coerenti con i livelli di allerta e contatti di emergenza.
- **Generatore di Grafiche su Canvas**: Disegna in tempo reale le grafiche ad alta risoluzione (1080x1080px e 1080x1920px) con layout moderni e scaricabili in PNG con un clic.

---

## 📂 Struttura del Progetto

```text
lazio-pc-analyzer/
├── index.js               # Entry point principale
├── server.js              # Server backend Express (Scraping, Download e Parsing PDF)
├── package.json           # Dipendenze Node.js (express, axios, pdf-parse)
├── pdf_cache/             # Cartella di cache dei bollettini PDF scaricati (generata all'avvio)
└── public/                # File statici del frontend
    ├── index.html         # Interfaccia grafica del pannello di controllo
    ├── style.css          # Design system premium in Dark Mode
    └── app.js             # Logica di rendering, overrides e disegno su Canvas
```

---

## 🚀 Requisiti e Installazione

Assicurati di avere [Node.js](https://nodejs.org/) installato sul tuo computer.

1. **Clona o scarica la cartella del progetto**:
   Carica i file sul tuo repository GitHub.
2. **Installa le dipendenze**:
   Posizionati nella cartella del progetto tramite terminale ed esegui:
   ```bash
   npm install
   ```

---

## 💻 Utilizzo Locale

1. **Avvia il server**:
   Nel terminale, esegui il comando:
   ```bash
   npm start
   ```
2. **Apri il browser**:
   Visita il sito all'indirizzo:
   `http://localhost:3000`
3. **Flusso di lavoro**:
   - Scegli la data dal menu a tendina o usane una personalizzata.
   - Il server scaricherà e analizzerà i bollettini.
   - Controlla i dati estratti nelle tabelle di modifica.
   - Clicca su **"Copia Testo"** per copiare la didascalia del post.
   - Clicca su **"Scarica 1:1"** o **"Scarica Storie"** per salvare le immagini PNG generate sul momento.

---

## ⚠️ Nota per la Pubblicazione su GitHub

Questo applicativo ha una componente di backend (Node.js/Express) per aggirare le restrizioni CORS dei siti regionali e analizzare i file PDF.
- Se lo carichi semplicemente su **GitHub Pages**, funzionerà solo la parte statica di frontend, ma non lo scraping o il parsing dei bollettini.
- Per ospitare l'applicazione interamente online, ti consigliamo di effettuare il deploy del repository su piattaforme che supportano Node.js come **Render**, **Railway**, **Heroku** o **Vercel** (configurando le API routes).
