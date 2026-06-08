const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse');

const dataFilePath = path.join(__dirname, 'data.js');

const hydroUrl = "https://protezionecivile.regione.lazio.it/gestione-emergenze/centro-funzionale/bollettini/criticita-idrogeologica-idraulica";
const aibUrl = "https://protezionecivile.regione.lazio.it/gestione-emergenze/centro-funzionale/bollettini/rischi-incendi";

const hydroZones = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const aibZones = Array.from({ length: 14 }, (_, i) => String(i + 1));

async function fetchPdfText(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const dataBuffer = Buffer.from(response.data);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Errore nel download o parsing del PDF ${url}:`, error.message);
    return null;
  }
}

async function scrapePdfLink(pageUrl, dateStr) {
  try {
    const response = await axios.get(pageUrl);
    const $ = cheerio.load(response.data);
    
    const dateUnderscore = dateStr.replace(/-/g, '_');
    const dateNoDash = dateStr.replace(/-/g, '');
    const dateReverse = dateStr.split('-').reverse().join('');
    const dateReverseDash = dateStr.split('-').reverse().join('-');
    const dateReverseUnderscore = dateStr.split('-').reverse().join('_');

    let foundLink = null;

    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const lowerHref = href.toLowerCase();
      
      if (lowerHref.endsWith('.pdf')) {
        const fullLink = href.startsWith('http') ? href : `https://protezionecivile.regione.lazio.it${href}`;
        if (
          fullLink.includes(dateUnderscore) || 
          fullLink.includes(dateStr) || 
          fullLink.includes(dateNoDash) ||
          fullLink.includes(dateReverse) ||
          fullLink.includes(dateReverseDash) ||
          fullLink.includes(dateReverseUnderscore)
        ) {
          foundLink = fullLink;
          return false; // break out of cheerio loop
        }
      }
    });

    return foundLink;
  } catch (err) {
    console.error(`Errore nel caricamento della pagina ${pageUrl}:`, err.message);
    return null;
  }
}

function parseHydroText(text) {
  const hydroData = {};
  hydroZones.forEach(z => hydroData[z] = 'VERDE');

  if (!text) return hydroData;

  const hydroRegex = /ZONA\s+([A-G])\s*[:\-\s]+(?:.*?)(VERDE|GIALLA|ARANCIONE|ROSSA|GIALLO|ARANCIONE|ROSSO)/gi;
  let match;
  let matchesFound = false;

  while ((match = hydroRegex.exec(text)) !== null) {
    matchesFound = true;
    const zoneId = match[1].toUpperCase();
    let val = match[2].toUpperCase();
    if (val === 'GIALLO') val = 'GIALLA';
    if (val === 'ROSSO') val = 'ROSSA';
    if (hydroZones.includes(zoneId)) {
      hydroData[zoneId] = val;
    }
  }

  // Fallback regex se il formato è leggermente diverso (es. "Zona A - GIALLA")
  if (!matchesFound) {
    const lines = text.split('\n');
    lines.forEach(line => {
      const match = line.match(/ZONA\s+([A-G]).*?(VERDE|GIALLA|ARANCIONE|ROSSA|GIALLO|ARANCIONE|ROSSO)/i);
      if (match) {
        const zoneId = match[1].toUpperCase();
        let val = match[2].toUpperCase();
        if (val === 'GIALLO') val = 'GIALLA';
        if (val === 'ROSSO') val = 'ROSSA';
        if (hydroZones.includes(zoneId)) {
          hydroData[zoneId] = val;
        }
      }
    });
  }
  return hydroData;
}

function parseAibText(text) {
  const aibData = {};
  aibZones.forEach(z => aibData[z] = 'VERDE');
  
  if (!text) return aibData;

  // Analisi semplificata: cerca "SETTORE 1 ... MEDIO/GIALLA"
  // Valori possibili AIB di solito sono: BASSO, MEDIO, ALTO
  // O colori: VERDE, GIALLA, ROSSA
  // Proviamo a estrarre riga per riga
  const lines = text.split('\n');
  lines.forEach(line => {
    // Cerchiamo numeri da 1 a 14 vicini a parole chiave
    const match = line.match(/(\d{1,2})\s+.*?((?:BASSO|MEDIO|ALTO|VERDE|GIALLA|ROSSA|ROSSO|GIALLO|ARANCIONE))/i);
    if (match) {
      const zoneId = match[1];
      let valWord = match[2].toUpperCase();
      
      let finalVal = 'VERDE';
      if (valWord === 'MEDIO' || valWord === 'GIALLA' || valWord === 'GIALLO' || valWord === 'ARANCIONE') {
        finalVal = 'GIALLA';
      } else if (valWord === 'ALTO' || valWord === 'ROSSA' || valWord === 'ROSSO') {
        finalVal = 'ROSSA';
      }

      if (aibZones.includes(zoneId)) {
        aibData[zoneId] = finalVal;
      }
    }
  });

  return aibData;
}

async function runScraper() {
  console.log("Avvio scraper automatico GitHub Actions...");
  
  // Leggi data.js esistente se c'è
  let allData = {};
  if (fs.existsSync(dataFilePath)) {
    try {
      const raw = fs.readFileSync(dataFilePath, 'utf8');
      const jsonStr = raw.replace('// File generato automaticamente\nwindow.DATABASE = ', '').replace(/;\n$/, '');
      allData = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("data.js corrotto o non leggibile, ne creo uno nuovo.");
    }
  }

  // Calcola ultimi 7 giorni
  const datesToScrape = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    datesToScrape.push(`${dd}-${mm}-${yyyy}`);
  }

  for (const dateStr of datesToScrape) {
    console.log(`\n--- Elaborazione data: ${dateStr} ---`);
    
    // Inizializza oggetto per la data
    if (!allData[dateStr]) {
      allData[dateStr] = { hydro: {}, aib: {} };
    }
    
    // Scrape Hydro
    const hydroLink = await scrapePdfLink(hydroUrl, dateStr);
    if (hydroLink) {
      console.log(`[${dateStr}] Trovato link Hydro: ${hydroLink}`);
      const text = await fetchPdfText(hydroLink);
      allData[dateStr].hydro = parseHydroText(text);
    } else {
      console.log(`[${dateStr}] Nessun link Hydro trovato.`);
      if (Object.keys(allData[dateStr].hydro).length === 0) {
        hydroZones.forEach(z => allData[dateStr].hydro[z] = 'VERDE');
      }
    }

    // Scrape AIB
    const aibLink = await scrapePdfLink(aibUrl, dateStr);
    if (aibLink) {
      console.log(`[${dateStr}] Trovato link AIB: ${aibLink}`);
      const text = await fetchPdfText(aibLink);
      allData[dateStr].aib = parseAibText(text);
    } else {
      console.log(`[${dateStr}] Nessun link AIB trovato.`);
      if (Object.keys(allData[dateStr].aib).length === 0) {
        aibZones.forEach(z => allData[dateStr].aib[z] = 'VERDE');
      }
    }
  }

  // Pulizia vecchie date (opzionale, manteniamo solo le ultime 7)
  const sortedDates = Object.keys(allData).sort((a, b) => {
    // DD-MM-YYYY to YYYYMMDD for sorting
    const pA = a.split('-').reverse().join('');
    const pB = b.split('-').reverse().join('');
    return pB.localeCompare(pA); // Descending
  });

  const finalData = {};
  // Manteniamo fino a 14 giorni per storico di sicurezza
  sortedDates.slice(0, 14).forEach(d => finalData[d] = allData[d]);

  const jsContent = `// File generato automaticamente\nwindow.DATABASE = ${JSON.stringify(finalData, null, 2)};\n`;
  fs.writeFileSync(dataFilePath, jsContent);
  console.log("\nScraping completato e data.js aggiornato con successo.");
}

runScraper();
