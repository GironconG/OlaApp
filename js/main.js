// main.js - Inicialización, recomendador IA, búsquedas y listeners de UI
async function generateSmartWaveRecommendations(forceNewBatch = false) {
  currentMode = 'ai';
  if (forceNewBatch) {
    recommendationSeed++;
  }

  const container = document.getElementById('recommendResultsContainer');
  const domGenre = getDominantPlaylistGenre();
  const topArtists = getTopPlaylistArtists();
  const mainArtist = topArtists.length > 0 ? topArtists[0][0] : '';

  container.innerHTML = `<div style="text-align:center; padding:24px;"><span style="font-size:24px;">🤖</span> Consultando recomendaciones inteligentes en Beatport para <b>${domGenre}</b>...</div>`;

  const queries = [];
  if (mainArtist) queries.push(`${mainArtist}`);
  if (domGenre) queries.push(`${domGenre}`);
  if (topArtists.length > 1) queries.push(`${topArtists[1][0]}`);
  queries.push(`${domGenre} hits`);

  const currentQuery = queries[recommendationSeed % queries.length];

  try {
    const url = `/api/search?q=${encodeURIComponent(currentQuery)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const liveResults = data.results || [];

    const availableCandidates = [...liveResults, ...EDM_CANDIDATES_POOL].filter(cand => {
      return !checkIsDuplicate(cand.title).isDuplicate;
    });

    const shuffled = [...availableCandidates].sort((a, b) => {
      const hashA = (a.title.length * 31 + recommendationSeed * 17) % 100;
      const hashB = (b.title.length * 31 + recommendationSeed * 17) % 100;
      return hashA - hashB;
    });

    const displayBatch = shuffled.slice(0, 6);

    if (displayBatch.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">
        🎉 No hay más sugerencias únicas para ${domGenre}. Prueba buscando en el buscador manual.
      </div>`;
      return;
    }

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-size:12px; color:var(--accent-purple); font-weight:700; text-transform:uppercase;">
          ✨ Recomendaciones IA para Género <b>${domGenre}</b> (Lote #${recommendationSeed + 1}):
        </div>
        <button class="btn btn-secondary" style="font-size:11px; padding:6px 12px; gap:4px; border-color:var(--accent-purple); color:var(--accent-cyan);" onclick="generateSmartWaveRecommendations(true)">
          🎲 Generar OTRAS 6 Recomendaciones de ${domGenre}
        </button>
      </div>
      <div class="recommend-list">
    `;

    displayBatch.forEach((cand) => {
      const dupCheck = checkIsDuplicate(cand.title);
      const resSlot = findOptimalSlot(cand);

      let aiReason = `Optimiza la curva para ${cand.genre || domGenre}`;
      if (resSlot.slot <= 6) aiReason = "Suaviza el arranque de la mezcla";
      else if (resSlot.slot <= 25) aiReason = "Refuerza la energía central del set";
      else aiReason = "Potencia el clímax final";

      const trackObj = {
        title: cand.title,
        artist: cand.artist,
        bpm: cand.bpm,
        camelot: cand.camelot,
        key: cand.key || "Desconocido",
        genre: cand.genre || domGenre,
        isExtended: cand.isExtended,
        // Los resultados de /api/search traen su source; los del pool no, y esos son valores escritos a mano.
        source: cand.source || 'manual'
      };

      html += `
        <div class="recommend-card card-smart-ai ${dupCheck.isDuplicate ? 'card-duplicate' : ''}">
          <div class="track-info">
            <div class="track-name">${cand.title}</div>
            <div class="track-artist">${cand.artist}</div>
            <div class="track-meta">
              <span class="tag tag-genre">🎵 ${cand.genre || domGenre}</span>
              <span class="tag tag-genre-match">🎯 Género del Set</span>
              <span class="tag tag-bpm">${cand.bpm} BPM</span>
              <span class="tag tag-camelot">Camelot ${cand.camelot}</span>
              <span class="tag tag-ai-reason">💡 ${aiReason}</span>
              ${dupCheck.isDuplicate ? `<span class="tag tag-dup">⚠️ Ya en Playlist (#${dupCheck.pos})</span>` : ''}
            </div>
          </div>

          <div class="slot-recommendation">
            ${dupCheck.isDuplicate 
              ? `<div class="slot-score" style="color:var(--accent-yellow);">Posición Actual: #${dupCheck.pos}</div>
                 <div class="slot-desc">Ya está incluida en tu set</div>
                 <button class="btn-insert btn-disabled" disabled>⚠️ Ya en Playlist</button>`
              : `<div class="slot-score">🟢 Slot #${resSlot.slot} (${resSlot.score}%)</div>
                 <div class="slot-desc">Entre #${resSlot.slot-1 > 0 ? resSlot.slot-1 : 'Inicio'} y #${resSlot.slot}</div>
                 <button class="btn-insert" onclick="insertTrack('${encodeURIComponent(JSON.stringify(trackObj))}', ${resSlot.slot})">
                   ＋ Insertar
                 </button>`
            }
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = `<div style="color:var(--accent-red); padding:15px;">Error al generar recomendaciones: ${e.message}</div>`;
  }
}

async function analyzeAlbumQuery(query) {
  if (!query) return;
  const raw = query.trim();

  const isSpotifyAlbum = raw.match(/\/album[\/:]([a-zA-Z0-9]+)/i) || raw.includes('spotify:album');
  const isSpotifyPlaylist = raw.match(/\/playlist[\/:]([a-zA-Z0-9]+)/i) || raw.includes('spotify:playlist');
  const isAppleMusic = raw.includes('music.apple.com') || raw.includes('itunes.apple.com');

  if (isSpotifyAlbum) {
    await searchAndDisplaySpotifyAlbum(raw);
    return;
  }

  if (isSpotifyPlaylist) {
    await searchAndDisplaySpotifyPlaylist(raw);
    return;
  }

  if (isAppleMusic) {
    await searchAndDisplayAppleMusicAlbum(raw);
    return;
  }

  currentMode = 'search';
  const container = document.getElementById('recommendResultsContainer');
  container.innerHTML = `<div style="text-align:center; padding:30px;"><span style="font-size:24px;">🔄</span> Consultando metadatos 100% reales en Beatport + iTunes...</div>`;

  try {
    const url = `/api/search?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const results = data.results || [];

    if (results.length === 0) {
      container.innerHTML = `<div style="color:var(--accent-red); text-align:center; padding:20px;">No se encontraron resultados para '${query}'. Prueba con otro término.</div>`;
      return;
    }

    let html = `<div class="recommend-list">`;

    results.forEach((item) => {
      const title = item.title;
      const artist = item.artist;
      const bpm = item.bpm;
      const camelot = item.camelot;
      const verified = !!item.verified && bpm !== null && bpm !== undefined;
      const source = item.source || "none";
      const isExtended = item.isExtended;
      const durSec = item.durSec;
      const genre = item.genre || "EDM / Dance";

      const domGenre = getDominantPlaylistGenre();
      const isGenreMatch = genre.toLowerCase().includes(domGenre.toLowerCase()) || domGenre.toLowerCase().includes(genre.toLowerCase());

      const trackObj = { title, artist, bpm, camelot, isExtended, durSec, genre, source };
      const dupCheck = checkIsDuplicate(title);
      const resSlot = verified ? findOptimalSlot(trackObj) : null;

      const sourceLabel = getDataSourceLabel(source);

      html += `
        <div class="recommend-card ${dupCheck.isDuplicate ? 'card-duplicate' : ''}">
          <div class="track-info">
            <div class="track-name">${title}</div>
            <div class="track-artist">${artist} • ${Math.floor(durSec/60)}:${(durSec%60).toString().padStart(2,'0')}</div>
            <div class="track-meta">
              ${verified
                ? `<span class="tag tag-real-data">${sourceLabel || '✅ Verificado'}</span>`
                : `<span class="tag tag-dup" style="background:rgba(255,185,0,0.15); color:#ffb900; border-color:rgba(255,185,0,0.4);">⚠️ Sin dato real — no se encontró en Beatport ni en la base conocida</span>`
              }
              <span class="tag tag-genre">🎵 ${genre}</span>
              ${isGenreMatch ? '<span class="tag tag-genre-match">🎯 Género del Set</span>' : ''}
              ${verified ? `<span class="tag tag-bpm">${bpm} BPM</span><span class="tag tag-camelot">Camelot ${camelot}</span>` : ''}
              <span class="tag ${isExtended ? 'tag-ext':'tag-radio'}">${isExtended ? 'Extended Mix' : 'Radio Edit'}</span>
              ${dupCheck.isDuplicate ? `<span class="tag tag-dup">⚠️ Ya en Playlist (#${dupCheck.pos})</span>` : ''}
            </div>
          </div>

          <div class="slot-recommendation">
            ${dupCheck.isDuplicate 
              ? `<div class="slot-score" style="color:var(--accent-yellow);">Posición Actual: #${dupCheck.pos}</div>
                 <div class="slot-desc">Ya está incluida en tu set</div>
                 <button class="btn-insert btn-disabled" disabled>⚠️ Ya en Playlist</button>`
              : !verified
              ? `<div class="slot-desc" style="color:#ffb900;">Busca su BPM/tonalidad a mano antes de insertarla</div>
                 <button class="btn-insert" onclick="insertTrack('${encodeURIComponent(JSON.stringify(trackObj))}', ${currentPlaylist.length + 1})">
                   ＋ Insertar al final igualmente
                 </button>`
              : `<div class="slot-score">🟢 Slot #${resSlot.slot} (${resSlot.score}%)</div>
                 <div class="slot-desc">Entre #${resSlot.slot-1 > 0 ? resSlot.slot-1 : 'Inicio'} y #${resSlot.slot}</div>
                 <button class="btn-insert" onclick="insertTrack('${encodeURIComponent(JSON.stringify(trackObj))}', ${resSlot.slot})">
                   ＋ Insertar
                 </button>`
            }
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-red); padding:20px;">Error al consultar Beatport API backend: ${err.message}</div>`;
  }
}

function updateTopArtistsChips() {
  const container = document.getElementById('topArtistsChips');
  if (!container) return;
  container.innerHTML = '';
  const topArtists = getTopPlaylistArtists();

  topArtists.forEach(([artist, count]) => {
    const chip = document.createElement('button');
    chip.className = 'tag tag-real-data';
    chip.style.cursor = 'pointer';
    chip.style.border = '1px solid rgba(0, 242, 254, 0.4)';
    chip.style.transition = 'all 0.2s ease';
    chip.innerHTML = `👤 ${artist} (${count})`;
    chip.onclick = () => {
      document.getElementById('albumInput').value = artist;
      analyzeAlbumQuery(artist);
    };
    container.appendChild(chip);
  });
}

function refreshCurrentRecommendationsView() {
  if (currentMode === 'ai') {
    generateSmartWaveRecommendations();
  } else if (currentMode === 'search') {
    const q = document.getElementById('albumInput').value.trim();
    if (q) analyzeAlbumQuery(q);
  }
}

// Inicialización de Listeners al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  checkSpotifyAuthCode();
  loadPlaylistFromLocalStorage();
  initChart();
  updatePlaylistTable();
  generateSmartWaveRecommendations();

  document.getElementById('btnSmartWaveRecommend')?.addEventListener('click', () => generateSmartWaveRecommendations(true));

  document.getElementById('btnImportPlaylist')?.addEventListener('click', async () => {
    const raw = document.getElementById('importTextarea').value.trim();
    if (!raw) {
      alert("Por favor pega primero un enlace de Spotify, Apple Music o tu lista de canciones en el recuadro.");
      return;
    }

    const isSpotifyAlbum = raw.match(/\/album[\/:]([a-zA-Z0-9]+)/i) || raw.includes('spotify:album');
    const isSpotifyPlaylist = raw.match(/\/playlist[\/:]([a-zA-Z0-9]+)/i) || raw.includes('spotify:playlist');
    const isAppleMusic = raw.includes('music.apple.com') || raw.includes('itunes.apple.com');

    if (isSpotifyAlbum) {
      await importSpotifyAlbumById(raw);
      document.getElementById('importTextarea').value = '';
      return;
    }

    if (isSpotifyPlaylist) {
      await importSpotifyPlaylistById(raw);
      document.getElementById('importTextarea').value = '';
      return;
    }

    if (isAppleMusic) {
      await importAppleMusicAlbumById(raw);
      document.getElementById('importTextarea').value = '';
      return;
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const indicator = document.getElementById('saveIndicator');
    if (indicator) indicator.innerText = `🔎 Consultando metadatos para ${lines.length} canciones...`;

    const newPlaylist = [];
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      let title = line, artist = "Desconocido";
      if (line.includes('-')) {
        const parts = line.split('-');
        title = parts[0].trim();
        artist = parts[1].trim();
      } else if (line.includes('—')) {
        const parts = line.split('—');
        title = parts[0].trim();
        artist = parts[1].trim();
      }
      
      const existing = INITIAL_PLAYLIST.find(s => normalizeSongTitle(s.title) === normalizeSongTitle(title));
      let meta;
      if (existing && existing.bpm) {
        meta = {
          bpm: existing.bpm,
          camelot: existing.camelot,
          key: existing.key || "Desconocido",
          genre: existing.genre || inferGenreFromTrack(title, artist)
        };
      } else {
        meta = await fetchRealTrackMetadata(title, artist);
      }

      newPlaylist.push({
        pos: idx + 1,
        title: title,
        artist: artist,
        bpm: meta.bpm,
        key: meta.key,
        camelot: meta.camelot,
        genre: meta.genre
      });
    }

    if (confirm(`¿Cargar esta nueva playlist de ${newPlaylist.length} canciones con BPMs reales? Reemplazará la lista activa actual.`)) {
      currentPlaylist = newPlaylist;
      updatePlaylistTable();
      document.getElementById('importTextarea').value = '';
      refreshCurrentRecommendationsView();
      if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
      alert(`✅ Playlist importada con éxito (${newPlaylist.length} canciones con metadatos reales). Cambios guardados automáticamente!`);
    }
  });

  document.getElementById('btnAnalyze')?.addEventListener('click', () => {
    const q = document.getElementById('albumInput').value.trim();
    if (q) analyzeAlbumQuery(q);
  });

  document.getElementById('albumInput')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      const q = document.getElementById('albumInput').value.trim();
      if (q) analyzeAlbumQuery(q);
    }
  });

  document.getElementById('btnResetPlaylist')?.addEventListener('click', () => {
    if (confirm("¿Restablecer la playlist a las 38 canciones originales?")) {
      currentPlaylist = JSON.parse(JSON.stringify(INITIAL_PLAYLIST));
      updatePlaylistTable();
      refreshCurrentRecommendationsView();
    }
  });

  document.getElementById('btnCopyTuneMyMusic')?.addEventListener('click', () => {
    const lines = currentPlaylist.map(s => `${s.title} - ${s.artist}`).join('\n');
    navigator.clipboard.writeText(lines);
    alert("📋 ¡Lista copiada al portapapeles en formato listo para TuneMyMusic!");
  });

  document.getElementById('btnExportCSV')?.addEventListener('click', () => {
    let csv = "Posicion,Titulo,Artista,BPM,Camelot\n";
    currentPlaylist.forEach((s, i) => {
      csv += `${i + 1},"${s.title}","${s.artist}",${s.bpm},${s.camelot}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "playlist_sube_baja_edm.csv";
    a.click();
  });
});
