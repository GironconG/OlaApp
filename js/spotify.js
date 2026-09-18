// spotify.js - Autenticación OAuth PKCE, Sincronización y Búsqueda Manual en Spotify
window.openSpotifyTokenGuide = async function() {
  document.getElementById('spotifyTokenModal').style.display = 'flex';
  const savedToken = localStorage.getItem('spotify_access_token');
  if (savedToken) {
    await checkAndLoadSpotifyUser(savedToken);
  }
};

window.closeSpotifyTokenGuide = function() {
  document.getElementById('spotifyTokenModal').style.display = 'none';
  const statusBox = document.getElementById('spotifySyncStatus');
  if (statusBox) statusBox.style.display = 'none';
};

window.handlePlaylistSelectChange = function(val) {
  const group = document.getElementById('newPlaylistNameGroup');
  if (group) {
    group.style.display = (val === 'CREATE_NEW') ? 'block' : 'none';
  }
};

async function checkAndLoadSpotifyUser(token) {
  const infoBar = document.getElementById('spotifyUserInfoBar');
  try {
    const userResp = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!userResp.ok) throw new Error("Sesión expirada");
    const userData = await userResp.json();

    if (infoBar) {
      infoBar.style.display = 'block';
      infoBar.innerHTML = `🟢 Conectado como: <b>${userData.display_name || userData.id}</b> (${userData.email || 'Usuario Spotify'}) — Selecciona una playlist abajo y pulsa 'Sincronizar':`;
    }

    await loadAllSpotifyPlaylists(token);
  } catch(e) {
    if (infoBar) infoBar.style.display = 'none';
    localStorage.removeItem('spotify_access_token');
  }
}

async function loadAllSpotifyPlaylists(token) {
  const select = document.getElementById('spotifyPlaylistSelect');
  if (!select) return;

  select.innerHTML = `<option value="CREATE_NEW">➕ Crear Nueva Playlist (Nombre personalizado)</option>`;
  let url = 'https://api.spotify.com/v1/me/playlists?limit=50';

  while (url) {
    try {
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) break;
      const data = await resp.json();
      const items = data.items || [];
      items.forEach(p => {
        if (p && p.id && p.name) {
          const num = p.tracks && typeof p.tracks.total === 'number' ? p.tracks.total : (p.tracks_total || null);
          const label = (num !== null && num > 0) ? ` (${num} canciones)` : '';
          select.innerHTML += `<option value="${p.id}">📑 ${p.name}${label}</option>`;
        }
      });
      url = data.next;
    } catch(e) {
      break;
    }
  }
}

window.loginWithSpotify = async function() {
  localStorage.removeItem('spotify_access_token');
  const codeVerifier = generateRandomString(64);
  sessionStorage.setItem('spotify_code_verifier', codeVerifier);

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  const redirectUri = window.location.origin + window.location.pathname;
  const scopes = "playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative";

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: scopes,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
    show_dialog: 'true'
  }).toString();

  window.location.href = authUrl.toString();
};

async function checkSpotifyAuthCode() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
    const redirectUri = window.location.origin + window.location.pathname;

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        localStorage.setItem('spotify_access_token', data.access_token);
        window.history.replaceState(null, null, window.location.pathname);
        setTimeout(() => {
          openSpotifyTokenGuide();
        }, 500);
      } else {
        alert("Error al autenticar en Spotify: " + (data.error_description || data.error));
      }
    } catch (e) {
      console.error("Error PKCE token exchange:", e);
    }
  }
}

async function searchSpotifyTrackUri(token, query) {
  if (!query || query.trim().length < 2) return null;
  try {
    const searchResp = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (searchResp.ok) {
      const sData = await searchResp.json();
      const items = sData?.tracks?.items || [];
      if (items.length > 0) {
        return items[0].uri;
      }
    }
  } catch (e) {}
  return null;
}

let currentSearchingIndex = -1;

window.openManualSearchForIndex = function(index) {
  const s = currentPlaylist[index];
  if (!s) return;
  currentSearchingIndex = index;
  document.getElementById('manualSpotifySearchModal').style.display = 'flex';
  document.getElementById('manualSearchTargetInfo').innerHTML = `Reemplazar canción <b>#${index + 1}: ${s.title} — ${s.artist}</b>`;
  document.getElementById('manualSpotifyQueryInput').value = `${s.title} ${s.artist}`;
  performManualSpotifySearch();
};

window.closeManualSpotifySearchModal = function() {
  document.getElementById('manualSpotifySearchModal').style.display = 'none';
};

window.performManualSpotifySearch = async function() {
  const query = document.getElementById('manualSpotifyQueryInput').value.trim();
  const container = document.getElementById('manualSpotifySearchResults');
  if (!query) return;

  const token = localStorage.getItem('spotify_access_token');
  if (!token) {
    container.innerHTML = `<div style="color:var(--accent-red); padding:10px;">Inicia sesión con Spotify primero.</div>`;
    return;
  }

  container.innerHTML = `<div style="padding:15px; text-align:center;">🔍 Buscando '${query}' en catálogo de Spotify...</div>`;

  try {
    const resp = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=6`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error("Error en Spotify search API");
    const data = await resp.json();
    const items = data.tracks?.items || [];

    if (items.length === 0) {
      container.innerHTML = `<div style="color:var(--accent-yellow); padding:15px; text-align:center;">No se encontraron canciones en Spotify para '${query}'. Intenta simplificar el nombre.</div>`;
      return;
    }

    let html = '';
    items.forEach(tr => {
      const art = tr.artists.map(a => a.name).join(', ');
      const title = tr.name;
      const albumImg = tr.album?.images?.[2]?.url || tr.album?.images?.[0]?.url || '';

      html += `
        <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-color); border-radius:10px; padding:10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            ${albumImg ? `<img src="${albumImg}" style="width:36px; height:36px; border-radius:6px;">` : ''}
            <div>
              <div style="font-weight:700; color:#fff; font-size:13px;">${title}</div>
              <div style="font-size:11px; color:var(--text-muted);">${art}</div>
            </div>
          </div>
          <button class="btn btn-secondary" style="font-size:11px; padding:6px 12px; color:var(--accent-green); border-color:rgba(0,255,135,0.3);" onclick="selectManualSpotifyTrack('${encodeURIComponent(title)}', '${encodeURIComponent(art)}')">
            ✅ Seleccionar
          </button>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = `<div style="color:var(--accent-red); padding:10px;">Error: ${e.message}</div>`;
  }
};

window.selectManualSpotifyTrack = function(encTitle, encArtist) {
  const title = decodeURIComponent(encTitle);
  const artist = decodeURIComponent(encArtist);

  if (currentSearchingIndex >= 0 && currentSearchingIndex < currentPlaylist.length) {
    currentPlaylist[currentSearchingIndex].title = title;
    currentPlaylist[currentSearchingIndex].artist = artist;
    delete currentPlaylist[currentSearchingIndex].notFoundOnSpotify;
    updatePlaylistTable();
    closeManualSpotifySearchModal();
    renderMissingTracksPanel();
    alert(`✨ Canción #${currentSearchingIndex + 1} actualizada a '${title} - ${artist}'. Pulsa '🚀 Sincronizar Playlist' para enviar los cambios.`);
  }
};

window.replaceWithHarmonicCandidate = function(index) {
  const s = currentPlaylist[index];
  if (!s) return;

  const cand = EDM_CANDIDATES_POOL.find(c => {
    return !checkIsDuplicate(c.title).isDuplicate && Math.abs(c.bpm - s.bpm) <= 3;
  }) || EDM_CANDIDATES_POOL[0];

  if (cand) {
    currentPlaylist[index] = {
      ...s,
      title: cand.title,
      artist: cand.artist,
      bpm: cand.bpm,
      camelot: cand.camelot,
      isNew: true
    };
    delete currentPlaylist[index].notFoundOnSpotify;
    updatePlaylistTable();
    renderMissingTracksPanel();
    alert(`✨ Canción #${index + 1} reemplazada armónicamente por: '${cand.title} - ${cand.artist}' (BPM: ${cand.bpm}, Camelot: ${cand.camelot}).`);
  }
};

function renderMissingTracksPanel() {
  const panel = document.getElementById('spotifyMissingTracksPanel');
  const list = document.getElementById('missingTracksList');
  const countElem = document.getElementById('missingTracksCount');
  if (!panel || !list) return;

  const missing = [];
  currentPlaylist.forEach((s, idx) => {
    if (s.notFoundOnSpotify) {
      missing.push({ index: idx, track: s });
    }
  });

  if (missing.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  countElem.innerText = missing.length;

  let html = '';
  missing.forEach(item => {
    html += `
      <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,0,85,0.3); border-radius:8px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div style="flex:1;">
          <div style="font-size:12px; font-weight:700; color:#fff;">#${item.index + 1}: ${item.track.title}</div>
          <div style="font-size:11px; color:var(--text-muted);">${item.track.artist}</div>
        </div>
        <div style="display:flex; gap:4px;">
          <button class="btn btn-secondary" style="font-size:10px; padding:4px 8px; color:var(--accent-cyan);" onclick="openManualSearchForIndex(${item.index})" title="Buscar alternativa en Spotify">🔍 Buscar</button>
          <button class="btn btn-secondary" style="font-size:10px; padding:4px 8px; color:var(--accent-purple);" onclick="replaceWithHarmonicCandidate(${item.index})" title="Reemplazar armónicamente">✨ Reemplazar</button>
          <button class="btn-del" style="font-size:12px;" onclick="deleteMissingTrackFromPanel(${item.index})" title="Quitar canción de la lista">✕</button>
        </div>
      </div>
    `;
  });
  list.innerHTML = html;
}

window.deleteMissingTrackFromPanel = function(index) {
  deleteTrack(index);
  renderMissingTracksPanel();
};

window.removeAllMissingTracks = function() {
  if (confirm("¿Eliminar de la playlist actual todas las canciones no encontradas en Spotify?")) {
    currentPlaylist = currentPlaylist.filter(s => !s.notFoundOnSpotify);
    updatePlaylistTable();
    renderMissingTracksPanel();
  }
};

window.executeSpotifySync = async function() {
  let token = localStorage.getItem('spotify_access_token');
  const manualInput = document.getElementById('spotifyTokenInput')?.value.trim();
  if (manualInput) {
    token = manualInput;
    localStorage.setItem('spotify_access_token', manualInput);
  }

  if (!token) {
    alert("Por favor inicia sesión con Spotify primero o pega tu token manual.");
    return;
  }

  const statusBox = document.getElementById('spotifySyncStatus');
  statusBox.style.display = 'block';
  statusBox.innerHTML = `🔄 Verificando sesión con Spotify API...`;

  try {
    const userResp = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!userResp.ok) throw new Error("Sesión de Spotify expirada. Vuelve a iniciar sesión.");
    const userData = await userResp.json();

    const playlistSelect = document.getElementById('spotifyPlaylistSelect');
    const selectedOption = playlistSelect ? playlistSelect.value : 'CREATE_NEW';

    let targetPlaylistId = null;
    let targetPlaylistName = "";
    let targetPlaylistUrl = "";

    if (selectedOption === 'CREATE_NEW') {
      const customName = document.getElementById('newPlaylistNameInput')?.value.trim() || "Playlist EDM Sube-Baja (Automix)";
      statusBox.innerHTML = `➕ Creando nueva playlist: '${customName}'...`;

      let createResp = await fetch(`https://api.spotify.com/v1/me/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: customName,
          description: "Playlist sincronizada con Ola Pro EDM Automix ordenadas por Curva BPM y Camelot",
          public: true
        })
      });

      if (!createResp.ok && createResp.status === 403) {
        createResp = await fetch(`https://api.spotify.com/v1/me/playlists`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: customName,
            description: "Playlist sincronizada con Ola Pro EDM Automix ordenadas por Curva BPM y Camelot",
            public: false
          })
        });
      }

      if (!createResp.ok) {
        const errJson = await createResp.json().catch(() => ({}));
        if (createResp.status === 403) {
          localStorage.removeItem('spotify_access_token');
          throw new Error("Spotify rechazó los permisos (Error 403). Por favor vuelve a hacer clic en '🔑 Iniciar Sesión con Spotify' para otorgar permisos.");
        }
        throw new Error(errJson.error?.message || "No se pudo crear la playlist en Spotify.");
      }

      const pData = await createResp.json();
      targetPlaylistId = pData.id;
      targetPlaylistName = pData.name;
      targetPlaylistUrl = pData.external_urls?.spotify;
    } else {
      targetPlaylistId = selectedOption;
      const selectedIndex = playlistSelect.selectedIndex;
      targetPlaylistName = playlistSelect.options[selectedIndex].text;
      targetPlaylistUrl = `https://open.spotify.com/playlist/${targetPlaylistId}`;
    }

    statusBox.innerHTML = `🔎 Buscando ${currentPlaylist.length} canciones en catálogo de Spotify...`;
    const uris = [];
    let foundCount = 0;
    const missingList = [];

    for (let i = 0; i < currentPlaylist.length; i++) {
      const s = currentPlaylist[i];
      s.notFoundOnSpotify = false;
      statusBox.innerHTML = `🔎 Buscando (${i + 1}/${currentPlaylist.length}): ${s.title}...`;

      let trackUri = null;
      trackUri = await searchSpotifyTrackUri(token, `${s.title} ${s.artist}`);

      if (!trackUri) {
        const cleanT = s.title.replace(/\[.*?\]|\(.*?\)/g, '').replace(/feat\..*|ft\..*/gi, '').trim();
        const cleanA = s.artist.split(/,|&|feat\./i)[0].trim();
        trackUri = await searchSpotifyTrackUri(token, `${cleanT} ${cleanA}`);
      }

      if (!trackUri) {
        const cleanT = s.title.replace(/\[.*?\]|\(.*?\)/g, '').replace(/feat\..*|ft\..*/gi, '').trim();
        trackUri = await searchSpotifyTrackUri(token, cleanT);
      }

      if (trackUri) {
        uris.push(trackUri);
        foundCount++;
      } else {
        s.notFoundOnSpotify = true;
        missingList.push({ index: i, title: s.title, artist: s.artist });
      }
    }

    updatePlaylistTable();
    renderMissingTracksPanel();

    statusBox.innerHTML = `⚡ Sincronizando ${uris.length} canciones encontradas en '${targetPlaylistName}'...`;
    if (uris.length > 0) {
      const batchSize = 100;
      const targetEndpoints = [
        `https://api.spotify.com/v1/playlists/${targetPlaylistId}/items`,
        `https://api.spotify.com/v1/playlists/${targetPlaylistId}/tracks`
      ];

      for (let offset = 0; offset < uris.length; offset += batchSize) {
        const batch = uris.slice(offset, offset + batchSize);
        let batchSuccess = false;
        let lastErrorMessage = "";

        const preferredMethods = (offset === 0 && selectedOption !== 'CREATE_NEW') ? ['PUT', 'POST'] : ['POST'];

        for (const method of preferredMethods) {
          for (const endpoint of targetEndpoints) {
            try {
              const writeResp = await fetch(endpoint, {
                method: method,
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uris: batch })
              });

              if (writeResp.ok) {
                batchSuccess = true;
                break;
              } else {
                const pErr = await writeResp.json().catch(() => ({}));
                lastErrorMessage = pErr.error?.message || `Status HTTP ${writeResp.status}`;
              }
            } catch (e) {
              lastErrorMessage = e.message;
            }
          }
          if (batchSuccess) break;
        }

        if (!batchSuccess) {
          if (lastErrorMessage.includes('403') || lastErrorMessage.toLowerCase().includes('forbidden') || lastErrorMessage.toLowerCase().includes('scope') || lastErrorMessage.toLowerCase().includes('permission')) {
            localStorage.removeItem('spotify_access_token');
            throw new Error("Spotify rechazó los permisos de escritura (Error 403). Hemos limpiado la sesión anterior guardada en tu navegador. Por favor vuelve a hacer clic en '🔑 Iniciar Sesión con Spotify' para otorgar todos los permisos requeridos.");
          }
          throw new Error(`Error al enviar canciones a Spotify: ${lastErrorMessage}`);
        }
      }
    }

    if (missingList.length > 0) {
      statusBox.innerHTML = `⚠️ Sincronizadas ${foundCount} de ${currentPlaylist.length} canciones. Hay ${missingList.length} no encontradas.`;
      alert(`⚠️ Sincronización realizada en Spotify:\n\n• Canciones enviadas: ${foundCount} de ${currentPlaylist.length}\n• Canciones NO encontradas (${missingList.length}):\n${missingList.map(m => " - #" + (m.index + 1) + ": " + m.title + " (" + m.artist + ")").join("\n")}\n\nPuedes verlas en el panel rojo dentro de este modal o en la tabla para buscar alternativas manualmente (🔍), reemplazarlas por temas armónicos (✨) o eliminarlas (✕).`);
    } else {
      statusBox.innerHTML = `✅ ¡Sincronización 100% completa con éxito!`;
      alert(`🚀 ¡Sincronización Exitosa con Spotify!\n\nPlaylist: '${targetPlaylistName}'\nLas ${foundCount} canciones fueron encontradas y sincronizadas en orden armónico.\n\nEnlace: ${targetPlaylistUrl}`);
      window.open(targetPlaylistUrl, '_blank');
      closeSpotifyTokenGuide();
    }

  } catch (err) {
    statusBox.style.display = 'none';
    alert(`❌ Error al conectar con Spotify API: ${err.message}`);
  }
};

window.syncToAppleMusic = function() {
  const lines = currentPlaylist.map(s => `${s.title} - ${s.artist}`).join('\n');
  navigator.clipboard.writeText(lines);
  alert("🍎 ¡Lista copiada al portapapeles!\n\nSerás redirigido a TuneMyMusic (Gratis). Elige 'Free Text' como origen, pega el texto y selecciona Apple Music como destino.");
  window.open('https://www.tunemymusic.com/', '_blank');
};
