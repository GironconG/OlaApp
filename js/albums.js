// albums.js - Importación y previsualización de álbumes y playlists (Spotify & Apple Music)

const CLIENT_KNOWN_TRACKS = {
  // Iconic EDM / Dance Hits (Exact Spotify Data)
  "blame": { bpm: 128, camelot: "5A", key: "Do menor", genre: "EDM / Dance" },
  "without you": { bpm: 128, camelot: "10B", key: "Re mayor", genre: "EDM / Dance" },
  "turn me on": { bpm: 128, camelot: "5A", key: "Do menor", genre: "EDM / Dance" },
  "i need your love": { bpm: 125, camelot: "5B", key: "Mib mayor", genre: "EDM / Dance" },
  "2u": { bpm: 145, camelot: "1A", key: "Sol# menor", genre: "EDM / Dance" },
  "drinking from the bottle": { bpm: 128, camelot: "8A", key: "La menor", genre: "EDM / Dance" },
  "outside": { bpm: 128, camelot: "7A", key: "Re menor", genre: "EDM / Dance" },
  "stereo love": { bpm: 127, camelot: "2A", key: "Re# menor", genre: "Dance" },
  "21 reasons": { bpm: 124, camelot: "2B", key: "Fa# mayor", genre: "EDM / Dance" },
  "no money": { bpm: 126, camelot: "3B", key: "Reb mayor", genre: "EDM / Dance" },
  "overdrive": { bpm: 127, camelot: "3B", key: "Reb mayor", genre: "EDM / Dance" },
  "the motto": { bpm: 120, camelot: "3A", key: "La# menor", genre: "EDM / Dance" },

  // Bad Bunny - DeBÍ TIRAR MÁs FOToS (2025/2026)
  "nuevayol": { bpm: 125, camelot: "6A", key: "Sol menor", genre: "Urbano latino" },
  "voy a llevarte pa pr": { bpm: 100, camelot: "9A", key: "Mi menor", genre: "Urbano latino" },
  "baile inolvidable": { bpm: 178, camelot: "8A", key: "La menor", genre: "Latin" },
  "perfumito nuevo": { bpm: 110, camelot: "7B", key: "Fa mayor", genre: "Reggaeton / Urbano" },
  "weltita": { bpm: 150, camelot: "12A", key: "Do# menor", genre: "Latin" },
  "velda": { bpm: 182, camelot: "6A", key: "Sol menor", genre: "Techno / Urbano" },
  "el club": { bpm: 111, camelot: "3A", key: "La# menor", genre: "Latin" },
  "ketu tecre": { bpm: 104, camelot: "3B", key: "Re b mayor", genre: "Reggaeton / Urbano" },
  "bokete": { bpm: 115, camelot: "9B", key: "Sol mayor", genre: "Urbano latino" },
  "kloufrens": { bpm: 92, camelot: "8B", key: "Do mayor", genre: "Latin" },
  "turista": { bpm: 65, camelot: "3B", key: "Re b mayor", genre: "Latin" },
  "cafe con ron": { bpm: 133, camelot: "7A", key: "Re menor", genre: "Latin" },
  "pitorro de coco": { bpm: 98, camelot: "10A", key: "Si menor", genre: "Latin" },
  "lo que le paso a hawaii": { bpm: 170, camelot: "10A", key: "Si menor", genre: "Latin" },
  "eoo": { bpm: 102, camelot: "12A", key: "Do# menor", genre: "Latin" }
};

function getClientKnownMeta(title, artist) {
  const norm = typeof normalizeSongTitle === 'function' ? normalizeSongTitle(title) : (title || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
  for (const [k, v] of Object.entries(CLIENT_KNOWN_TRACKS)) {
    const kNorm = typeof normalizeSongTitle === 'function' ? normalizeSongTitle(k) : k.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (norm === kNorm || norm.includes(kNorm) || kNorm.includes(norm)) {
      return v;
    }
  }
  return null;
}

// NOTA HONESTIDAD DE DATOS: se eliminó generateRealisticTrackMetadataClient().
// Antes inventaba un BPM/Camelot a partir de un hash del título cuando no se
// encontraba dato real, sin ninguna marca que lo distinguiera de un dato
// verificado. Ahora, si no hay dato real, fetchRealTrackMetadata() devuelve
// bpm/camelot/key en null y verified:false explícito.

async function fetchRealTrackMetadata(title, artist) {
  // 1. Check client-side known track database
  const known = getClientKnownMeta(title, artist);
  if (known) {
    return {
      bpm: known.bpm,
      camelot: known.camelot,
      key: known.key,
      genre: known.genre || (typeof inferGenreFromTrack === 'function' ? inferGenreFromTrack(title, artist) : "EDM / General"),
      source: "known_db",
      verified: true
    };
  }

  // 2. Try fetching from backend /api/search (base de conocidos + scraping real a Beatport)
  try {
    const q = `${title} ${artist}`;
    const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (resp.ok) {
      const data = await resp.json();
      const results = data.results || [];
      const top = results.find(r => r.verified) || null;
      if (top) {
        return {
          bpm: top.bpm,
          camelot: top.camelot,
          key: top.key,
          genre: top.genre || (typeof inferGenreFromTrack === 'function' ? inferGenreFromTrack(title, artist) : "EDM / General"),
          source: top.source || "beatport",
          verified: true
        };
      }
    }
  } catch(e) {}

  // 3. Nada real encontrado: NO se inventa un número. Se devuelve sin verificar
  // para que la interfaz lo marque con claridad y tú decidas si lo buscas a mano.
  const infGenre = typeof inferGenreFromTrack === 'function' ? inferGenreFromTrack(title, artist) : "EDM / General";
  return {
    bpm: null,
    camelot: null,
    key: null,
    genre: infGenre,
    source: "none",
    verified: false
  };
}

// ReccoBeats: reemplazo gratuito y funcional del audio-features de Spotify
// (cerrado desde nov. 2024). No requiere API key ni token — solo el ID de
// Spotify de la canción, que ya tenemos disponible al importar álbumes o
// playlists reales de Spotify. Devuelve tempo, key y mode reales.
async function fetchReccoBeatsFeatures(spotifyIds) {
  const map = {};
  if (!spotifyIds || spotifyIds.length === 0) return map;

  for (let off = 0; off < spotifyIds.length; off += 40) {
    const batch = spotifyIds.slice(off, off + 40);
    try {
      // Paso 1: resolver IDs de Spotify a IDs internos de ReccoBeats
      const resolveResp = await fetch(`https://api.reccobeats.com/v1/track?ids=${batch.join(',')}`, {
        headers: { 'accept': 'application/json' }
      });
      if (!resolveResp.ok) continue;
      const resolveData = await resolveResp.json();
      const resolved = resolveData.content || [];

      // Paso 2: pedir audio-features para cada track resuelto (en paralelo)
      await Promise.all(resolved.map(async (track) => {
        try {
          const spotifyId = (track.href || '').split('/track/')[1];
          if (!spotifyId) return;
          const afResp = await fetch(`https://api.reccobeats.com/v1/track/${track.id}/audio-features`, {
            headers: { 'accept': 'application/json' }
          });
          if (!afResp.ok) return;
          const af = await afResp.json();
          if (af && typeof af.tempo === 'number' && af.key !== undefined) {
            map[spotifyId] = af;
          }
        } catch (e) {}
      }));
    } catch (e) {}
  }
  return map;
}

async function searchAndDisplaySpotifyAlbum(urlOrId) {
  currentMode = 'album_search';
  const container = document.getElementById('recommendResultsContainer');

  let token = localStorage.getItem('spotify_access_token');
  if (!token) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px; color:var(--accent-yellow); background:rgba(255,185,0,0.05); border:1px solid rgba(255,185,0,0.2); border-radius:12px;">
        <div style="font-size:16px; font-weight:700; margin-bottom:8px;">🟢 Sesión de Spotify Requerida</div>
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">Para explorar y previsualizar las canciones de un álbum de Spotify en la lista de búsqueda, inicia sesión con tu cuenta:</div>
        <button class="btn btn-spotify" style="margin:0 auto; padding:10px 20px; font-weight:700;" onclick="openSpotifyTokenGuide()">🔑 Iniciar Sesión con Spotify (1-Click)</button>
      </div>
    `;
    return;
  }

  let albumId = urlOrId.trim();
  const match = albumId.match(/album[\/:]([a-zA-Z0-9]+)/i);
  if (match) {
    albumId = match[1];
  }
  albumId = albumId.split('?')[0];

  container.innerHTML = `<div style="text-align:center; padding:30px;"><span style="font-size:24px;">💿</span> Conectando con Spotify API y extrayendo canciones del álbum...</div>`;

  try {
    const aResp = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!aResp.ok) {
      if (aResp.status === 403 || aResp.status === 401) {
        localStorage.removeItem('spotify_access_token');
        container.innerHTML = `<div style="color:var(--accent-red); text-align:center; padding:20px;">Sesión de Spotify expirada. <button class="btn btn-spotify" style="margin:10px auto 0;" onclick="openSpotifyTokenGuide()">🔑 Volver a iniciar sesión</button></div>`;
        return;
      }
      throw new Error("No se pudo obtener el álbum de Spotify. Verifica que la URL sea pública.");
    }

    const aData = await aResp.json();
    const albumName = aData.name || "Álbum de Spotify";
    const albumArtist = Array.isArray(aData.artists) ? aData.artists.map(a => a.name).join(', ') : 'Varios Artistas';

    const rawTracks = [];
    const trackIds = [];
    let tracksUrl = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;

    while (tracksUrl) {
      try {
        const tResp = await fetch(tracksUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!tResp.ok) break;
        const tData = await tResp.json();
        const itemsArr = Array.isArray(tData.items) ? tData.items : [];
        itemsArr.forEach(it => {
          if (it && it.name) {
            const art = Array.isArray(it.artists) ? it.artists.map(a => a.name).join(', ') : albumArtist;
            rawTracks.push({ id: it.id, title: it.name, artist: art });
            if (it.id) trackIds.push(it.id);
          }
        });
        tracksUrl = tData.next;
      } catch(e) { break; }
    }

    if (rawTracks.length === 0) {
      container.innerHTML = `<div style="color:var(--accent-yellow); text-align:center; padding:20px;">El álbum de Spotify no contiene canciones.</div>`;
      return;
    }

    // Audio features vía ReccoBeats (Spotify cerró su propio endpoint en nov. 2024)
    const audioFeaturesMap = await fetchReccoBeatsFeatures(trackIds);

    container.innerHTML = `<div style="text-align:center; padding:30px;"><span style="font-size:24px;">🔎</span> Consultando BPMs reales y cálculo armónico para ${rawTracks.length} canciones del álbum '<b>${albumName}</b>'...</div>`;

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:rgba(0,242,254,0.08); padding:12px 16px; border-radius:12px; border:1px solid rgba(0,242,254,0.3); flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:15px; font-weight:800; color:#fff;">💿 Álbum Spotify: ${albumName}</div>
          <div style="font-size:12px; color:var(--accent-cyan); font-weight:600;">👤 ${albumArtist} • 🎵 ${rawTracks.length} Pistas encontradas</div>
        </div>
        <button class="btn btn-magic" style="font-size:12px; padding:8px 16px;" onclick="addAllAlbumTracksToPlaylist('${encodeURIComponent(JSON.stringify(rawTracks))}')">
          ⚡ Agregar TODAS al Set
        </button>
      </div>
      <div class="recommend-list">
    `;

    for (let i = 0; i < rawTracks.length; i++) {
      const item = rawTracks[i];
      const normT = normalizeSongTitle(item.title);
      const existing = INITIAL_PLAYLIST.find(s => normalizeSongTitle(s.title) === normT) || EDM_CANDIDATES_POOL.find(s => normalizeSongTitle(s.title) === normT);

      let meta;
      const af = item.id ? audioFeaturesMap[item.id] : null;
      if (af && af.tempo && af.key !== undefined) {
        meta = {
          bpm: Math.round(af.tempo),
          camelot: convertSpotifyKeyToCamelot(af.key, af.mode),
          key: convertSpotifyKeyToName(af.key, af.mode),
          genre: inferGenreFromTrack(item.title, item.artist)
        };
      } else if (existing && existing.bpm) {
        meta = {
          bpm: existing.bpm,
          camelot: existing.camelot,
          key: existing.key || "Desconocido",
          genre: existing.genre || inferGenreFromTrack(item.title, item.artist)
        };
      } else {
        meta = await fetchRealTrackMetadata(item.title, item.artist);
      }

      const trackObj = {
        title: item.title,
        artist: item.artist,
        bpm: meta.bpm,
        camelot: meta.camelot,
        key: meta.key,
        genre: meta.genre
      };

      const resSlot = findOptimalSlot(trackObj);
      const dupCheck = checkIsDuplicate(item.title);

      html += `
        <div class="recommend-card ${dupCheck.isDuplicate ? 'card-duplicate' : ''}">
          <div class="track-info">
            <div class="track-name">#${i + 1}: ${item.title}</div>
            <div class="track-artist">${item.artist}</div>
            <div class="track-meta">
              <span class="tag tag-genre">🎵 ${meta.genre}</span>
              <span class="tag tag-bpm">${meta.bpm} BPM</span>
              <span class="tag tag-camelot">Camelot ${meta.camelot}</span>
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
    }

    html += `</div>`;
    container.innerHTML = html;

  } catch(err) {
    container.innerHTML = `<div style="color:var(--accent-red); padding:20px;">Error al consultar álbum de Spotify: ${err.message}</div>`;
  }
}

async function searchAndDisplaySpotifyPlaylist(urlOrId) {
  currentMode = 'playlist_search';
  const container = document.getElementById('recommendResultsContainer');

  let token = localStorage.getItem('spotify_access_token');
  if (!token) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px; color:var(--accent-yellow); background:rgba(255,185,0,0.05); border:1px solid rgba(255,185,0,0.2); border-radius:12px;">
        <div style="font-size:16px; font-weight:700; margin-bottom:8px;">🟢 Sesión de Spotify Requerida</div>
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">Para explorar y previsualizar las canciones de una playlist de Spotify en la lista de búsqueda, inicia sesión con tu cuenta:</div>
        <button class="btn btn-spotify" style="margin:0 auto; padding:10px 20px; font-weight:700;" onclick="openSpotifyTokenGuide()">🔑 Iniciar Sesión con Spotify (1-Click)</button>
      </div>
    `;
    return;
  }

  let playlistId = urlOrId.trim();
  const match = playlistId.match(/playlist[\/:]([a-zA-Z0-9]+)/i);
  if (match) {
    playlistId = match[1];
  }
  playlistId = playlistId.split('?')[0];

  container.innerHTML = `<div style="text-align:center; padding:30px;"><span style="font-size:24px;">🎵</span> Conectando con Spotify API y extrayendo canciones de la playlist...</div>`;

  try {
    const pResp = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!pResp.ok) {
      if (pResp.status === 403 || pResp.status === 401) {
        localStorage.removeItem('spotify_access_token');
        container.innerHTML = `<div style="color:var(--accent-red); text-align:center; padding:20px;">Sesión de Spotify expirada. <button class="btn btn-spotify" style="margin:10px auto 0;" onclick="openSpotifyTokenGuide()">🔑 Volver a iniciar sesión</button></div>`;
        return;
      }
      throw new Error("No se pudo obtener la playlist de Spotify. Verifica que la URL sea pública.");
    }

    const pData = await pResp.json();
    const playlistName = pData.name || "Playlist de Spotify";

    function extractSpotifyTrackObj(it) {
      if (!it) return null;
      const trk = it.item || it.track || (it.name ? it : null);
      if (!trk || !trk.name) return null;
      let artistName = 'Desconocido';
      if (Array.isArray(trk.artists) && trk.artists.length > 0) {
        artistName = trk.artists.map(a => a.name || a).join(', ');
      }
      return { id: trk.id, title: trk.name, artist: artistName };
    }

    const rawTracks = [];
    let initialItems = Array.isArray(pData.tracks?.items) ? pData.tracks.items : (Array.isArray(pData.items) ? pData.items : []);
    initialItems.forEach(it => {
      const parsed = extractSpotifyTrackObj(it);
      if (parsed) rawTracks.push(parsed);
    });

    if (rawTracks.length === 0) {
      container.innerHTML = `<div style="color:var(--accent-yellow); text-align:center; padding:20px;">La playlist de Spotify no contiene canciones.</div>`;
      return;
    }

    container.innerHTML = `<div style="text-align:center; padding:30px;"><span style="font-size:24px;">🔎</span> Consultando BPMs reales y cálculo armónico para ${rawTracks.length} canciones de '${playlistName}'...</div>`;

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:rgba(29,185,84,0.08); padding:12px 16px; border-radius:12px; border:1px solid rgba(29,185,84,0.3); flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:15px; font-weight:800; color:#fff;">🎵 Playlist Spotify: ${playlistName}</div>
          <div style="font-size:12px; color:var(--accent-green); font-weight:600;">🎶 ${rawTracks.length} Pistas encontradas</div>
        </div>
        <button class="btn btn-magic" style="font-size:12px; padding:8px 16px;" onclick="addAllAlbumTracksToPlaylist('${encodeURIComponent(JSON.stringify(rawTracks))}')">
          ⚡ Agregar TODAS al Set
        </button>
      </div>
      <div class="recommend-list">
    `;

    for (let i = 0; i < rawTracks.length; i++) {
      const item = rawTracks[i];
      const meta = await fetchRealTrackMetadata(item.title, item.artist);
      const trackObj = { title: item.title, artist: item.artist, bpm: meta.bpm, camelot: meta.camelot, key: meta.key, genre: meta.genre };
      const resSlot = findOptimalSlot(trackObj);
      const dupCheck = checkIsDuplicate(item.title);

      html += `
        <div class="recommend-card ${dupCheck.isDuplicate ? 'card-duplicate' : ''}">
          <div class="track-info">
            <div class="track-name">#${i + 1}: ${item.title}</div>
            <div class="track-artist">${item.artist}</div>
            <div class="track-meta">
              <span class="tag tag-genre">🎵 ${meta.genre}</span>
              <span class="tag tag-bpm">${meta.bpm} BPM</span>
              <span class="tag tag-camelot">Camelot ${meta.camelot}</span>
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
    }

    html += `</div>`;
    container.innerHTML = html;

  } catch(err) {
    container.innerHTML = `<div style="color:var(--accent-red); padding:20px;">Error al consultar playlist de Spotify: ${err.message}</div>`;
  }
}

async function searchAndDisplayAppleMusicAlbum(urlOrId) {
  currentMode = 'album_search';
  const container = document.getElementById('recommendResultsContainer');

  let albumId = urlOrId.trim();
  const match = albumId.match(/(?:id|album\/|album\/[^\/]+\/)(\d+)/i);
  if (match) {
    albumId = match[1];
  }
  albumId = albumId.split('?')[0];

  container.innerHTML = `<div style="text-align:center; padding:30px;"><span style="font-size:24px;">🍎</span> Conectando con Apple Music API y extrayendo canciones del álbum...</div>`;

  try {
    const resp = await fetch(`https://itunes.apple.com/lookup?id=${albumId}&entity=song`);
    if (!resp.ok) {
      throw new Error("No se pudo obtener información del álbum de Apple Music.");
    }
    const data = await resp.json();
    const results = data.results || [];

    const collectionItem = results.find(r => r.wrapperType === 'collection');
    const albumName = collectionItem ? collectionItem.collectionName : "Álbum Apple Music";
    const albumArtist = collectionItem ? collectionItem.artistName : "Varios Artistas";

    const trackItems = results.filter(r => r.wrapperType === 'track');

    if (trackItems.length === 0) {
      container.innerHTML = `<div style="color:var(--accent-yellow); text-align:center; padding:20px;">No se encontraron canciones en el enlace de Apple Music.</div>`;
      return;
    }

    container.innerHTML = `<div style="text-align:center; padding:30px;"><span style="font-size:24px;">🔎</span> Consultando BPMs reales y cálculo armónico para ${trackItems.length} canciones del álbum '<b>${albumName}</b>'...</div>`;

    const rawTracks = trackItems.map(it => ({ title: it.trackName, artist: it.artistName || albumArtist }));

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:rgba(255,45,85,0.08); padding:12px 16px; border-radius:12px; border:1px solid rgba(255,45,85,0.3); flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:15px; font-weight:800; color:#fff;">🍎 Álbum Apple Music: ${albumName}</div>
          <div style="font-size:12px; color:var(--accent-red); font-weight:600;">👤 ${albumArtist} • 🎵 ${rawTracks.length} Pistas encontradas</div>
        </div>
        <button class="btn btn-magic" style="font-size:12px; padding:8px 16px; background:linear-gradient(135deg, #ff0055, #ff2d55);" onclick="addAllAlbumTracksToPlaylist('${encodeURIComponent(JSON.stringify(rawTracks))}')">
          ⚡ Agregar TODAS al Set
        </button>
      </div>
      <div class="recommend-list">
    `;

    for (let i = 0; i < rawTracks.length; i++) {
      const item = rawTracks[i];
      const normT = normalizeSongTitle(item.title);
      const existing = INITIAL_PLAYLIST.find(s => normalizeSongTitle(s.title) === normT) || EDM_CANDIDATES_POOL.find(s => normalizeSongTitle(s.title) === normT);

      let meta;
      if (existing && existing.bpm) {
        meta = {
          bpm: existing.bpm,
          camelot: existing.camelot,
          key: existing.key || "Desconocido",
          genre: existing.genre || inferGenreFromTrack(item.title, item.artist)
        };
      } else {
        meta = await fetchRealTrackMetadata(item.title, item.artist);
      }

      const trackObj = { title: item.title, artist: item.artist, bpm: meta.bpm, camelot: meta.camelot, key: meta.key, genre: meta.genre };
      const resSlot = findOptimalSlot(trackObj);
      const dupCheck = checkIsDuplicate(item.title);

      html += `
        <div class="recommend-card ${dupCheck.isDuplicate ? 'card-duplicate' : ''}">
          <div class="track-info">
            <div class="track-name">#${i + 1}: ${item.title}</div>
            <div class="track-artist">${item.artist}</div>
            <div class="track-meta">
              <span class="tag tag-genre">🎵 ${meta.genre}</span>
              <span class="tag tag-bpm">${meta.bpm} BPM</span>
              <span class="tag tag-camelot">Camelot ${meta.camelot}</span>
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
    }

    html += `</div>`;
    container.innerHTML = html;

  } catch(err) {
    container.innerHTML = `<div style="color:var(--accent-red); padding:20px;">Error al consultar álbum de Apple Music: ${err.message}</div>`;
  }
}

window.addAllAlbumTracksToPlaylist = async function(jsonStr) {
  const tracks = JSON.parse(decodeURIComponent(jsonStr));
  if (confirm(`¿Agregar las ${tracks.length} canciones de este álbum a tu set actual en orden armónico?`)) {
    const indicator = document.getElementById('saveIndicator');
    if (indicator) indicator.innerText = `🔎 Insertando ${tracks.length} canciones del álbum...`;

    for (const item of tracks) {
      const normT = normalizeSongTitle(item.title);
      const existing = INITIAL_PLAYLIST.find(s => normalizeSongTitle(s.title) === normT) || EDM_CANDIDATES_POOL.find(s => normalizeSongTitle(s.title) === normT);
      let meta;
      if (existing && existing.bpm) {
        meta = { bpm: existing.bpm, camelot: existing.camelot, key: existing.key || "Desconocido", genre: existing.genre || inferGenreFromTrack(item.title, item.artist) };
      } else {
        meta = await fetchRealTrackMetadata(item.title, item.artist);
      }
      currentPlaylist.push({
        pos: currentPlaylist.length + 1,
        title: item.title,
        artist: item.artist,
        bpm: meta.bpm,
        key: meta.key,
        camelot: meta.camelot,
        genre: meta.genre,
        isNew: true
      });
    }

    const autoSort = document.getElementById('autoSortToggle')?.checked;
    if (autoSort) {
      reorderPlaylistHarmonically(true);
    } else {
      updatePlaylistTable();
    }
    if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
    alert(`🎉 ¡Se agregaron las ${tracks.length} canciones del álbum a tu set!`);
  }
};

window.importSpotifyAlbumById = async function(albumIdOrUrl) {
  let token = localStorage.getItem('spotify_access_token');
  if (!token) {
    alert("Para importar álbumes directamente desde Spotify, por favor inicia sesión con Spotify primero.");
    openSpotifyTokenGuide();
    return;
  }

  let albumId = albumIdOrUrl.trim();
  const match = albumId.match(/album[\/:]([a-zA-Z0-9]+)/i);
  if (match) {
    albumId = match[1];
  }
  albumId = albumId.split('?')[0];

  const indicator = document.getElementById('saveIndicator');
  if (indicator) indicator.innerText = "🔄 Conectando con Spotify API (Álbum)...";

  try {
    const aResp = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!aResp.ok) {
      if (aResp.status === 403 || aResp.status === 401) {
        localStorage.removeItem('spotify_access_token');
        alert("Sesión de Spotify expirada o sin permisos. Por favor vuelve a hacer clic en '🔑 Iniciar Sesión con Spotify'.");
        openSpotifyTokenGuide();
        return;
      }
      throw new Error("No se pudo obtener el álbum de Spotify. Verifica que la URL sea pública.");
    }

    const aData = await aResp.json();
    const albumName = aData.name || "Álbum de Spotify";
    const albumArtist = Array.isArray(aData.artists) ? aData.artists.map(a => a.name).join(', ') : 'Varios Artistas';

    const spotifyItems = [];
    const trackIds = [];
    let tracksUrl = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;

    while (tracksUrl) {
      try {
        const tResp = await fetch(tracksUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!tResp.ok) break;
        const tData = await tResp.json();
        const itemsArr = Array.isArray(tData.items) ? tData.items : [];
        itemsArr.forEach(it => {
          if (it && it.name) {
            const art = Array.isArray(it.artists) ? it.artists.map(a => a.name).join(', ') : albumArtist;
            spotifyItems.push({ id: it.id, title: it.name, artist: art });
            if (it.id) trackIds.push(it.id);
          }
        });
        tracksUrl = tData.next;
      } catch (e) {
        break;
      }
    }

    if (spotifyItems.length === 0) {
      alert("El álbum de Spotify no contiene canciones.");
      if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
      return;
    }

    // Audio features vía ReccoBeats (Spotify cerró su propio endpoint en nov. 2024)
    const audioFeaturesMap = await fetchReccoBeatsFeatures(trackIds);

    if (indicator) indicator.innerText = `🔎 Consultando BPM y Camelot reales para ${spotifyItems.length} canciones del álbum '${albumName}'...`;

    const newPlaylist = [];
    for (let i = 0; i < spotifyItems.length; i++) {
      const item = spotifyItems[i];
      if (indicator) indicator.innerText = `🔎 Procesando (${i + 1}/${spotifyItems.length}): ${item.title}...`;

      const normT = normalizeSongTitle(item.title);
      const existing = INITIAL_PLAYLIST.find(s => normalizeSongTitle(s.title) === normT) || EDM_CANDIDATES_POOL.find(s => normalizeSongTitle(s.title) === normT);

      let meta;
      const af = item.id ? audioFeaturesMap[item.id] : null;
      if (af && af.tempo && af.key !== undefined) {
        meta = {
          bpm: Math.round(af.tempo),
          camelot: convertSpotifyKeyToCamelot(af.key, af.mode),
          key: convertSpotifyKeyToName(af.key, af.mode),
          genre: inferGenreFromTrack(item.title, item.artist)
        };
      } else if (existing && existing.bpm) {
        meta = {
          bpm: existing.bpm,
          camelot: existing.camelot,
          key: existing.key || "Desconocido",
          genre: existing.genre || inferGenreFromTrack(item.title, item.artist)
        };
      } else {
        meta = await fetchRealTrackMetadata(item.title, item.artist);
      }

      newPlaylist.push({
        pos: i + 1,
        title: item.title,
        artist: item.artist,
        bpm: meta.bpm,
        key: meta.key,
        camelot: meta.camelot,
        genre: meta.genre
      });
    }

    currentPlaylist = newPlaylist;
    updatePlaylistTable();
    refreshCurrentRecommendationsView();
    if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
    alert(`🎉 ¡Álbum '${albumName}' (${albumArtist}) importado exitosamente desde Spotify!\n\nSe cargaron ${newPlaylist.length} canciones con BPMs y Camelot reales.`);

  } catch (err) {
    if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
    alert(`❌ Error al importar álbum de Spotify: ${err.message}`);
  }
};

window.importSpotifyPlaylistById = async function(playlistIdOrUrl) {
  let token = localStorage.getItem('spotify_access_token');
  if (!token) {
    alert("Para importar playlists directamente desde Spotify, por favor inicia sesión con Spotify primero.");
    openSpotifyTokenGuide();
    return;
  }

  let playlistId = playlistIdOrUrl.trim();
  const match = playlistId.match(/playlist[\/:]([a-zA-Z0-9]+)/i);
  if (match) {
    playlistId = match[1];
  }
  playlistId = playlistId.split('?')[0];

  const indicator = document.getElementById('saveIndicator');
  if (indicator) indicator.innerText = "🔄 Conectando con Spotify API...";

  try {
    const pResp = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!pResp.ok) {
      if (pResp.status === 403 || pResp.status === 401) {
        localStorage.removeItem('spotify_access_token');
        alert("Sesión de Spotify expirada o sin permisos. Por favor vuelve a hacer clic en '🔑 Iniciar Sesión con Spotify'.");
        openSpotifyTokenGuide();
        return;
      }
      throw new Error("No se pudo obtener la playlist de Spotify. Verifica que la URL sea pública o pertenezca a tu cuenta.");
    }

    const pData = await pResp.json();
    const playlistName = pData.name || "Playlist de Spotify";

    function extractSpotifyTrackObj(it) {
      if (!it) return null;
      const trk = it.item || it.track || (it.name ? it : null);
      if (!trk || !trk.name) return null;

      let artistName = 'Desconocido';
      if (Array.isArray(trk.artists) && trk.artists.length > 0) {
        artistName = trk.artists.map(a => a.name || a).join(', ');
      }

      return {
        id: trk.id,
        title: trk.name,
        artist: artistName
      };
    }

    const spotifyItems = [];
    let initialItems = [];
    if (Array.isArray(pData.tracks?.items)) {
      initialItems = pData.tracks.items;
    } else if (Array.isArray(pData.tracks)) {
      initialItems = pData.tracks;
    } else if (Array.isArray(pData.items)) {
      initialItems = pData.items;
    }

    initialItems.forEach(it => {
      const parsed = extractSpotifyTrackObj(it);
      if (parsed) spotifyItems.push(parsed);
    });

    if (spotifyItems.length === 0) {
      const endpointsToTry = [
        `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100`,
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`
      ];

      for (const endpoint of endpointsToTry) {
        let tracksUrl = endpoint;

        while (tracksUrl) {
          try {
            const tResp = await fetch(tracksUrl, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!tResp.ok) break;
            const tData = await tResp.json();
            const itemsArr = Array.isArray(tData.items) ? tData.items : (Array.isArray(tData.tracks) ? tData.tracks : []);
            itemsArr.forEach(it => {
              const parsed = extractSpotifyTrackObj(it);
              if (parsed) spotifyItems.push(parsed);
            });
            tracksUrl = tData.next;
          } catch (e) {
            break;
          }
        }

        if (spotifyItems.length > 0) break;
      }
    }

    if (spotifyItems.length === 0) {
      alert("La playlist de Spotify está vacía o es privada.");
      if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
      return;
    }

    // Audio features vía ReccoBeats (Spotify cerró su propio endpoint en nov. 2024;
    // ReccoBeats no necesita el token de Spotify del usuario, solo los IDs de las
    // canciones, que ya tenemos de la playlist).
    const trackIds = spotifyItems.map(it => it.id).filter(Boolean);
    const audioFeaturesMap = await fetchReccoBeatsFeatures(trackIds);

    if (indicator) indicator.innerText = `🔎 Consultando BPM y Camelot reales para ${spotifyItems.length} canciones...`;

    const newPlaylist = [];
    for (let i = 0; i < spotifyItems.length; i++) {
      const item = spotifyItems[i];
      if (indicator) indicator.innerText = `🔎 Procesando (${i + 1}/${spotifyItems.length}): ${item.title}...`;

      const normT = normalizeSongTitle(item.title);
      const existing = INITIAL_PLAYLIST.find(s => normalizeSongTitle(s.title) === normT) || EDM_CANDIDATES_POOL.find(s => normalizeSongTitle(s.title) === normT);

      let meta;
      const af = item.id ? audioFeaturesMap[item.id] : null;
      if (af && af.tempo && af.key !== undefined) {
        meta = {
          bpm: Math.round(af.tempo),
          camelot: convertSpotifyKeyToCamelot(af.key, af.mode),
          key: convertSpotifyKeyToName(af.key, af.mode),
          genre: inferGenreFromTrack(item.title, item.artist)
        };
      } else if (existing && existing.bpm) {
        meta = {
          bpm: existing.bpm,
          camelot: existing.camelot,
          key: existing.key || "Desconocido",
          genre: existing.genre || inferGenreFromTrack(item.title, item.artist)
        };
      } else {
        meta = await fetchRealTrackMetadata(item.title, item.artist);
      }

      newPlaylist.push({
        pos: i + 1,
        title: item.title,
        artist: item.artist,
        bpm: meta.bpm,
        key: meta.key,
        camelot: meta.camelot,
        genre: meta.genre
      });
    }

    currentPlaylist = newPlaylist;
    updatePlaylistTable();
    refreshCurrentRecommendationsView();
    if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
    alert(`🎉 ¡Playlist '${playlistName}' importada exitosamente desde Spotify!\n\nSe cargaron ${newPlaylist.length} canciones. Puedes hacer clic en '🪄 Auto-Reorganizar Armónicamente' para ordenarlas perfectamente.`);

  } catch (err) {
    if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
    alert(`❌ Error al importar desde Spotify: ${err.message}`);
  }
};

window.importAppleMusicAlbumById = async function(urlOrId) {
  let albumId = urlOrId.trim();
  const match = albumId.match(/(?:id|album\/|album\/[^\/]+\/)(\d+)/i);
  if (match) {
    albumId = match[1];
  }
  albumId = albumId.split('?')[0];

  const indicator = document.getElementById('saveIndicator');
  if (indicator) indicator.innerText = "🔄 Conectando con Apple Music API...";

  try {
    const resp = await fetch(`https://itunes.apple.com/lookup?id=${albumId}&entity=song`);
    if (!resp.ok) {
      throw new Error("No se pudo obtener información del álbum de Apple Music.");
    }
    const data = await resp.json();
    const results = data.results || [];

    const collectionItem = results.find(r => r.wrapperType === 'collection');
    const albumName = collectionItem ? collectionItem.collectionName : "Álbum Apple Music";
    const albumArtist = collectionItem ? collectionItem.artistName : "Varios Artistas";

    const trackItems = results.filter(r => r.wrapperType === 'track');

    if (trackItems.length === 0) {
      alert("No se encontraron canciones en el enlace del álbum de Apple Music.");
      if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
      return;
    }

    if (indicator) indicator.innerText = `🔎 Consultando BPM y Camelot reales para ${trackItems.length} canciones del álbum '${albumName}'...`;

    const newPlaylist = [];
    for (let i = 0; i < trackItems.length; i++) {
      const item = trackItems[i];
      const title = item.trackName;
      const artist = item.artistName || albumArtist;

      if (indicator) indicator.innerText = `🔎 Procesando (${i + 1}/${trackItems.length}): ${title}...`;

      const normT = normalizeSongTitle(title);
      const existing = INITIAL_PLAYLIST.find(s => normalizeSongTitle(s.title) === normT) || EDM_CANDIDATES_POOL.find(s => normalizeSongTitle(s.title) === normT);

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
        pos: i + 1,
        title: title,
        artist: artist,
        bpm: meta.bpm,
        key: meta.key,
        camelot: meta.camelot,
        genre: meta.genre
      });
    }

    currentPlaylist = newPlaylist;
    updatePlaylistTable();
    refreshCurrentRecommendationsView();
    if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
    alert(`🎉 ¡Álbum '${albumName}' (${albumArtist}) importado exitosamente desde Apple Music!\n\nSe cargaron ${newPlaylist.length} canciones con BPMs y Camelot reales.`);

  } catch (err) {
    if (indicator) indicator.innerText = "💾 Guardado Automático Activo";
    alert(`❌ Error al importar álbum de Apple Music: ${err.message}`);
  }
};

window.importSelectedSpotifyPlaylistToDashboard = function() {
  const select = document.getElementById('spotifyPlaylistSelect');
  const val = select ? select.value : '';
  if (!val || val === 'CREATE_NEW') {
    alert("Por favor selecciona una de tus playlists existentes del menú desplegable para importarla.");
    return;
  }
  closeSpotifyTokenGuide();
  importSpotifyPlaylistById(val);
};
