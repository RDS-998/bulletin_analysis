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
    
    const dateSlash = dateStr.replace(/-/g, '/');
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
        const textContent = $(el).text();
        
        if (
          textContent.includes(dateSlash) ||
          textContent.includes(dateStr) ||
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

function parseHydroTextMultipleDays(text) {
  const daysData = {};
  if (!text) return daysData;

  const lines = text.split('\n');
  let currentDate = null;

  const severityMap = {
    'VERDE': 0, 'GIALLA': 1, 'GIALLO': 1, 'ARANCIONE': 2, 'ROSSA': 3, 'ROSSO': 3
  };
  const severityToColor = ['VERDE', 'GIALLA', 'ARANCIONE', 'ROSSA'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const dateMatch = line.match(/(?:OGGI|DOMANI|DOPODOMANI).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
    if (dateMatch) {
      let dStr = dateMatch[1].replace(/\//g, '-');
      let [d, m, y] = dStr.split('-');
      d = d.padStart(2, '0');
      m = m.padStart(2, '0');
      currentDate = `${d}-${m}-${y}`;
      if (!daysData[currentDate]) {
        daysData[currentDate] = {};
        hydroZones.forEach(z => daysData[currentDate][z] = 'VERDE');
      }
      continue;
    }

    if (currentDate) {
      const match = line.match(/^([A-G])\s*(VERDE|GIALLA|GIALLO|ARANCIONE|ROSSA|ROSSO)\s*(VERDE|GIALLA|GIALLO|ARANCIONE|ROSSA|ROSSO)\s*(VERDE|GIALLA|GIALLO|ARANCIONE|ROSSA|ROSSO)/i);
      if (match) {
        const zoneId = match[1].toUpperCase();
        const v1 = severityMap[match[2].toUpperCase()] || 0;
        const v2 = severityMap[match[3].toUpperCase()] || 0;
        const v3 = severityMap[match[4].toUpperCase()] || 0;
        const maxSeverity = Math.max(v1, v2, v3);
        
        if (hydroZones.includes(zoneId)) {
          const currentSeverity = severityMap[daysData[currentDate][zoneId]] || 0;
          const finalSeverity = Math.max(currentSeverity, maxSeverity);
          daysData[currentDate][zoneId] = severityToColor[finalSeverity];
        }
      }
    }
  }

  // Se non troviamo giorni validi
  if (Object.keys(daysData).length === 0) {
    return null;
  }

  return daysData;
}

function parseAibTextMultipleDays(text) {
  const daysData = {};
  
  if (!text) return daysData;

  const lines = text.split('\n');
  let currentDate = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const dateMatch = line.match(/Previsioni per .*?\s+(\d{1,2}-\d{1,2}-\d{4})/i);
    if (dateMatch) {
      let [d, m, y] = dateMatch[1].split('-');
      d = d.padStart(2, '0');
      m = m.padStart(2, '0');
      currentDate = `${d}-${m}-${y}`;
      if (!daysData[currentDate]) {
        daysData[currentDate] = {};
        aibZones.forEach(z => daysData[currentDate][z] = 'VERDE');
      }
      continue;
    }
    
    if (currentDate && line.startsWith('Pericolosità')) {
      const valLine = lines[i+1] ? lines[i+1].trim() : '';
      if (valLine) {
        const matches = valLine.match(/(BASSO|MEDIO|ALTO|MODERATO|ELEVATO)/gi);
        if (matches && matches.length === 14) {
          matches.forEach((val, idx) => {
            const zoneId = String(idx + 1);
            const valWord = val.toUpperCase();
            let finalVal = 'VERDE';
            if (valWord === 'MEDIO' || valWord === 'MODERATO') {
              finalVal = 'GIALLA';
            } else if (valWord === 'ALTO' || valWord === 'ELEVATO') {
              finalVal = 'ROSSA';
            }
            daysData[currentDate][zoneId] = finalVal;
          });
        }
      }
    }
  }

  return daysData;
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

  // Calcola ultimi 7 giorni (dal più vecchio al più recente)
  const datesToScrape = [];
  for (let i = 6; i >= 0; i--) {
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
      const hydroDaysData = parseHydroTextMultipleDays(text);
      
      if (hydroDaysData && Object.keys(hydroDaysData).length > 0) {
        for (const [dayDate, dayData] of Object.entries(hydroDaysData)) {
          if (!allData[dayDate]) {
            allData[dayDate] = { hydro: {}, aib: {} };
          }
          allData[dayDate].hydro = dayData;
        }
      } else {
        console.log(`[${dateStr}] Nessun dato estratto da Hydro.`);
        if (Object.keys(allData[dateStr].hydro).length === 0) {
          hydroZones.forEach(z => allData[dateStr].hydro[z] = 'VERDE');
        }
      }
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
      const aibDaysData = parseAibTextMultipleDays(text);
      
      if (Object.keys(aibDaysData).length > 0) {
        for (const [dayDate, dayData] of Object.entries(aibDaysData)) {
          if (!allData[dayDate]) {
            allData[dayDate] = { hydro: {}, aib: {} };
          }
          allData[dayDate].aib = dayData;
        }
      } else {
        console.log(`[${dateStr}] Nessun dato estratto da AIB.`);
        if (Object.keys(allData[dateStr].aib).length === 0) {
          aibZones.forEach(z => allData[dateStr].aib[z] = 'VERDE');
        }
      }
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
