const fs = require('fs');
const text = fs.readFileSync('hydro_test_10.txt', 'utf8');

function parseHydroTextMultipleDays(text) {
  const daysData = {};
  if (!text) return daysData;

  const lines = text.split('\n');
  let currentDate = null;

  const severityMap = {
    'VERDE': 0, 'GIALLA': 1, 'GIALLO': 1, 'ARANCIONE': 2, 'ROSSA': 3, 'ROSSO': 3
  };
  const severityToColor = ['VERDE', 'GIALLA', 'ARANCIONE', 'ROSSA'];
  const hydroZones = ['A','B','C','D','E','F','G'];

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

  return daysData;
}
console.log(JSON.stringify(parseHydroTextMultipleDays(text), null, 2));
