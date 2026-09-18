// Serverless API handler for Beatport + iTunes + Extended Track Database metadata search
const KEY_TO_CAMELOT = {
  "C Major": "8B", "C Major / A Minor": "8B", "C maj": "8B", "C-major": "8B",
  "G Major": "9B", "G maj": "9B", "G-major": "9B",
  "D Major": "10B", "D maj": "10B", "D-major": "10B",
  "A Major": "11B", "A maj": "11B", "A-major": "11B",
  "E Major": "12B", "E maj": "12B", "E-major": "12B",
  "B Major": "1B", "B maj": "1B", "B-major": "1B",
  "F# Major": "2B", "Gb Major": "2B", "F# maj": "2B", "Gb maj": "2B",
  "Db Major": "3B", "C# Major": "3B", "Db maj": "3B", "C# maj": "3B",
  "Ab Major": "4B", "G# Major": "4B", "Ab maj": "4B", "G# maj": "4B",
  "Eb Major": "5B", "D# Major": "5B", "Eb maj": "5B", "D# maj": "5B",
  "Bb Major": "6B", "A# Major": "6B", "Bb maj": "6B", "A# maj": "6B",
  "F Major": "7B", "F maj": "7B", "F-major": "7B",

  "A Minor": "8A", "A min": "8A", "A-minor": "8A",
  "E Minor": "9A", "E min": "9A", "E-minor": "9A",
  "B Minor": "10A", "B min": "10A", "B-minor": "10A",
  "F# Minor": "11A", "Gb Minor": "11A", "F# min": "11A", "Gb min": "11A",
  "C# Minor": "12A", "Db Minor": "12A", "C# min": "12A", "Db min": "12A",
  "G# Minor": "1A", "Ab Minor": "1A", "G# min": "1A", "Ab min": "1A",
  "D# Minor": "2A", "Eb Minor": "2A", "D# min": "2A", "Eb min": "2A",
  "A# Minor": "3A", "Bb Minor": "3A", "A# min": "3A", "Bb min": "3A",
  "F Minor": "4A", "F min": "4A", "F-minor": "4A",
  "C Minor": "5A", "C min": "5A", "C-minor": "5A",
  "G Minor": "6A", "G min": "6A", "G-minor": "6A",
  "D Minor": "7A", "D min": "7A", "D-minor": "7A",
};

// Tonalidad escrita -> Camelot. Primero el mapa exacto; si el nombre no está ahí (por ejemplo una
// enarmonía como "E# Minor", "B# Minor", "Cb Major" o "Fb Major") se calcula desde la nota, el
// accidente y el modo. Mantener igual que camelotFromKeyName() de js/utils.js.
// Devuelve null si no reconoce la tonalidad: nunca se rellena con un valor por defecto.
const CAMELOT_MAJOR_BY_PITCH = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"];
const CAMELOT_MINOR_BY_PITCH = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"];

function camelotFromKeyName(keyName) {
  if (!keyName || typeof keyName !== 'string') return null;
  if (KEY_TO_CAMELOT[keyName]) return KEY_TO_CAMELOT[keyName];

  const m = keyName.trim().match(/^(do|re|mi|fa|sol|la|si|[a-g])\s*(##|bb|x|#|♯|b|♭)?\s*(mayor|menor|major|minor|maj|min|m)$/i);
  if (!m) return null;
  const base = { do: 0, c: 0, re: 2, d: 2, mi: 4, e: 4, fa: 5, f: 5, sol: 7, g: 7, la: 9, a: 9, si: 11, b: 11 };
  const shift = { '#': 1, '♯': 1, 'b': -1, '♭': -1, '##': 2, 'x': 2, 'bb': -2 };
  const acc = m[2] ? shift[m[2].toLowerCase()] : 0;
  const pitchClass = (((base[m[1].toLowerCase()] + acc) % 12) + 12) % 12;
  const isMajor = /^(mayor|major|maj)$/i.test(m[3]);
  return (isMajor ? CAMELOT_MAJOR_BY_PITCH : CAMELOT_MINOR_BY_PITCH)[pitchClass];
}

// Database of known popular tracks (Bad Bunny, Reggaeton, Pop & Iconic EDM Hits with exact Spotify metadata)
const KNOWN_TRACKS_DB = {
  // Iconic EDM / Dance / Pop (Exact Spotify Data)
  "blame": { bpm: 128, camelot: "5A", key: "C Minor", genre: "EDM / Dance" },
  "without you": { bpm: 128, camelot: "10B", key: "D Major", genre: "EDM / Dance" },
  "turn me on": { bpm: 128, camelot: "5A", key: "C Minor", genre: "EDM / Dance" },
  "i need your love": { bpm: 125, camelot: "5B", key: "Eb Major", genre: "EDM / Dance" },
  "2u": { bpm: 145, camelot: "1A", key: "Ab Minor", genre: "EDM / Dance" },
  "drinking from the bottle": { bpm: 128, camelot: "8A", key: "A Minor", genre: "EDM / Dance" },
  "outside": { bpm: 128, camelot: "7A", key: "D Minor", genre: "EDM / Dance" },
  "stereo love": { bpm: 127, camelot: "2A", key: "Eb Minor", genre: "Dance" },
  "21 reasons": { bpm: 124, camelot: "2B", key: "F# Major", genre: "EDM / Dance" },
  "no money": { bpm: 126, camelot: "3B", key: "Db Major", genre: "EDM / Dance" },
  "overdrive": { bpm: 127, camelot: "3B", key: "Db Major", genre: "EDM / Dance" },
  "the motto": { bpm: 120, camelot: "3A", key: "Bb Minor", genre: "EDM / Dance" },

  // Bad Bunny - DeBÍ TIRAR MÁs FOToS (2025/2026)
  "nuevayol": { bpm: 125, camelot: "6A", key: "G Minor", genre: "Urbano latino" },
  "voy a llevarte pa pr": { bpm: 100, camelot: "9A", key: "E Minor", genre: "Urbano latino" },
  "baile inolvidable": { bpm: 178, camelot: "8A", key: "A Minor", genre: "Latin" },
  "perfumito nuevo": { bpm: 110, camelot: "7B", key: "F Major", genre: "Reggaeton / Urbano" },
  "weltita": { bpm: 150, camelot: "12A", key: "C# Minor", genre: "Latin" },
  "velda": { bpm: 182, camelot: "6A", key: "G Minor", genre: "Techno / Urbano" },
  "el club": { bpm: 111, camelot: "3A", key: "A# Minor", genre: "Latin" },
  "ketu tecre": { bpm: 104, camelot: "3B", key: "Db Major", genre: "Reggaeton / Urbano" },
  "bokete": { bpm: 115, camelot: "9B", key: "G Major", genre: "Urbano latino" },
  "kloufrens": { bpm: 92, camelot: "8B", key: "C Major", genre: "Latin" },
  "turista": { bpm: 65, camelot: "3B", key: "Db Major", genre: "Latin" },
  "cafe con ron": { bpm: 133, camelot: "7A", key: "D Minor", genre: "Latin" },
  "pitorro de coco": { bpm: 98, camelot: "10A", key: "B Minor", genre: "Latin" },
  "lo que le paso a hawaii": { bpm: 170, camelot: "10A", key: "B Minor", genre: "Latin" },
  "eoo": { bpm: 102, camelot: "12A", key: "C# Minor", genre: "Latin" },

  // Bad Bunny - Un Verano Sin Ti
  "tití me preguntó": { bpm: 111, camelot: "5A", key: "C Minor", genre: "Dembow / Reggaeton" },
  "titi me pregunto": { bpm: 111, camelot: "5A", key: "C Minor", genre: "Dembow / Reggaeton" },
  "me porto bonito": { bpm: 92, camelot: "8A", key: "A Minor", genre: "Reggaeton" },
  "mosqura": { bpm: 118, camelot: "10A", key: "B Minor", genre: "Reggaeton" },
  "ojitos lindos": { bpm: 79, camelot: "12A", key: "C# Minor", genre: "Indie Pop / Latin" },
  "efecto": { bpm: 100, camelot: "8A", key: "A Minor", genre: "Reggaeton" },
  "party": { bpm: 97, camelot: "9A", key: "E Minor", genre: "Reggaeton" },
  "tarot": { bpm: 114, camelot: "6A", key: "G Minor", genre: "Reggaeton" },
  "la corriente": { bpm: 98, camelot: "4A", key: "F Minor", genre: "Reggaeton" },
  "nevera": { bpm: 126, camelot: "8B", key: "C Major", genre: "House / Latin" },
  "después de la playa": { bpm: 154, camelot: "11A", key: "F# Minor", genre: "Mambo / Latin" },

  // Karol G
  "tusa": { bpm: 101, camelot: "6A", key: "G Minor", genre: "Reggaeton" },
  "provenza": { bpm: 111, camelot: "2A", key: "Eb Minor", genre: "Afrobeats / Pop" },
  "qlona": { bpm: 85, camelot: "10A", key: "B Minor", genre: "Reggaeton" },
  "amargura": { bpm: 96, camelot: "1A", key: "Ab Minor", genre: "Reggaeton" },
  "bichota": { bpm: 164, camelot: "4A", key: "F Minor", genre: "Reggaeton" },

  // Pop / Global Hits
  "blinding lights": { bpm: 171, camelot: "4A", key: "F Minor", genre: "Synthpop" },
  "as it was": { bpm: 174, camelot: "11B", key: "A Major", genre: "Pop" },
  "levitating": { bpm: 103, camelot: "10A", key: "B Minor", genre: "Pop / Disco" },
  "flowers": { bpm: 118, camelot: "8A", key: "A Minor", genre: "Pop" }
};

function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, ""); // Remove punctuation
}

function getKnownTrackMetadata(title, artist) {
  const normT = normalizeString(title);
  if (!normT) return null;

  for (const [key, meta] of Object.entries(KNOWN_TRACKS_DB)) {
    const normK = normalizeString(key);
    if (normT === normK || normT.includes(normK) || normK.includes(normT)) {
      return meta;
    }
  }
  return null;
}

// NOTA HONESTIDAD DE DATOS: Antes esta función inventaba un BPM/Camelot
// "plausible" a partir de un hash del título cuando no se encontraba dato real.
// Eso generaba números con apariencia de dato verificado pero SIN relación
// alguna con la canción real, y el resto de la app no tenía forma de
// distinguirlo de un dato real (mismo tag "Beatport Verificado" para ambos).
// Se elimina esa fabricación: cuando no hay dato real, se devuelve null y
// se marca verified:false explícitamente, para que la interfaz lo muestre
// como "sin verificar" en vez de como un dato confiable.

async function searchBeatport(query) {
  try {
    const url = `https://www.beatport.com/search?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (resp.ok) {
      const html = await resp.text();
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
      if (match) {
        const data = JSON.parse(match[1]);
        const queries = data?.props?.pageProps?.dehydratedState?.queries || [];
        for (const q of queries) {
          const state = q?.state?.data;
          if (state && typeof state === 'object' && state.tracks) {
            const trackList = state.tracks.data || [];
            if (trackList.length > 0) {
              const t = trackList[0];
              const bpm = Number(t.bpm);
              const keyName = t.key_name || (typeof t.key === 'object' && t.key ? t.key.name : null);
              const camelot = camelotFromKeyName(keyName);
              // Sin BPM real o sin una tonalidad que se pueda interpretar no hay dato verificable:
              // se devuelve null (queda verified:false) en vez de rellenar con un valor por defecto.
              if (!(bpm > 0) || !camelot) return null;
              const mix = t.mix_name || '';
              const lengthSec = Math.round((t.length || 0) / 1000);
              const isExtended = mix.toLowerCase().includes('extended') || mix.toLowerCase().includes('club') || lengthSec >= 260;
              const genre = t.genre ? (typeof t.genre === 'object' ? t.genre.name : t.genre) : (t.genre_name || "EDM / Dance");
              return { bpm, key: keyName, camelot, mix, lengthSec, isExtended, genre };
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Error Beatport Vercel:", e);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Falta parametro q' });
  }

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=10`;
    const itunesResp = await fetch(itunesUrl);
    const itunesData = await itunesResp.json();
    const results = itunesData.results || [];
    const enriched = [];

    for (const item of results) {
      const tName = item.trackName;
      const aName = item.artistName;
      const durSec = Math.round((item.trackTimeMillis || 0) / 1000);
      const genre = item.primaryGenreName || "EDM / Dance";

      // 1. Check known metadata database first (curated, hand-verified values)
      const knownMeta = getKnownTrackMetadata(tName, aName);

      // 2. Check Beatport (real scrape, for EDM tracks)
      let bpData = null;
      if (!knownMeta) {
        try {
          bpData = await searchBeatport(`${tName} ${aName}`);
        } catch (e) {}
      }

      let bpm = null, camelot = null, key = null, source = "none", verified = false;
      let isExtended = (durSec >= 240);

      if (knownMeta) {
        bpm = knownMeta.bpm;
        camelot = knownMeta.camelot;
        key = knownMeta.key;
        source = "known_db";
        verified = true;
      } else if (bpData && bpData.bpm) {
        bpm = bpData.bpm;
        camelot = bpData.camelot;
        key = bpData.key;
        isExtended = bpData.isExtended;
        source = "beatport";
        verified = true;
      }
      // Ya NO hay paso 3 de fabricación de datos. Si no se encontró nada real,
      // bpm/camelot/key quedan en null y verified queda en false.

      enriched.push({
        title: tName,
        artist: aName,
        bpm,
        camelot,
        key,
        durSec,
        isExtended,
        genre,
        source,
        verified
      });
    }

    return res.status(200).json({ results: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
