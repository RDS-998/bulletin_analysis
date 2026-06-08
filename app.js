// State & Config
const hydroZones = [
  { id: 'A', name: 'Bacini Costieri Nord' },
  { id: 'B', name: 'Bacino Medio Tevere' },
  { id: 'C', name: 'Appennino di Rieti' },
  { id: 'D', name: 'Bacini Roma' },
  { id: 'E', name: 'Aniene' },
  { id: 'F', name: 'Bacini Costieri Sud' },
  { id: 'G', name: 'Bacino del Liri' }
];

const aibZoneNames = [
  'Litorale Nord', 'Viterbese Ovest', 'Viterbese Est', 'Sabina',
  'Reatino', 'Roma Capitale', 'Appennino Reatino', 'Litorale Sud',
  'Castelli Romani', 'Appennino Romano', 'Monti Lepini', 'Pontino Sud',
  'Frusinate Sud', 'Frusinate Nord'
];

const aibZones = Array.from({ length: 14 }, (_, i) => ({
  id: String(i + 1),
  name: aibZoneNames[i]
}));

let currentData = {
  date: '',
  hydro: {},
  aib: {}
};

// DOM Elements
const selectDate = document.getElementById('select-bulletin-date');
const loadingOverlay = document.getElementById('loading-overlay');
const hydroZonesContainer = document.getElementById('hydro-zones');
const aibZonesContainer = document.getElementById('aib-zones');
const textPost = document.getElementById('social-post-text');
const canvas1x1 = document.getElementById('canvas-1x1');
const canvas9x16 = document.getElementById('canvas-9x16');

let database = {}; // Contiene i dati di data.js

async function initApp() {
  loadingOverlay.classList.remove('hidden');
  try {
    if (typeof window.DATABASE === 'undefined') {
      throw new Error("data.js non è stato caricato correttamente");
    }
    database = window.DATABASE;
    
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}-${mm}-${yyyy}`;
    
    currentData.date = todayStr;
    selectDate.value = `${yyyy}-${mm}-${dd}`;

    loadDateData(todayStr);
  } catch (err) {
    console.error("Errore nel caricamento del database:", err);
    alert("Impossibile caricare il database dei bollettini. Assicurati che data.js sia stato generato.");
  } finally {
    loadingOverlay.classList.add('hidden');
  }
}

function loadDateData(dateStr) {
  currentData.date = dateStr;
  const dayData = database[dateStr];
  
  if (dayData) {
    hydroZones.forEach(z => currentData.hydro[z.id] = dayData.hydro[z.id] || 'VERDE');
    aibZones.forEach(z => currentData.aib[z.id] = dayData.aib[z.id] || 'VERDE');
    document.getElementById('update-status').textContent = `Dati caricati per il ${dateStr}`;
  } else {
    // Se non ci sono dati, resetta a verde
    hydroZones.forEach(z => currentData.hydro[z.id] = 'VERDE');
    aibZones.forEach(z => currentData.aib[z.id] = 'VERDE');
    document.getElementById('update-status').textContent = `Nessun dato per il ${dateStr}. Colori resettati.`;
  }
  
  renderUI();
}

// UI Generators
function renderUI() {
  hydroZonesContainer.innerHTML = '';
  hydroZones.forEach(z => {
    const item = document.createElement('div');
    item.className = 'zone-item';
    const val = currentData.hydro[z.id];
    item.innerHTML = `
      <span class="zone-name">${z.id} - ${z.name}</span>
      <select class="zone-select ${val}" data-type="hydro" data-id="${z.id}">
        <option value="VERDE" ${val==='VERDE'?'selected':''}>VERDE</option>
        <option value="GIALLA" ${val==='GIALLA'?'selected':''}>GIALLA</option>
        <option value="ARANCIONE" ${val==='ARANCIONE'?'selected':''}>ARANCIONE</option>
        <option value="ROSSA" ${val==='ROSSA'?'selected':''}>ROSSA</option>
      </select>
    `;
    hydroZonesContainer.appendChild(item);
  });

  aibZonesContainer.innerHTML = '';
  aibZones.forEach(z => {
    const item = document.createElement('div');
    item.className = 'zone-item';
    const val = currentData.aib[z.id];
    item.innerHTML = `
      <span class="zone-name">Sett. ${z.id} - ${z.name}</span>
      <select class="zone-select ${val}" data-type="aib" data-id="${z.id}">
        <option value="VERDE" ${val==='VERDE'?'selected':''}>BASSO (VERDE)</option>
        <option value="GIALLA" ${val==='GIALLA'?'selected':''}>MEDIO (GIALLA)</option>
        <option value="ROSSA" ${val==='ROSSA'?'selected':''}>ALTO/ESTREMO</option>
      </select>
    `;
    aibZonesContainer.appendChild(item);
  });

  updateAll();
}

function updateAll() {
  generateText();
  drawCanvas(canvas1x1, 1080, 1080);
  drawCanvas(canvas9x16, 1080, 1920);
}

document.addEventListener('change', (e) => {
  if(e.target.classList.contains('zone-select')) {
    const type = e.target.getAttribute('data-type');
    const id = e.target.getAttribute('data-id');
    const val = e.target.value;
    
    currentData[type][id] = val;
    e.target.className = `zone-select ${val}`;
    updateAll();
  }
  
  if(e.target.id === 'chk-hashtags' || e.target.id === 'chk-contacts') {
    generateText();
  }
});

function generateText() {
  const hashtags = document.getElementById('chk-hashtags').checked;
  const contacts = document.getElementById('chk-contacts').checked;
  
  let maxHydro = 'VERDE';
  for(const k in currentData.hydro) {
    const val = currentData.hydro[k];
    if(val === 'ROSSA') maxHydro = 'ROSSA';
    else if(val === 'ARANCIONE' && maxHydro !== 'ROSSA') maxHydro = 'ARANCIONE';
    else if(val === 'GIALLA' && maxHydro === 'VERDE') maxHydro = 'GIALLA';
  }

  let text = `⚠️ AGGIORNAMENTO PROTEZIONE CIVILE LAZIO ⚠️\n📅 Data: ${currentData.date}\n\n`;
  
  const hydroIcon = maxHydro === 'VERDE' ? '🟢' : maxHydro === 'GIALLA' ? '🟡' : maxHydro === 'ARANCIONE' ? '🟠' : '🔴';
  text += `🌧️ CRITICITÀ IDROGEOLOGICA E IDRAULICA\nLivello massimo regionale: ${hydroIcon} ${maxHydro}\n`;
  
  if (maxHydro === 'ROSSA') {
    text += `❗ MESSAGGIO DI PROTEZIONE CIVILE: Previsti fenomeni estremi. Si raccomanda di evitare spostamenti non necessari, non sostare in prossimità di corsi d'acqua o ponti e seguire le indicazioni delle autorità locali.\n\n`;
  } else if (maxHydro === 'ARANCIONE') {
    text += `❗ MESSAGGIO DI PROTEZIONE CIVILE: Possibili fenomeni intensi e diffusi. Prestare massima attenzione alla guida e in prossimità di zone a rischio allagamento.\n\n`;
  } else if (maxHydro === 'GIALLA') {
    text += `❗ MESSAGGIO DI PROTEZIONE CIVILE: Previsti fenomeni localizzati. Si raccomanda prudenza durante gli spostamenti e le attività all'aperto.\n\n`;
  } else {
    text += `✅ MESSAGGIO DI PROTEZIONE CIVILE: Assenza di criticità significative. Si raccomanda la normale prudenza.\n\n`;
  }

  hydroZones.forEach(z => {
    const v = currentData.hydro[z.id];
    const ic = v === 'VERDE' ? '🟢' : v === 'GIALLA' ? '🟡' : v === 'ARANCIONE' ? '🟠' : '🔴';
    text += `🔹 Zona ${z.id} (${z.name}): ${ic} ${v}\n`;
  });
  text += '\n';

  text += `🔥 PERICOLOSITÀ INCENDI BOSCHIVI (AIB)\n`;
  aibZones.forEach(z => {
    const val = currentData.aib[z.id];
    let word = 'Bassa';
    let ic = '🟢';
    if(val === 'GIALLA') { word = 'Media'; ic = '🟡'; }
    if(val === 'ROSSA') { word = 'Alta/Estrema'; ic = '🔴'; }
    text += `🔸 Settore ${z.id} (${z.name}): ${ic} ${word}\n`;
  });

  if(contacts) {
    text += `\n📞 Numero Unico Emergenze: 112\n🏢 Sala Operativa Regionale: 803555\n📱 App IO per gli avvisi locali\n`;
  }
  
  if(hashtags) {
    text += `\n#ProtezioneCivile #RegioneLazio #AllertaMeteo #AntincendioBoschivo #Sicurezza`;
  }

  textPost.value = text;
}

// Canvas Drawing Engine
function drawCanvas(canvas, w, h) {
  const ctx = canvas.getContext('2d');
  
  // Background Base
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, w, h);

  // Top Header Banner
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(40, 40, w - 80, 160, 20);
  ctx.fill();

  // Title Text in Banner
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BOLLETTINO CRITICITÀ REGIONALE', w/2, 110);
  
  ctx.font = '30px "Outfit", sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`Aggiornamento del: ${currentData.date}`, w/2, 160);

  // Determine Max Alert level color for main header stripe
  let maxHydro = 'VERDE';
  for(const k in currentData.hydro) {
    const val = currentData.hydro[k];
    if(val === 'ROSSA') maxHydro = 'ROSSA';
    else if(val === 'ARANCIONE' && maxHydro !== 'ROSSA') maxHydro = 'ARANCIONE';
    else if(val === 'GIALLA' && maxHydro === 'VERDE') maxHydro = 'GIALLA';
  }

  const colorMap = {
    'VERDE': '#22c55e',
    'GIALLA': '#eab308',
    'ARANCIONE': '#f97316',
    'ROSSA': '#ef4444'
  };

  // Hydro Section Box
  const startY = 240;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(40, startY, w - 80, h === 1080 ? 350 : 600, 20);
  ctx.fill();
  ctx.shadowBlur = 0; // reset shadow
  
  ctx.strokeStyle = colorMap[maxHydro];
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🌧️ Rischio Idrogeologico', 80, startY + 60);

  // Draw Hydro Zones
  const zX = 80;
  let zY = startY + 120;
  ctx.font = '28px "Outfit", sans-serif';
  
  hydroZones.forEach((z, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const xPos = zX + (col * ((w - 200) / 2));
    const yPos = zY + (row * 60);

    const val = currentData.hydro[z.id] || 'VERDE';
    ctx.fillStyle = colorMap[val];
    ctx.beginPath();
    ctx.roundRect(xPos, yPos - 30, 40, 40, 8);
    ctx.fill();

    ctx.fillStyle = val === 'GIALLA' ? '#000000' : '#ffffff';
    ctx.font = 'bold 24px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${z.id}`, xPos + 20, yPos - 1);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = '24px "Outfit", sans-serif';
    ctx.fillText(`${z.name}`, xPos + 55, yPos - 2);
  });

  // AIB Section Box
  const aibY = h === 1080 ? 630 : 880;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(40, aibY, w - 80, h === 1080 ? 350 : 700, 20);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🔥 Pericolosità Incendi Boschivi', 80, aibY + 60);

  // Draw AIB Zones
  let aibZy = aibY + 120;
  aibZones.forEach((z, idx) => {
    // 4 columns if 1x1, 2 columns if 9x16
    const cols = h === 1080 ? 4 : 2;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const xPos = zX + (col * ((w - 200) / cols));
    const yPos = aibZy + (row * 60);

    const val = currentData.aib[z.id] || 'VERDE';
    ctx.fillStyle = colorMap[val];
    ctx.beginPath();
    ctx.roundRect(xPos, yPos - 30, 80, 40, 8);
    ctx.fill();

    ctx.fillStyle = val === 'GIALLA' ? '#000000' : '#ffffff';
    ctx.font = 'bold 22px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Sett. ${z.id}`, xPos + 40, yPos - 3);
  });

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '24px "Outfit", sans-serif';
  ctx.fillText('Generato automaticamente - Per dettagli ufficiali consultare il sito della Regione Lazio', w/2, h - 30);
}

selectDate.addEventListener('change', () => {
  const rawDate = selectDate.value; // YYYY-MM-DD
  if(rawDate) {
    const [yyyy, mm, dd] = rawDate.split('-');
    loadDateData(`${dd}-${mm}-${yyyy}`);
  }
});

document.getElementById('btn-download-1x1').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `PC_Lazio_1x1_${currentData.date}.png`;
  link.href = canvas1x1.toDataURL('image/png');
  link.click();
});

document.getElementById('btn-download-9x16').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `PC_Lazio_9x16_${currentData.date}.png`;
  link.href = canvas9x16.toDataURL('image/png');
  link.click();
});

document.getElementById('btn-copy').addEventListener('click', () => {
  textPost.select();
  document.execCommand('copy');
  alert("Testo copiato!");
});

// Initial Render
renderUI();
