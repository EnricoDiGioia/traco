'use strict';
/* ===== Utilidades ===== */
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

function icon(name, cls = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('class', ('ic ' + cls).trim());
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(ns, 'use');
  u.setAttribute('href', '#i-' + name);
  s.append(u);
  return s;
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Imagem inválida'));
    im.src = src;
  });
}

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

function canvasToBlob(c, type, q) {
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Falha ao gerar imagem'))), type, q));
}

/* Lê uma imagem do usuário, reduz se for enorme e devolve dataURL + tamanho */
async function readImageFile(file, max = 2400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const w = img.naturalWidth, hh = img.naturalHeight;
    const k = Math.min(1, max / Math.max(w, hh));
    const alpha = /png|gif|webp|svg/.test(file.type);
    if (k === 1 && file.size < 1.6e6 && /png|jpe?g|gif|webp/.test(file.type)) {
      return { data: await blobToDataURL(file), w, h: hh };
    }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(hh * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.88), w: c.width, h: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function pickFiles(accept, multiple = false) {
  return new Promise(res => {
    const inp = h('input', { type: 'file', accept, style: { position: 'fixed', left: '-9999px' } });
    if (multiple) inp.multiple = true;
    inp.addEventListener('change', () => { res([...inp.files]); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

function timeAgo(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'agora';
  if (d < 3600) return `há ${Math.floor(d / 60)} min`;
  if (d < 86400) return `há ${Math.floor(d / 3600)} h`;
  if (d < 86400 * 7) { const n = Math.floor(d / 86400); return n === 1 ? 'ontem' : `há ${n} dias`; }
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function safeName(s) {
  return (s || 'caderno').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'caderno';
}

/* ===== Banco local (IndexedDB, com memória como reserva) ===== */
const DB = (() => {
  const STORES = ['meta', 'content', 'assets', 'kv'];
  let dbp = null, mem = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open('traco-notas', 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('bloqueado'));
    });
    return dbp;
  }
  const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function os(name, mode) { const d = await open(); return d.transaction(name, mode).objectStore(name); }
  return {
    async init() {
      try {
        await Promise.race([open(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
        try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ok */ }
        return true;
      } catch (e) {
        mem = {}; STORES.forEach(s => (mem[s] = new Map()));
        return false;
      }
    },
    get volatile() { return !!mem; },
    async get(s, id) { if (mem) return mem[s].get(id); return wrap((await os(s, 'readonly')).get(id)); },
    async put(s, v) { if (mem) { mem[s].set(v.id, v); return; } return wrap((await os(s, 'readwrite')).put(v)); },
    async del(s, id) { if (mem) { mem[s].delete(id); return; } return wrap((await os(s, 'readwrite')).delete(id)); },
    async all(s) { if (mem) return [...mem[s].values()]; return wrap((await os(s, 'readonly')).getAll()); },
    async keys(s) { if (mem) return [...mem[s].keys()]; return wrap((await os(s, 'readonly')).getAllKeys()); },
  };
})();

async function kvGet(k, def) { try { const r = await DB.get('kv', k); return r ? r.v : def; } catch (e) { return def; } }
async function kvSet(k, v) { try { await DB.put('kv', { id: k, v }); } catch (e) { /* ok */ } }

/* ===== Imagens e figurinhas guardadas ===== */
const Assets = {
  cache: new Map(),
  onReady: null,
  async add(data, kind, extra) {
    const id = uid('a_');
    await DB.put('assets', Object.assign({ id, data, kind }, extra || {}));
    return id;
  },
  load(id) {
    let e = this.cache.get(id);
    if (e) return e.p;
    e = { el: null };
    e.p = (async () => {
      let data;
      if (id.startsWith('b:')) {
        const svg = BUILTIN_STICKERS[id.slice(2)];
        if (!svg) return null;
        data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.svg);
      } else {
        const a = await DB.get('assets', id);
        if (!a) return null;
        data = a.data;
      }
      try {
        const img = await loadImg(data);
        let el = img;
        if (id.startsWith('b:')) {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth * 2; c.height = img.naturalHeight * 2;
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          el = c;
        }
        e.el = el;
        if (this.onReady) this.onReady(id);
        return el;
      } catch (err) { return null; }
    })();
    this.cache.set(id, e);
    return e.p;
  },
  get(id) {
    const e = this.cache.get(id);
    if (e) return e.el;
    this.load(id);
    return null;
  },
  async ensure(ids) { await Promise.all([...new Set(ids)].map(id => this.load(id))); },
};

/* ===== Fontes importadas pelo usuário ===== */
const CustomFonts = {
  list: [],
  async init() {
    this.list = await kvGet('fonts', []);
    await Promise.all(this.list.map(f => this.register(f)));
  },
  async register(f) {
    try {
      const a = await DB.get('assets', f.asset);
      if (!a) return;
      const ff = new FontFace('TracoF-' + f.id, `url(${a.data})`);
      await ff.load();
      document.fonts.add(ff);
    } catch (e) { /* fonte inválida */ }
  },
  async add(file) {
    const data = await blobToDataURL(file);
    const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Fonte';
    const asset = await Assets.add(data, 'font');
    const f = { id: uid('c_'), name, asset };
    await this.register(f);
    this.list.push(f);
    await kvSet('fonts', this.list);
    return f;
  },
  async remove(id) {
    this.list = this.list.filter(f => f.id !== id);
    await kvSet('fonts', this.list);
  },
};
