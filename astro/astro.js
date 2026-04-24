// Astro-AI — Evolutionary Astrology Report Generator
// Uses CircularNatalHoroscopeJS for ephemeris + LM Studio for report generation

const ZODIAC_SIGNS = {
  Aries: { pl: 'Baran', symbol: '\u2648', element: 'Ogień' },
  Taurus: { pl: 'Byk', symbol: '\u2649', element: 'Ziemia' },
  Gemini: { pl: 'Bliźnięta', symbol: '\u264A', element: 'Powietrze' },
  Cancer: { pl: 'Rak', symbol: '\u264B', element: 'Woda' },
  Leo: { pl: 'Lew', symbol: '\u264C', element: 'Ogień' },
  Virgo: { pl: 'Panna', symbol: '\u264D', element: 'Ziemia' },
  Libra: { pl: 'Waga', symbol: '\u264E', element: 'Powietrze' },
  Scorpio: { pl: 'Skorpion', symbol: '\u264F', element: 'Woda' },
  Sagittarius: { pl: 'Strzelec', symbol: '\u2650', element: 'Ogień' },
  Capricorn: { pl: 'Koziorożec', symbol: '\u2651', element: 'Ziemia' },
  Aquarius: { pl: 'Wodnik', symbol: '\u2652', element: 'Powietrze' },
  Pisces: { pl: 'Ryby', symbol: '\u2653', element: 'Woda' }
};

const PLANET_SYMBOLS = {
  sun: '\u2609', moon: '\u263D', mercury: '\u263F', venus: '\u2640',
  mars: '\u2642', jupiter: '\u2643', saturn: '\u2644', uranus: '\u2645',
  neptune: '\u2646', pluto: '\u2647', northnode: '\u260A', southnode: '\u260B',
  ascendant: 'Asc', midheaven: 'MC'
};

const PLANET_NAMES_PL = {
  sun: 'Słońce', moon: 'Księżyc', mercury: 'Merkury', venus: 'Wenus',
  mars: 'Mars', jupiter: 'Jowisz', saturn: 'Saturn', uranus: 'Uran',
  neptune: 'Neptun', pluto: 'Pluton', northnode: 'Węzeł Pn.', southnode: 'Węzeł Pd.',
  ascendant: 'Ascendent', midheaven: 'Medium Coeli'
};

function signToPl(signKey) {
  if (!signKey) return '?';
  const entry = ZODIAC_SIGNS[signKey];
  return entry ? entry.pl : signKey;
}

function signSymbol(signKey) {
  if (!signKey) return '';
  const entry = ZODIAC_SIGNS[signKey];
  return entry ? entry.symbol : '';
}

function formatDegree(deg) {
  if (deg == null) return '';
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return d + '\u00B0' + (m < 10 ? '0' : '') + m + "'";
}

// Geocoding via Nominatim (free, no API key)
async function geocodeCity(city) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(city) + '&limit=1';
  const resp = await fetch(url, { headers: { 'Accept-Language': 'pl' } });
  const data = await resp.json();
  if (data.length === 0) throw new Error('Nie znaleziono miejscowości: ' + city);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// Calculate horoscope using CircularNatalHoroscopeJS
function calculateHoroscope(birthDate, birthTime, lat, lng) {
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);

  const origin = new Origin({
    year: year,
    month: month - 1, // 0-indexed
    date: day,
    hour: hour,
    minute: minute,
    latitude: lat,
    longitude: lng
  });

  const horoscope = new Horoscope({
    origin: origin,
    houseSystem: 'placidus',
    zodiac: 'tropical',
    aspectPoints: ['bodies', 'points', 'angles'],
    aspectWithPoints: ['bodies', 'points', 'angles'],
    aspectTypes: ['major'],
    language: 'en'
  });

  return horoscope;
}

function extractChartData(horoscope) {
  const data = {};

  // Planets
  const bodies = horoscope.CelestialBodies.all || [];
  for (const body of bodies) {
    const key = body.key || body.label?.toLowerCase();
    if (key && PLANET_NAMES_PL[key]) {
      data[key] = {
        sign: body.Sign?.key || body.sign?.key || null,
        degree: body.ChartPosition?.Ecliptic?.DecimalDegrees ?? null,
        house: body.House?.id ?? null
      };
    }
  }

  // Points (nodes)
  const points = horoscope.CelestialPoints?.all || [];
  for (const pt of points) {
    const key = pt.key || pt.label?.toLowerCase();
    if (key && PLANET_NAMES_PL[key]) {
      data[key] = {
        sign: pt.Sign?.key || pt.sign?.key || null,
        degree: pt.ChartPosition?.Ecliptic?.DecimalDegrees ?? null,
        house: pt.House?.id ?? null
      };
    }
  }

  // Angles
  if (horoscope.Ascendant) {
    data.ascendant = {
      sign: horoscope.Ascendant.Sign?.key || null,
      degree: horoscope.Ascendant.ChartPosition?.Ecliptic?.DecimalDegrees ?? null,
      house: 1
    };
  }
  if (horoscope.Midheaven) {
    data.midheaven = {
      sign: horoscope.Midheaven.Sign?.key || null,
      degree: horoscope.Midheaven.ChartPosition?.Ecliptic?.DecimalDegrees ?? null,
      house: 10
    };
  }

  // Houses
  data._houses = [];
  if (horoscope.Houses) {
    for (const h of horoscope.Houses) {
      data._houses.push({
        id: h.id,
        sign: h.Sign?.key || null,
        degree: h.ChartPosition?.StartPosition?.Ecliptic?.DecimalDegrees ?? null
      });
    }
  }

  return data;
}

function renderCosmogram(chartData, patientName, birthInfo) {
  const container = document.getElementById('cosmogram-data');
  const patientLabel = document.getElementById('cosmogram-patient');
  patientLabel.textContent = patientName + ' — ur. ' + birthInfo;

  let html = '';
  const order = ['sun', 'moon', 'ascendant', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northnode', 'southnode', 'midheaven'];

  for (const key of order) {
    const d = chartData[key];
    if (!d || !d.sign) continue;
    const sym = PLANET_SYMBOLS[key] || '';
    const name = PLANET_NAMES_PL[key] || key;
    const signPl = signToPl(d.sign);
    const signSym = signSymbol(d.sign);
    const deg = formatDegree(d.degree);
    const house = d.house ? 'dom ' + d.house : '';

    html += '<div class="cosmo-item">' +
      '<div class="cosmo-symbol">' + sym + '</div>' +
      '<div class="cosmo-info">' +
        '<div class="cosmo-label">' + name + '</div>' +
        '<div class="cosmo-value">' + signSym + ' ' + signPl + (deg ? ' <small>' + deg + '</small>' : '') + (house ? ' <small>(' + house + ')</small>' : '') + '</div>' +
      '</div>' +
    '</div>';
  }

  container.innerHTML = html;
}

function buildCosmogramText(chartData) {
  let text = '';
  const order = ['sun', 'moon', 'ascendant', 'midheaven', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northnode', 'southnode'];

  for (const key of order) {
    const d = chartData[key];
    if (!d || !d.sign) continue;
    const name = PLANET_NAMES_PL[key];
    const signPl = signToPl(d.sign);
    const house = d.house ? ', dom ' + d.house : '';
    text += name + ': ' + signPl + house + '\n';
  }
  return text;
}

function buildSystemPrompt() {
  return `Jesteś ekspertem astrologii ewolucyjnej w tradycji Stephena Forresta. Tworzysz terapeutyczne raporty astrologiczne dla pacjentów gabinetu osteopatycznego dr hab. Sebastiana Rutkowskiego.

ZASADY ASTROLOGII EWOLUCYJNEJ (Stephen Forrest):
- Karta urodzeniowa to mapa potencjału duszy, NIE wyroku losu
- Słońce = ścieżka twórczej samorealizacji, cel obecnego wcielenia
- Księżyc = potrzeby emocjonalne, wzorce regeneracji, co odżywia duszę
- Ascendent = maska, styl bycia w świecie, pierwszy impuls do działania
- Węzeł Południowy Księżyca = przeszłość karmiczna, nawyki i talenty przyniesione, ale też pułapki powtarzania
- Węzeł Północny Księżyca = kierunek rozwoju, lekcja do opanowania w tym życiu, droga ewolucji
- Pluton = głęboka transformacja, miejsce gdzie dusza musi zmierzyć się z cieniem
- Saturn = dyscyplina, dojrzewanie, karmiczny nauczyciel
- Domy wskazują OBSZAR ŻYCIA, w którym dana energia się przejawia

STYL RAPORTU:
- Pisz po polsku, ciepłym, wspierającym tonem
- Unikaj fatalizmu i negatywnych przepowiedni
- Każdą pozycję interpretuj jako potencjał i zaproszenie do rozwoju
- Używaj metafor i obrazowego języka (styl Forresta)
- Raport ma być praktyczny — dawaj konkretne wskazówki
- Jeśli podano notatki z terapii, powiąż je z kartą astrologiczną (np. napięcie w przeponie → Księżyc w znaku, który tłumi emocje)

STRUKTURA RAPORTU:
1. Słońce — ścieżka życiowa i tożsamość
2. Księżyc — regeneracja i potrzeby emocjonalne
3. Ascendent — jak pacjent wchodzi w świat
4. Węzły Księżycowe — skąd przychodzi dusza i dokąd zmierza
5. Pluton — głęboka transformacja
6. Podsumowanie i zalecenia terapeutyczne

Każda sekcja: 2-4 akapity. Całość: 800-1200 słów.`;
}

function buildUserPrompt(patientName, birthInfo, cosmogramText, therapyNotes) {
  let prompt = 'Pacjent: ' + patientName + '\nData i miejsce urodzenia: ' + birthInfo + '\n\nKOSMOGRAM:\n' + cosmogramText;
  if (therapyNotes) {
    prompt += '\n\nNOTATKI Z TERAPII:\n' + therapyNotes;
  }
  prompt += '\n\nWygeneruj raport z astrologii ewolucyjnej dla tego pacjenta. Użyj nagłówków ### dla każdej sekcji.';
  return prompt;
}

async function generateReport(systemPrompt, userPrompt) {
  const provider = document.getElementById('llm-provider').value;

  if (provider === 'claude') {
    return generateViaClaude(systemPrompt, userPrompt);
  } else {
    return generateViaOpenAI(systemPrompt, userPrompt);
  }
}

async function generateViaOpenAI(systemPrompt, userPrompt) {
  const url = document.getElementById('llm-url').value;
  const model = document.getElementById('llm-model').value;
  const temp = parseFloat(document.getElementById('llm-temp').value);

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: temp,
      max_tokens: 16000,
      stream: false
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('LLM API error (' + resp.status + '): ' + err);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

async function generateViaClaude(systemPrompt, userPrompt) {
  const apiKey = document.getElementById('claude-api-key').value;
  if (!apiKey) throw new Error('Podaj klucz Claude API w ustawieniach.');

  const model = document.getElementById('claude-model').value;
  const temp = parseFloat(document.getElementById('llm-temp').value);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 6000,
      temperature: temp,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('Claude API error (' + resp.status + '): ' + err);
  }

  const data = await resp.json();
  return data.content[0].text;
}

function markdownToHtml(md) {
  return md
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/<p><h3>/g, '<h3>')
    .replace(/<\/h3><\/p>/g, '</h3>')
    .replace(/<p><\/p>/g, '');
}

function showStep(stepId) {
  document.querySelectorAll('.astro-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(stepId).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleProviderSettings() {
  const provider = document.getElementById('llm-provider').value;
  document.getElementById('local-settings').classList.toggle('hidden', provider !== 'local');
  document.getElementById('claude-settings').classList.toggle('hidden', provider !== 'claude');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {

  // Geocode button
  document.getElementById('geocode-btn').addEventListener('click', async function() {
    const city = document.getElementById('birth-city').value.trim();
    if (!city) return;
    this.textContent = 'Szukam...';
    this.disabled = true;
    try {
      const coords = await geocodeCity(city);
      document.getElementById('birth-lat').value = coords.lat.toFixed(4);
      document.getElementById('birth-lng').value = coords.lng.toFixed(4);
      this.textContent = 'Znaleziono!';
      setTimeout(() => { this.textContent = 'Znajdź współrzędne'; }, 2000);
    } catch (e) {
      alert(e.message);
      this.textContent = 'Znajdź współrzędne';
    }
    this.disabled = false;
  });

  // Form submit
  document.getElementById('astro-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const patientName = document.getElementById('patient-name').value.trim();
    const birthDate = document.getElementById('birth-date').value;
    const birthTime = document.getElementById('birth-time').value;
    const birthCity = document.getElementById('birth-city').value.trim();
    let lat = parseFloat(document.getElementById('birth-lat').value);
    let lng = parseFloat(document.getElementById('birth-lng').value);

    // Auto-geocode if no coords
    if (isNaN(lat) || isNaN(lng)) {
      if (!birthCity) {
        alert('Podaj miejsce urodzenia lub współrzędne geograficzne.');
        return;
      }
      try {
        const coords = await geocodeCity(birthCity);
        lat = coords.lat;
        lng = coords.lng;
        document.getElementById('birth-lat').value = lat.toFixed(4);
        document.getElementById('birth-lng').value = lng.toFixed(4);
      } catch (err) {
        alert(err.message);
        return;
      }
    }

    // Therapy notes
    const area = document.getElementById('therapy-area').value.trim();
    const tissue = document.getElementById('therapy-tissue').value.trim();
    const technique = document.getElementById('therapy-technique').value.trim();
    let therapyNotes = '';
    if (area) therapyNotes += 'Obszar ciała: ' + area + '\n';
    if (tissue) therapyNotes += 'Tkanka: ' + tissue + '\n';
    if (technique) therapyNotes += 'Technika/obserwacje: ' + technique + '\n';

    const btn = document.getElementById('generate-btn');
    btn.textContent = 'Obliczam kosmogram...';
    btn.disabled = true;

    try {
      // Calculate horoscope
      const horoscope = calculateHoroscope(birthDate, birthTime, lat, lng);
      const chartData = extractChartData(horoscope);

      const birthInfo = birthDate + ', godz. ' + birthTime + ', ' + birthCity + ' (' + lat.toFixed(2) + ', ' + lng.toFixed(2) + ')';

      // Show cosmogram
      renderCosmogram(chartData, patientName, birthInfo);
      showStep('step-cosmogram');

      // Build prompts
      const cosmogramText = buildCosmogramText(chartData);
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(patientName, birthInfo, cosmogramText, therapyNotes);

      // Generate report via LLM
      const reportMd = await generateReport(systemPrompt, userPrompt);
      const reportHtml = markdownToHtml(reportMd);

      // Show report
      document.getElementById('report-patient').textContent = patientName + ' — ur. ' + birthInfo;
      document.getElementById('report-content').innerHTML = reportHtml;
      document.getElementById('ai-loading').classList.add('hidden');
      showStep('step-report');

    } catch (err) {
      const provider = document.getElementById('llm-provider').value;
      const hint = provider === 'claude'
        ? 'Sprawdź klucz API w ustawieniach.'
        : 'Sprawdź czy LM Studio jest uruchomione i model jest załadowany.';
      alert('Błąd: ' + err.message + '\n\n' + hint);
      document.getElementById('ai-loading').classList.add('hidden');
      showStep('step-form');
    }

    btn.textContent = 'Oblicz kosmogram i generuj raport';
    btn.disabled = false;
  });

  // Copy report
  document.getElementById('copy-btn').addEventListener('click', function() {
    const content = document.getElementById('report-content').innerText;
    const patient = document.getElementById('report-patient').textContent;
    const text = 'RAPORT — ASTROLOGIA EWOLUCYJNA\n' + patient + '\n\n' + content;
    navigator.clipboard.writeText(text).then(() => {
      this.textContent = 'Skopiowano!';
      setTimeout(() => { this.textContent = 'Kopiuj raport'; }, 2000);
    });
  });

  // New report
  document.getElementById('back-btn').addEventListener('click', function() {
    showStep('step-form');
    document.getElementById('ai-loading').classList.remove('hidden');
  });

  // Test connection
  document.getElementById('test-connection-btn').addEventListener('click', async function() {
    const status = document.getElementById('connection-status');
    const provider = document.getElementById('llm-provider').value;
    status.textContent = 'Testuję...';
    status.style.color = 'var(--text-light)';

    if (provider === 'claude') {
      const apiKey = document.getElementById('claude-api-key').value;
      if (!apiKey) {
        status.textContent = 'Podaj klucz API';
        status.style.color = '#dc2626';
        return;
      }
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: document.getElementById('claude-model').value,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'test' }]
          })
        });
        if (resp.ok) {
          status.textContent = 'Claude API działa!';
          status.style.color = '#16a34a';
        } else {
          const err = await resp.json();
          status.textContent = 'Błąd: ' + (err.error?.message || resp.status);
          status.style.color = '#dc2626';
        }
      } catch (e) {
        status.textContent = 'Brak połączenia z Claude API';
        status.style.color = '#dc2626';
      }
    } else {
      try {
        const url = document.getElementById('llm-url').value.replace('/chat/completions', '/models');
        const resp = await fetch(url);
        const data = await resp.json();
        const models = data.data ? data.data.map(m => m.id).join(', ') : 'brak modeli';
        status.textContent = 'Połączono! Modele: ' + models;
        status.style.color = '#16a34a';
      } catch (e) {
        status.textContent = 'Brak połączenia — uruchom LM Studio';
        status.style.color = '#dc2626';
      }
    }
  });

});
