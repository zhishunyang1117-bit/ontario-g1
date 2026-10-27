(function () {
  'use strict';

  // ── 基础工具 ─────────────────────────────────────────────────────────
  const $ = selector => document.querySelector(selector);
  const view = $('#view');
  const KEYS = ['A', 'B', 'C', 'D'];
  const GROUPS = META.groups || [];
  const byId = Object.assign(Object.create(null), Object.fromEntries(BANK.map(q => [q.id, q])));
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const storage = {
    get(key, fallback) {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) {
        if (!storage.warned) {
          storage.warned = true;
          setTimeout(() => toast('浏览器没有保存练习记录（可能是无痕模式或存储已满），关闭页面后本次记录会丢失。'), 0);
        }
        return false;
      }
    },
  };
  const finiteCount = n => Number.isFinite(Number(n)) ? Math.min(10000000, Math.max(0, Math.floor(Number(n)))) : 0;
  const safeMap = (value, transform) => {
    const result = {};
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.keys(value).forEach(id => { if (byId[id]) { const v = transform(value[id]); if (v != null) result[id] = v; } });
    }
    return result;
  };
  const cleanHist = value => safeMap(value, v => v && typeof v === 'object' ? { c: finiteCount(v.c), w: finiteCount(v.w) } : null);
  const cleanWrong = value => safeMap(value, v => finiteCount(v) || null);
  const cleanBookmarks = value => safeMap(value, v => v ? true : null);
  const cleanNotes = value => safeMap(value, v => typeof v === 'string' ? v.slice(0, 4000) : null);
  const cleanLang = (value, fallback = 'both') => ['both', 'en', 'zh'].includes(value) ? value : fallback;
  const MODES = ['exam', 'practice', 'wrong', 'bookmarks', 'review', 'sprint'];
  const cleanPart = p => p && typeof p === 'object' && finiteCount(p.n) > 0 ? { c: Math.min(finiteCount(p.c), finiteCount(p.n)), n: finiteCount(p.n) } : undefined;
  const shuffle = values => { const a = values.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const ratio = (n, d) => d ? Math.round(n / d * 100) : 0;
  const pad2 = n => String(n).padStart(2, '0');
  const timeLabel = sec => {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    return `${h ? `${h}:` : ''}${pad2(m)}:${pad2(s)}`;
  };
  const groupLabel = id => (GROUPS.find(g => g.id === id) || {}).title_zh || id;
  const shortGroups = { LA: '驾照与分级制度', LB: '扣分与驾驶处罚', RA: '日常驾驶准备', RB: '共享道路', RC: '路口与转向', RD: '停车与高速公路', RE: '天气与紧急情况', SA: '规章与禁令标志', SB: '警告标志', SC: '施工与指示标志', SD: '信号灯与路面标线' };
  const shortName = id => shortGroups[id] || groupLabel(id);
  const difficultyNames = { easy: '基础', medium: '进阶', hard: '挑战' };
  const sectionNames = { signs: '道路标志', rules: '交通规则' };
  const groupIcons = { LA: 'id', LB: 'shield', RA: 'car', RB: 'users', RC: 'turn', RD: 'parking', RE: 'cloud', SA: 'stop', SB: 'warning', SC: 'cone', SD: 'traffic' };
  const icons = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', back: '<path d="M19 12H5m6-6-6 6 6 6"/>', chevron: '<path d="m9 5 7 7-7 7"/>', chevronLeft: '<path d="m15 5-7 7 7 7"/>',
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
    bookmark: '<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>', flag: '<path d="M5 21V4m0 0h12.5l-2.8 4.5 2.8 4.5H5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    book: '<path d="M12 6.5C10.4 5 8 4.5 4 4.5v14c4 0 6.4.5 8 2m0-14c1.6-1.5 4-2 8-2v14c-4 0-6.4.5-8 2m0-14v14"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6"/>', bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    gear: '<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2m0 15v2M2.5 12h2m15 0h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>', upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
    external: '<path d="M14 4h6v6m0-6-9 9M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>', trophy: '<path d="M8 3.5h8v5a4 4 0 0 1-8 0zM8 5.5H4.5v2A3.5 3.5 0 0 0 8 11m8-5.5h3.5v2A3.5 3.5 0 0 1 16 11M12 12.5v5m-4 3.5h8m-6-3.5h4"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10.5" r="2"/><path d="M5.5 16c.5-2.4 5.5-2.4 6 0m2.5-6.5h4m-4 4h3"/>', shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    car: '<path d="m5 10 2-5h10l2 5M3.5 10h17v7.5h-17zM6 17.5V20m12-2.5V20M6.5 13.5h2m7 0h2"/>', users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20m1.5-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 2.5 4.5V20"/>',
    turn: '<path d="M6 21V10a3.5 3.5 0 0 1 3.5-3.5H19m-4.5-4 4.5 4-4.5 4"/>', parking: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5"/>', cloud: '<path d="M7 17a4 4 0 0 1-.8-7.9A6.5 6.5 0 0 1 18.5 8 4.5 4.5 0 0 1 17.5 17zM8 20.5l-1 1.5m5.5-1.5-1 1.5m5.5-1.5-1 1.5"/>',
    stop: '<path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"/><path d="M7.5 12h9"/>', warning: '<path d="m12 3.5 9.5 16.5h-19z"/><path d="M12 10v4.5m0 2.5v.1"/>', cone: '<path d="m12 3 6.5 16.5h-13zM8.2 12.5h7.6M3.5 20.5h17M10 7.5h4"/>',
    traffic: '<rect x="7.5" y="2.5" width="9" height="17" rx="3"/><circle cx="12" cy="6.5" r="1.2"/><circle cx="12" cy="11" r="1.2"/><circle cx="12" cy="15.5" r="1.2"/><path d="M12 19.5v2.5"/>',
    pause: '<path d="M8.5 5v14m7-14v14"/>', note: '<path d="M14 3.5H5.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9z"/><path d="M14 3.5V9h5.5M8.5 13.5h7m-7 3.5h5"/>',
    spark: '<path d="m12 3 2.3 6.2L20.5 11.5l-6.2 2.3L12 20l-2.3-6.2L3.5 11.5l6.2-2.3z"/>', home: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v.5M9 12.5l2 2 4-4"/>',
    history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9M12 8v4.2l3 1.8"/>',
    more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3"/>', expand: '<path d="M8 3.5H3.5V8m12.5-4.5h4.5V8M3.5 16v4.5H8m12.5-4.5v4.5H16"/>',
    fire: '<path d="M12 3c.8 3.2 5.5 5.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.3 1.1-4 2.4-5.1.2 2 1.2 3.2 2.6 3.6C10.8 9 10.7 6.2 12 3z"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-9 8.5"/>',
    type: '<path d="M4 7V5h11v2M9.5 5v14M7.5 19h4M14 12v-1.5h6.5V12M17.2 10.5V19M15.8 19h2.8"/>',
  };
  function icon(name, cls = '') {
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] || icons.book}</svg>`;
  }
  const btn = (action, label, cls = 'primary', extra = '') => `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const progress = (value, cls = '', label = '完成进度') => `<div class="progress ${cls}" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><i style="width:${value}%"></i></div>`;
  // 圆环进度：track 是同色系的浅色轨道，数值为 0 时不画弧（圆头线帽会留下一个点）。
  function ring(value, size, stroke) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, mid = size / 2;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false"><circle class="ring-track" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}"/>${value > 0 ? `<circle class="ring-fill" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - Math.min(100, value) / 100)).toFixed(2)}" transform="rotate(-90 ${mid} ${mid})"/>` : ''}</svg>`;
  }

  // 间隔重复：答错的题明天再复习，答对一次复习间隔就升一档（1、2、4、7、15、30 天）。
  const SRS_STEPS = [1, 2, 4, 7, 15, 30];
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); const date = new Date(y, m - 1, d, 12); date.setDate(date.getDate() + n); return dateKey(date); };
  const hashOf = text => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const cleanSrs = value => safeMap(value, v => v && typeof v === 'object' && DAY_RE.test(v.d) ? { b: Math.min(SRS_STEPS.length - 1, finiteCount(v.b)), d: v.d, l: DAY_RE.test(v.l) ? v.l : null } : null);
  // 搜索：不分大小写、全角半角，忽略空格；多个关键词用空格隔开，需同时出现。
  const normalize = text => String(text == null ? '' : text).normalize('NFKC').toLowerCase();
  const compact = text => normalize(text).replace(/\s+/g, '');
  const queryTokens = query => normalize(query).split(/\s+/).filter(Boolean);
  const stripTags = markup => String(markup).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const matcher = query => { const tokens = queryTokens(query); return tokens.length ? text => { const hay = compact(text); return tokens.every(t => hay.includes(t)); } : null; };
  function highlight(root, tokens) {
    if (!root || !tokens.length) return;
    // 关键词已转成半角：高亮时每个字符同时匹配半角和全角写法，字符之间允许有空格。
    const escapeChar = ch => ch.replace(/[.*+?^${}()|[\]\\\-]/g, '\\$&');
    const charClass = ch => { const code = ch.charCodeAt(0); return code > 0x20 && code < 0x7f ? `[${escapeChar(ch)}${escapeChar(String.fromCharCode(code + 0xfee0))}]` : escapeChar(ch); };
    const pattern = new RegExp(tokens.slice().sort((a, b) => b.length - a.length).map(t => [...t].map(charClass).join('\\s*')).join('|'), 'gi');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement.closest('mark, .option-key') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const text = node.nodeValue;
      pattern.lastIndex = 0;
      if (!pattern.test(text)) return;
      const fragment = document.createDocumentFragment();
      let last = 0;
      text.replace(pattern, (match, offset) => {
        fragment.append(text.slice(last, offset));
        const mark = document.createElement('mark'); mark.textContent = match; fragment.append(mark);
        last = offset + match.length;
        return match;
      });
      fragment.append(text.slice(last));
      node.replaceWith(fragment);
    });
  }
  function download(filename, text, type) {
    const blob = new Blob([text], { type: `${type};charset=utf-8` }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── 学习记录与界面状态 ───────────────────────────────────────────────
  let lang = cleanLang(storage.get('g1-lang', 'both'));
  let hist = cleanHist(storage.get('g1-hist', {}));
  let wrong = cleanWrong(storage.get('g1-wrong', {}));
  let bookmarks = cleanBookmarks(storage.get('g1-bookmarks', {}));
  let notes = cleanNotes(storage.get('g1-notes', {}));
  let activity = cleanActivity(storage.get('g1-activity', {}));
  let sessions = cleanSessions(storage.get('g1-sessions', []));
  let prefs = cleanPrefs(storage.get('g1-preferences', {}));
  let page = 'home';
  let session = validateSession(storage.get('g1-session', null));
  let categorySearch = '', categorySection = 'all', practiceDifficulty = 'all';
  let practiceCount = storage.get('g1-count', 20);
  if (![10, 20, 40, 'all'].includes(practiceCount)) practiceCount = 20;
  let selectedGroups = new Set(Array.isArray(storage.get('g1-groups', null)) ? storage.get('g1-groups', []).filter(id => GROUPS.some(g => g.id === id)) : GROUPS.map(g => g.id));
  let randomOrder = storage.get('g1-random', true) !== false, unmasteredOnly = storage.get('g1-unseen', false) === true;
  let collectionSearch = '', collectionGroup = 'all', collectionPage = 0, sheetPage = 0, reviewPage = 0;
  let toastTimeout, confirmPending = null;
  // 重绘时保留的界面状态：已展开的回看题、打开着笔记框的题、本次打开页面后加载失败的标志图片。
  const openReviews = new Set(), brokenImages = new Set();
  let notesOpenFor = null;
  // 第三阶段新增：复习计划、考前冲刺、速查页和题库搜索的状态。
  const storedSrs = storage.get('g1-srs', null);
  let srs = storedSrs && typeof storedSrs === 'object' ? cleanSrs(storedSrs) : seedSrs();
  if (!storedSrs) storage.set('g1-srs', srs);
  let sprintSection = 'all', sprintCount = 20, sprintUnseen = true;
  let refDoc = 'cheat', refSearch = '', bankSearch = '', bankSection = 'all', bankPage = 0, bankIndex = null;

  // 新用户默认跟随系统深浅色；已保存的偏好不受影响。
  function cleanPrefs(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {
      theme: ['light', 'dark', 'system'].includes(v.theme) ? v.theme : 'system',
      font: ['normal', 'large'].includes(v.font) ? v.font : 'normal',
      goal: Math.min(200, Math.max(5, finiteCount(v.goal) || 20)),
      focus: !!v.focus,
    };
  }
  function cleanActivity(value) {
    const result = {};
    if (value && typeof value === 'object') {
      Object.keys(value).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).slice(-1500).forEach(k => {
        const v = value[k];
        if (v && typeof v === 'object') result[k] = { c: finiteCount(v.c), w: finiteCount(v.w) };
      });
    }
    return result;
  }
  function cleanSessions(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(v => v && typeof v === 'object' && Number.isFinite(v.finishedAt) && Number.isFinite(v.total) && Number.isFinite(v.correct)).slice(-100).map(v => ({
      id: String(v.id || '').slice(0, 80),
      mode: MODES.includes(v.mode) ? v.mode : 'practice',
      total: Math.min(BANK.length, finiteCount(v.total)),
      correct: Math.min(finiteCount(v.correct), finiteCount(v.total)),
      answered: Math.min(finiteCount(v.answered), finiteCount(v.total)),
      duration: finiteCount(v.duration),
      finishedAt: v.finishedAt,
      passed: !!v.passed,
      signs: v.mode === 'exam' ? cleanPart(v.signs) : undefined,
      rules: v.mode === 'exam' ? cleanPart(v.rules) : undefined,
    }));
  }
  function validateSession(v) {
    if (!v || typeof v !== 'object' || !MODES.includes(v.mode) || !Array.isArray(v.items) || !v.items.length || v.items.length > BANK.length || v.finished) return null;
    const unique = new Set();
    const items = v.items.filter(it => it && byId[it.id] && !unique.has(it.id) && unique.add(it.id)).map(it => {
      const q = byId[it.id];
      const valid = Array.isArray(it.order) && it.order.length === q.options.length && new Set(it.order).size === q.options.length && it.order.every(n => Number.isInteger(n) && n >= 0 && n < q.options.length);
      const pick = Number.isInteger(it.pick) && it.pick >= 0 && it.pick < q.options.length ? it.pick : null;
      return { id: it.id, order: valid ? it.order : q.options.map((_, i) => i), pick, recorded: v.mode !== 'exam' && pick !== null && !!it.recorded, flagged: !!it.flagged };
    });
    if (!items.length) return null;
    if (v.mode === 'exam' && (items.filter(it => byId[it.id].section === 'signs').length !== META.exam.signs || items.filter(it => byId[it.id].section === 'rules').length !== META.exam.rules)) return null;
    return { id: String(v.id || Date.now()), mode: v.mode, items, i: Math.min(items.length - 1, finiteCount(v.i)), elapsed: finiteCount(v.elapsed), startedAt: null, createdAt: Number(v.createdAt) || Date.now(), finished: false };
  }

  // ── 统计 ─────────────────────────────────────────────────────────────
  function isMastered(id) { const h = hist[id]; return !!h && h.c > 0 && h.c >= h.w; }
  function totals() {
    const entries = Object.values(hist);
    const correct = entries.reduce((n, h) => n + h.c, 0), incorrect = entries.reduce((n, h) => n + h.w, 0);
    return { correct, incorrect, attempts: correct + incorrect, seen: Object.keys(hist).filter(id => hist[id].c + hist[id].w > 0).length, mastered: BANK.filter(q => isMastered(q.id)).length, accuracy: ratio(correct, correct + incorrect) };
  }
  function groupStats(group) {
    const qs = BANK.filter(q => q.group === group.id);
    let c = 0, w = 0, seen = 0, mastered = 0;
    qs.forEach(q => {
      const h = hist[q.id];
      if (h) { c += h.c; w += h.w; if (h.c + h.w) seen++; }
      if (isMastered(q.id)) mastered++;
    });
    return { ...group, count: qs.length, c, w, attempts: c + w, accuracy: ratio(c, c + w), seen, mastered };
  }
  function todayActivity() { const a = activity[dateKey()] || { c: 0, w: 0 }; return a.c + a.w; }
  function streakDays() {
    let count = 0;
    const d = new Date(); d.setHours(12, 0, 0, 0);
    if (!todayActivity()) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 1500; i++) {
      const a = activity[dateKey(d)];
      if (!a || a.c + a.w === 0) break;
      count++; d.setDate(d.getDate() - 1);
    }
    return count;
  }
  function elapsed() { return session ? session.elapsed + (session.startedAt ? Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)) : 0) : 0; }
  function saveSession() { if (!session || session.finished) return; storage.set('g1-session', { ...session, elapsed: elapsed(), startedAt: null }); }
  function pauseSession() { if (session && !session.finished) { session.elapsed = elapsed(); session.startedAt = null; saveSession(); } }
  function modeName(mode) { return { exam: '模拟考试', practice: '分类练习', wrong: '错题复习', bookmarks: '收藏练习', review: '今日复习', sprint: '考前冲刺' }[mode] || '练习'; }

  // ── 复习计划（间隔重复）──────────────────────────────────────────────
  // 第一次用到复习计划时，按已有成绩生成：错题今天复习，其余练过的题分散到未来一周。
  function seedSrs() {
    const today = dateKey(), result = {};
    Object.keys(hist).forEach(id => {
      const h = hist[id];
      if (!h.c && !h.w) return;
      result[id] = wrong[id] ? { b: 0, d: today, l: null } : { b: isMastered(id) ? Math.min(3, h.c + 1) : 1, d: addDays(today, 1 + hashOf(id) % 7), l: null };
    });
    Object.keys(wrong).forEach(id => { if (!result[id]) result[id] = { b: 0, d: today, l: null }; });
    return result;
  }
  function schedule(id, correct) {
    const today = dateKey(), s = srs[id];
    if (correct) {
      if (s && s.l === today) return; // 同一天重复答对不再拉长间隔
      const b = s ? Math.min(SRS_STEPS.length - 1, s.b + 1) : 2;
      srs[id] = { b, d: addDays(today, SRS_STEPS[b]), l: today };
    } else {
      srs[id] = { b: 0, d: addDays(today, 1), l: today };
    }
    storage.set('g1-srs', srs);
  }
  function dueIds(day = dateKey()) {
    return Object.keys(srs).filter(id => srs[id].d <= day).sort((a, b) => srs[a].d.localeCompare(srs[b].d) || srs[a].b - srs[b].b || (wrong[b] || 0) - (wrong[a] || 0));
  }
  function forecast(days = 7) {
    const today = dateKey();
    return Array.from({ length: days }, (_, i) => { const key = addDays(today, i); return { key, n: Object.values(srs).filter(s => (i === 0 ? s.d <= key : s.d === key)).length }; });
  }
  function greeting() { const h = new Date().getHours(); return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好'; }

  // ── 外壳：主题、导航、标题 ───────────────────────────────────────────
  function toast(message) {
    const el = $('#toast'); if (!el) return;
    el.textContent = message; el.classList.add('visible');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove('visible'), 3000);
  }
  function applyPreferences(save = true) {
    const theme = prefs.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : prefs.theme;
    const root = document.documentElement;
    root.dataset.theme = theme; root.dataset.font = prefs.font;
    document.body.classList.toggle('focus-mode', prefs.focus && page === 'quiz');
    $('#focus-toggle')?.setAttribute('aria-pressed', String(prefs.focus));
    $('#font-toggle')?.setAttribute('aria-pressed', String(prefs.font === 'large'));
    const themeButton = $('#theme-toggle');
    if (themeButton) {
      themeButton.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
      themeButton.setAttribute('aria-label', theme === 'dark' ? '切换浅色模式' : '切换深色模式');
      themeButton.title = themeButton.getAttribute('aria-label');
    }
    $('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d1411' : '#f3f5f2');
    if (save) storage.set('g1-preferences', prefs);
  }
  function textPair(zh, en, cls = '') {
    const enSpan = `<span class="en ${cls}"${en ? ' lang="en"' : ''}>${esc(en || zh)}</span>`;
    if (lang === 'zh') return `<span class="zh ${cls}">${esc(zh || en)}</span>`;
    if (lang === 'en') return enSpan;
    return `<span class="zh ${cls}">${esc(zh || en)}</span>${enSpan}`;
  }
  function setHeader(title, subtitle) {
    $('#page-title').textContent = title;
    $('#page-subtitle').textContent = subtitle;
    document.title = page === 'home' ? 'G1 Studio · 安省驾考学习空间' : `${title} · G1 Studio`;
  }
  function closeMobile() { document.body.classList.remove('sidebar-open'); $('#mobile-menu')?.setAttribute('aria-expanded', 'false'); }
  function openSheet(open) {
    document.body.classList.toggle('sheet-open', open);
    view.querySelectorAll('[data-action="toggle-sheet"]').forEach(b => b.setAttribute('aria-expanded', String(open)));
    if (open) view.querySelector('#quiz-sidebar .answer-cell.current, #quiz-sidebar button')?.focus({ preventScroll: true });
  }
  function updateCounts() {
    const counts = { wrong: Object.keys(wrong).length, bookmarks: Object.keys(bookmarks).length };
    document.querySelectorAll('[data-count]').forEach(el => {
      const n = counts[el.dataset.count];
      el.textContent = n > 99 ? '99+' : n;
      if (el.hasAttribute('data-hide-zero')) el.hidden = !n;
    });
  }
  function navigate(next) {
    if (!['home', 'practice', 'exam', 'sprint', 'wrong', 'bookmarks', 'reference', 'search', 'stats', 'settings'].includes(next)) return;
    if (page === 'quiz') pauseSession();
    page = next; collectionSearch = ''; collectionGroup = 'all'; collectionPage = 0;
    closeMobile(); openSheet(false); render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function render(restoreFocus = false) {
    const active = document.activeElement;
    const focusId = restoreFocus && active?.id, focusKey = restoreFocus && active?.dataset?.focus;
    const selection = restoreFocus && typeof active?.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const navPage = page === 'quiz' || page === 'result' ? ({ exam: 'exam', wrong: 'wrong', bookmarks: 'bookmarks', review: 'home', sprint: 'sprint' }[session?.mode] || 'practice') : page;
    document.querySelectorAll('[data-page]').forEach(b => {
      const selected = b.dataset.page === navPage;
      b.classList.toggle('active', selected);
      selected ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    // 只在切换页面时播放淡入；同一页面内的重绘（答题、收藏、切语言）不闪动。
    if (document.body.dataset.view !== page) {
      view.classList.add('page-enter');
      clearTimeout(render.enterTimer); render.enterTimer = setTimeout(() => view.classList.remove('page-enter'), 450);
    }
    document.body.dataset.view = page;
    applyPreferences();
    ({ home: renderHome, practice: renderPractice, exam: renderExamSetup, sprint: renderSprint, quiz: renderQuiz, result: renderResult, wrong: renderCollection, bookmarks: renderCollection, reference: renderReference, search: renderSearch, stats: renderStats }[page] || renderSettings)();
    updateCounts();
    if (restoreFocus) {
      const target = focusId ? document.getElementById(focusId) : focusKey ? view.querySelector(`[data-focus="${focusKey}"]`) : null;
      if (target) { target.focus({ preventScroll: true }); if (selection && target.setSelectionRange) target.setSelectionRange(...selection); }
    }
  }

  // ── 学习总览 ─────────────────────────────────────────────────────────
  function statCard(iconName, value, label, detail = '', tone = '') {
    return `<div class="stat-card ${tone}"><div class="stat-head"><span class="stat-label">${label}</span><span class="stat-icon">${icon(iconName)}</span></div><strong class="stat-value">${value}</strong>${detail ? `<span class="stat-detail">${detail}</span>` : ''}</div>`;
  }
  function niceMax(n) { return [5, 10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000].find(s => s >= n) || Math.ceil(n / 500) * 500; }
  // 最近 7 天柱状图：单一系列不需要图例；只标今天和最高的一天，其余数值在悬停/键盘焦点提示里。
  function weekChart() {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 6 + i);
      const a = activity[dateKey(d)] || { c: 0, w: 0 };
      return { key: dateKey(d), label: i === 6 ? '今天' : `周${'日一二三四五六'[d.getDay()]}`, n: a.c + a.w, c: a.c };
    });
    const peak = Math.max(...days.map(d => d.n)), max = niceMax(Math.max(prefs.goal, peak, 1));
    const peakIndex = peak ? days.findIndex(d => d.n === peak) : -1, total = days.reduce((n, d) => n + d.n, 0);
    const pct = n => n / max * 100;
    return `<figure class="chart week-chart">
      <div class="chart-plot">
        <div class="chart-gridlines" aria-hidden="true">${[max, max / 2, 0].map(v => `<span style="bottom:${pct(v)}%"><em>${Math.round(v)}</em></span>`).join('')}</div>
        <div class="chart-goal" style="bottom:${pct(prefs.goal)}%" aria-hidden="true"><em>目标 ${prefs.goal}</em></div>
        <div class="chart-bars" role="list" aria-label="最近 7 天每天的练习题数">
          ${days.map((d, i) => `<div class="chart-col ${i === 6 ? 'is-today' : ''}" role="listitem" tabindex="0" aria-label="${d.label}（${d.key}）：${d.n} 题${d.n ? `，答对 ${d.c} 题` : ''}">
            <span class="chart-bar" style="height:${d.n ? Math.max(1.5, pct(d.n)) : 0}%"></span>
            ${(i === 6 || i === peakIndex) && d.n ? `<span class="chart-value" style="bottom:${pct(d.n)}%">${d.n}</span>` : ''}
            <span class="chart-tip" aria-hidden="true"><b>${d.n} 题</b>${d.key.slice(5).replace('-', '/')}${d.n ? ` · 正确率 ${ratio(d.c, d.n)}%` : ''}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="chart-axis" aria-hidden="true">${days.map((d, i) => `<span class="${i === 6 ? 'is-today' : ''}">${d.label}</span>`).join('')}</div>
      <figcaption class="chart-caption">近 7 天共 ${total} 题 · 达到每日目标 ${days.filter(d => d.n >= prefs.goal).length} 天</figcaption>
    </figure>`;
  }
  function roadArt() {
    return `<svg class="road-art" viewBox="0 0 320 230" aria-hidden="true" focusable="false">
      <circle class="art-sun" cx="258" cy="52" r="20"/>
      <path class="art-hill" d="M0 150c48-26 98-30 150-14s104 12 170-22v116H0z"/>
      <path class="art-field" d="M0 182c62-22 128-24 188-6 54 16 92 12 132-6v60H0z"/>
      <path class="art-road" d="M66 230c22-46 70-86 150-118l10 1c-62 36-96 74-104 117z"/>
      <path class="art-road-line" d="M95 230c18-42 56-78 125-116"/>
      <g class="art-sign-post"><rect x="82" y="78" width="5" height="70" rx="2.5"/></g>
      <g class="art-sign"><rect x="50" y="46" width="70" height="42" rx="9"/><rect class="art-sign-inner" x="55" y="51" width="60" height="32" rx="6"/><text x="85" y="73.5" text-anchor="middle">G1</text></g>
      <g class="art-tree"><circle cx="34" cy="146" r="17"/><circle cx="52" cy="156" r="12"/><rect class="art-trunk" x="31" y="158" width="5" height="16" rx="2.5"/></g>
      <g class="art-tree small"><circle cx="286" cy="128" r="12"/><circle cx="300" cy="136" r="9"/><rect class="art-trunk" x="284" y="137" width="4" height="12" rx="2"/></g>
      <g class="art-car" transform="translate(140 168) rotate(-36)"><rect width="38" height="22" rx="7"/><rect class="art-car-glass" x="9" y="4" width="15" height="14" rx="3.5"/><rect class="art-car-light" x="33" y="4" width="3" height="5" rx="1.5"/><rect class="art-car-light" x="33" y="13" width="3" height="5" rx="1.5"/></g>
    </svg>`;
  }
  function resumeBanner() {
    if (!session || session.finished) return '';
    const answered = session.items.filter(it => it.pick !== null).length;
    return `<section class="resume-banner">
      <span class="resume-icon">${icon(session.mode === 'exam' ? 'clipboard' : 'clock')}</span>
      <div class="resume-copy"><strong>继续上次的${modeName(session.mode)}</strong><span>已答 ${answered} / ${session.items.length} 题 · 用时 ${timeLabel(session.elapsed)} · 进度已保存</span>${progress(ratio(answered, session.items.length), 'resume-progress', '上次练习的完成进度')}</div>
      ${btn('resume', `<span>继续</span>${icon('arrow')}`, 'primary')}
    </section>`;
  }
  function forecastBars(days) {
    const peak = Math.max(1, ...days.map(d => d.n));
    const weekday = key => { const [y, m, d] = key.split('-').map(Number); return `周${'日一二三四五六'[new Date(y, m - 1, d).getDay()]}`; };
    return `<div class="review-forecast" role="list" aria-label="未来 7 天每天到期的复习题数">${days.map((d, i) => `<span class="fc-day ${i === 0 ? 'today' : ''}" role="listitem" aria-label="${i === 0 ? '今天（含之前没复习的）' : d.key}：${d.n} 题"><b>${d.n || ''}</b><i class="${d.n ? '' : 'zero'}" style="${d.n ? `height:${Math.max(6, Math.round(d.n / peak * 56))}px` : ''}"></i><em>${i === 0 ? '今天' : i === 1 ? '明天' : weekday(d.key)}</em></span>`).join('')}</div>`;
  }
  function reviewCard() {
    const due = dueIds(), days = forecast(7), tracked = Object.keys(srs).length, later = days.slice(1).reduce((n, d) => n + d.n, 0);
    const dueWrong = due.filter(id => wrong[id]).length;
    return `<section class="panel review-card">
      <div class="section-head"><div><h3>今日复习</h3><p class="section-sub">按遗忘规律安排：答错的明天再见，答对的间隔越拉越长</p></div><span class="chip ${due.length ? 'warn' : 'ok'}">${due.length ? `${due.length} 题到期` : `${icon('check')}今日已清空`}</span></div>
      <div class="review-body">
        <p class="review-count"><strong>${due.length}</strong><span>${due.length ? `道题今天该复习${dueWrong ? `，其中 ${dueWrong} 道在错题本里` : ''}` : tracked ? '今天没有到期的题，可以去练新题' : '答过的题会自动排进复习计划'}</span></p>
        ${forecastBars(days)}
      </div>
      <div class="review-footer">${btn('start-review', `${icon('repeat')}<span>${due.length > 20 ? '先复习 20 题' : '开始复习'}</span>`, 'primary', due.length ? '' : 'disabled')}${due.length > 20 ? btn('start-review-all', `全部 ${due.length} 题`, 'ghost') : ''}<span class="review-later">未来 6 天还有 ${later} 题</span></div>
    </section>`;
  }
  function modeCard(target, iconName, title, desc, tag, tone) {
    return `<button type="button" class="mode-card ${tone}" data-action="navigate" data-page-target="${target}"><span class="mode-icon">${icon(iconName)}</span><span class="mode-body"><strong>${title}</strong><span>${desc}</span><small>${tag}</small></span>${icon('arrow', 'mode-arrow')}</button>`;
  }
  function renderHome() {
    const t = totals(), today = todayActivity(), goalPct = Math.min(100, ratio(today, prefs.goal)), streak = streakDays();
    const wrongCount = Object.keys(wrong).length, bookmarkCount = Object.keys(bookmarks).length;
    const sprintLeft = BANK.filter(q => !isMastered(q.id) && sprintRank(q) < 2).length;
    const weak = GROUPS.map(groupStats).filter(g => g.attempts > 0).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, 3);
    const todayText = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    setHeader('学习总览', '一点点积累，让每次出发更从容。');
    view.innerHTML = `
      ${resumeBanner()}
      <section class="hero">
        <div class="hero-copy">
          <p class="hero-kicker">${greeting()} · ${esc(todayText)}</p>
          <h2>每一题，<br>离上路更近。</h2>
          <p class="hero-text">把交通规则变成直觉。今天，从一组专注的练习开始。</p>
          <div class="hero-actions">
            ${btn('quick', `${icon('play')}<span>开始今日练习</span>`, 'primary large')}
            ${btn('navigate', `${icon('clipboard')}<span>模拟考试</span>`, 'ghost large', 'data-page-target="exam"')}
          </div>
          <ul class="hero-meta">
            <li>${icon('book')}${BANK.length} 道中英双语题</li>
            <li>${icon('target')}今日 ${today} / ${prefs.goal} 题</li>
            <li>${icon('fire')}${streak ? `已连续学习 ${streak} 天` : '今天开始打卡'}</li>
          </ul>
        </div>
        <div class="hero-art">${roadArt()}</div>
      </section>
      <div class="stat-grid">
        ${statCard('book', `${t.seen}<small>/ ${BANK.length}</small>`, '已练题目', `题库覆盖 ${ratio(t.seen, BANK.length)}%`, 'tone-green')}
        ${statCard('target', t.attempts ? `${t.accuracy}<small>%</small>` : '—', '累计正确率', t.attempts ? `共 ${t.attempts} 次作答` : '完成第一题后开始记录', 'tone-blue')}
        ${statCard('history', wrongCount, '错题本', wrongCount ? '复习答对后自动移出' : '目前没有错题', 'tone-amber')}
        ${statCard('bookmark', bookmarkCount, '收藏题目', bookmarkCount ? '随时回看重点' : '答题时点书签收藏', 'tone-violet')}
      </div>
      <div class="dashboard-grid">
        <div class="main-stack">
          ${reviewCard()}
          <section class="panel">
            <div class="section-head"><div><h3>选择练习方式</h3><p class="section-sub">循序渐进，稳步前行</p></div></div>
            <div class="mode-grid">
              ${modeCard('practice', 'book', '分类练习', '按章节和难度练，答完立刻看解析。', `${GROUPS.length} 个主题`, 'tone-green')}
              ${modeCard('exam', 'clipboard', '模拟考试', '标志、交规各 20 题，交卷后统一判分。', `${META.exam.signs + META.exam.rules} 道题`, 'tone-blue')}
              ${modeCard('sprint', 'bolt', '考前冲刺', '只练错题和没掌握的题，补齐短板。', sprintLeft ? `${sprintLeft} 道易错题待巩固` : '先练一些题，再来冲刺', 'tone-amber')}
              ${modeCard('wrong', 'history', '错题巩固', '把每次答错变成下一次答对。', wrongCount ? `${wrongCount} 道待复习` : '暂无错题', 'tone-violet')}
              ${modeCard('bookmarks', 'bookmark', '我的收藏', '回看重要规则，让常忘的点更牢靠。', bookmarkCount ? `${bookmarkCount} 道收藏` : '还没有收藏', 'tone-green')}
              ${modeCard('reference', 'note', '必背速查', '关键数字、扣分、标志和考试须知，可搜索。', '考前翻一翻', 'tone-blue')}
            </div>
          </section>
          <section class="panel">
            <div class="section-head"><div><h3>最近 7 天</h3><p class="section-sub">${Object.keys(activity).length ? '按实际作答次数记录，重复练习也会计入' : '完成第一道练习后，这里会出现你的学习轨迹'}</p></div>${btn('navigate', '学习统计', 'ghost small', 'data-page-target="stats"')}</div>
            ${weekChart()}
          </section>
        </div>
        <aside class="side-stack">
          <section class="panel daily-card">
            <div class="section-head"><h3>今日目标</h3><span class="chip ${today >= prefs.goal ? 'ok' : ''}">${today >= prefs.goal ? `${icon('check')}已达成` : `${goalPct}%`}</span></div>
            <div class="daily-ring">${ring(goalPct, 140, 12)}<div class="daily-ring-label"><strong>${today}<small>/ ${prefs.goal}</small></strong><span>今日已练</span></div></div>
            <p class="goal-message">${today >= prefs.goal ? '今日目标达成，保持这份好节奏。' : `再练 ${prefs.goal - today} 题，完成今天的小目标。`}</p>
            ${btn('quick', today >= prefs.goal ? '再来一组练习' : '去完成目标', 'secondary block')}
          </section>
          <section class="panel">
            <div class="section-head"><h3>值得再练一练</h3>${icon('spark', 'section-icon')}</div>
            ${weak.length ? `<div class="weak-list">${weak.map(g => `<button class="weak-row" type="button" data-action="weak-group" data-group="${g.id}"><span class="category-icon ${g.section}">${icon(groupIcons[g.id])}</span><span class="weak-copy"><strong>${esc(shortName(g.id))}</strong><small>${g.attempts} 次作答 · 正确率 ${g.accuracy}%</small>${progress(g.accuracy, 'weak-progress', `${shortName(g.id)}正确率`)}</span>${icon('chevron', 'row-chevron')}</button>`).join('')}</div>` : `<div class="empty-state compact">${icon('target')}<p>开始练习后，这里会列出正确率最低的章节。</p></div>`}
          </section>
          <a class="handbook-card" href="${esc(META.handbook_url)}" target="_blank" rel="noopener noreferrer">${icon('book', 'handbook-icon')}<span><strong>理解规则，比记住答案更重要</strong><small>每道题都能回到官方手册查看依据</small></span>${icon('external', 'handbook-ext')}</a>
        </aside>
      </div>`;
  }

  // ── 分类练习 ─────────────────────────────────────────────────────────
  function practicePool() {
    return BANK.filter(q => selectedGroups.has(q.group) && (categorySection === 'all' || q.section === categorySection) && (practiceDifficulty === 'all' || q.difficulty === practiceDifficulty) && (!unmasteredOnly || !isMastered(q.id)));
  }
  function segmented(action, label, options, current) {
    return `<div class="segmented" role="group" aria-label="${label}">${options.map(([value, text]) => `<button type="button" data-action="${action}" data-value="${value}" aria-pressed="${String(current) === String(value)}">${text}</button>`).join('')}</div>`;
  }
  function renderPractice() {
    setHeader('分类练习', '选择章节和难度，按自己的节奏练习。');
    const pool = practicePool();
    const term = categorySearch.trim().toLowerCase();
    const filtered = GROUPS.filter(g => (categorySection === 'all' || g.section === categorySection) && `${g.title_zh} ${shortName(g.id)} ${g.id}`.toLowerCase().includes(term));
    const planned = practiceCount === 'all' ? pool.length : Math.min(Number(practiceCount), pool.length);
    view.innerHTML = `
      <div class="page-intro">
        <div><h2>从一个主题开始，把规则学扎实。</h2><p>共 ${GROUPS.length} 个主题、${BANK.length} 道题。选好范围，再在下方设置题量和难度。</p></div>
        ${btn('smart', `${icon('spark')}<span>智能巩固薄弱题</span>`, 'secondary')}
      </div>
      <section class="panel practice-panel">
        <div class="toolbar">
          <label class="search-field" for="category-search">${icon('search')}<input id="category-search" type="search" placeholder="搜索章节，如：路口、标志" value="${esc(categorySearch)}" autocomplete="off"></label>
          ${segmented('category-section', '题库部分', [['all', '全部'], ['rules', '交通规则'], ['signs', '道路标志']], categorySection)}
        </div>
        <div class="list-head"><span>${filtered.length} 个主题 · 已选 ${selectedGroups.size} 个</span><div class="row">${btn('select-all', '全选', 'ghost small')}${btn('select-none', '清空选择', 'ghost small')}</div></div>
        <div class="category-grid">
          ${filtered.length ? filtered.map(g => {
            const s = groupStats(g), pct = ratio(s.mastered, s.count), on = selectedGroups.has(g.id);
            return `<label class="category-card ${on ? 'selected' : ''}">
              <input type="checkbox" data-group-select="${g.id}" ${on ? 'checked' : ''}>
              <span class="category-top"><span class="category-icon ${g.section}">${icon(groupIcons[g.id])}</span><span class="category-check">${icon('check')}</span></span>
              <strong>${esc(shortName(g.id))}</strong>
              <span class="category-description">${esc(g.title_zh)}</span>
              <span class="category-foot"><span>${s.count} 道题</span><span>${pct}% 已掌握</span></span>
              ${progress(pct, 'category-progress', `${shortName(g.id)}掌握进度`)}
            </label>`;
          }).join('') : `<div class="empty-state">${icon('search')}<h3>没有找到这个主题</h3><p>试试“标志”“停车”，或者清空关键词。</p>${btn('clear-category-search', '清空搜索', 'ghost')}</div>`}
        </div>
      </section>
      <section class="panel practice-options">
        <div class="section-head"><h3>这次想怎么练？</h3><span class="pool-count">${pool.length} 道符合条件</span></div>
        <div class="option-rows">
          <div class="field-row"><span class="field-label">题目数量</span>${segmented('practice-count', '本次题目数量', [[10, '10 题'], [20, '20 题'], [40, '40 题'], ['all', '全部']], practiceCount)}</div>
          <div class="field-row"><span class="field-label">练习难度</span>${segmented('practice-difficulty', '练习难度', [['all', '全部'], ...Object.entries(difficultyNames)], practiceDifficulty)}</div>
          <label class="toggle-row" for="practice-random"><span class="toggle-copy"><strong>随机出题</strong><small>每次打乱题目顺序</small></span><span class="switch"><input type="checkbox" id="practice-random" ${randomOrder ? 'checked' : ''}><span aria-hidden="true"></span></span></label>
          <label class="toggle-row" for="practice-unmastered"><span class="toggle-copy"><strong>只练未掌握的题</strong><small>跳过答对次数已经不少于答错次数的题</small></span><span class="switch"><input type="checkbox" id="practice-unmastered" ${unmasteredOnly ? 'checked' : ''}><span aria-hidden="true"></span></span></label>
        </div>
        <div class="setup-footer">
          <p><strong>本次练习 ${planned} 题</strong><span>答题后立即显示解析</span></p>
          ${btn('start-practice', `<span>开始练习</span>${icon('arrow')}`, 'primary large', pool.length ? '' : 'disabled')}
        </div>
      </section>`;
  }

  // ── 模拟考试 ─────────────────────────────────────────────────────────
  function renderExamSetup() {
    setHeader('模拟考试', '专注作答，交卷后再看对错和解析。');
    const need = section => Math.ceil(META.exam[section] * META.exam.pass_ratio);
    const exams = sessions.filter(s => s.mode === 'exam');
    view.innerHTML = `
      <section class="panel exam-intro">
        <div class="exam-emblem">${icon('clipboard')}</div>
        <h2>给自己一次完整的检验</h2>
        <p class="exam-desc">${esc(META.exam.desc)}</p>
        <div class="exam-parts">
          <div class="exam-part signs">${icon('stop')}<strong>道路标志 ${META.exam.signs} 题</strong><span>答对 ${need('signs')} 道及格</span></div>
          <div class="exam-part rules">${icon('car')}<strong>交通规则 ${META.exam.rules} 题</strong><span>答对 ${need('rules')} 道及格</span></div>
        </div>
        <ul class="exam-features"><li>${icon('clock')}记录用时，不限时间</li><li>${icon('flag')}没把握的题先标记，交卷前回看</li><li>${icon('pause')}随时暂停，进度自动保存</li></ul>
        <div class="exam-actions">
          ${btn('start-exam', `${icon('play')}<span>开始模拟考试</span>`, 'primary large')}
          ${session && !session.finished && session.mode === 'exam' ? btn('resume', '继续上次考试', 'ghost large') : ''}
        </div>
        <div class="exam-note"><strong>关于模拟标准</strong><p>${esc(META.exam.note)}</p></div>
      </section>
      ${examHistoryPanel(exams)}`;
  }

  // 模拟考试成绩趋势：单一折线（总正确率）+ 80% 及格线；圆点实心为通过、空心为未通过，悬停或键盘聚焦显示两部分得分。
  const partText = p => p ? `${p.c} / ${p.n}` : '—';
  const shortDate = t => new Date(t).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  function trendChart(exams) {
    const list = exams.slice(-20), n = list.length, pass = META.exam.pass_ratio * 100;
    const x = i => n === 1 ? 50 : 3 + i / (n - 1) * 94, pct = s => ratio(s.correct, s.total);
    return `<figure class="chart trend-chart">
      <div class="trend-plot">
        <div class="chart-gridlines" aria-hidden="true">${[100, 60, 40, 20, 0].map(v => `<span style="bottom:${v}%"><em>${v}</em></span>`).join('')}</div>
        <div class="trend-pass" style="bottom:${pass}%" aria-hidden="true"><em>及格 ${pass}%</em></div>
        <svg class="trend-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline points="${list.map((s, i) => `${x(i).toFixed(2)},${100 - pct(s)}`).join(' ')}"/></svg>
        <div class="trend-points" role="list" aria-label="最近 ${n} 次模拟考试的正确率">${list.map((s, i) => `<span class="trend-point ${s.passed ? 'pass' : 'fail'} ${x(i) < 18 ? 'edge-left' : x(i) > 82 ? 'edge-right' : ''}" role="listitem" tabindex="0" style="left:${x(i)}%;bottom:${pct(s)}%" aria-label="${esc(shortDate(s.finishedAt))}：正确率 ${pct(s)}%，${s.passed ? '通过' : '未通过'}${s.signs ? `，标志 ${s.signs.c}/${s.signs.n}，交规 ${s.rules.c}/${s.rules.n}` : ''}"><span class="chart-tip" aria-hidden="true"><b>${pct(s)}% · ${s.passed ? '通过' : '未通过'}</b>${esc(shortDate(s.finishedAt))}${s.signs ? ` · 标志 ${partText(s.signs)} · 交规 ${partText(s.rules)}` : ''}</span></span>`).join('')}</div>
      </div>
      <div class="trend-axis" aria-hidden="true"><span>${esc(shortDate(list[0].finishedAt))}</span>${n > 1 ? `<span>${esc(shortDate(list[n - 1].finishedAt))}</span>` : ''}</div>
      <figcaption class="trend-legend"><span><i class="trend-key pass"></i>通过</span><span><i class="trend-key fail"></i>未通过</span><span><i class="trend-key line"></i>及格线 ${pass}%</span><span class="trend-note">最近 ${n} 次</span></figcaption>
    </figure>`;
  }
  function examHistoryPanel(list) {
    if (!list.length) return '';
    const exams = list.slice().sort((a, b) => a.finishedAt - b.finishedAt);
    const pcts = exams.map(s => ratio(s.correct, s.total)), recent = pcts.slice(-5), passed = exams.filter(s => s.passed).length;
    return `<section class="panel exam-history">
      <div class="section-head"><div><h3>模拟考试成绩</h3><p class="section-sub">每部分都达到 80% 才算通过；交卷后的成绩都会记在这里</p></div></div>
      <div class="exam-kpis">
        <div><strong>${exams.length}</strong><span>已考次数</span></div>
        <div><strong>${passed}</strong><span>通过次数</span></div>
        <div><strong>${Math.max(...pcts)}%</strong><span>最高正确率</span></div>
        <div><strong>${Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)}%</strong><span>最近 ${recent.length} 次平均</span></div>
      </div>
      ${trendChart(exams)}
      <details class="chart-table"><summary>查看全部成绩</summary><div class="table-scroll"><table><thead><tr><th scope="col">交卷时间</th><th scope="col">正确率</th><th scope="col">道路标志</th><th scope="col">交通规则</th><th scope="col">结果</th><th scope="col">用时</th></tr></thead><tbody>${exams.slice().reverse().map(s => `<tr><td>${esc(new Date(s.finishedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td><td>${ratio(s.correct, s.total)}%</td><td>${partText(s.signs)}</td><td>${partText(s.rules)}</td><td>${s.passed ? '通过' : '未通过'}</td><td>${timeLabel(s.duration)}</td></tr>`).join('')}</tbody></table></div><p class="footnote">更新前交卷的考试没有记录两部分的分数，显示为“—”。</p></details>
    </section>`;
  }

  // ── 考前冲刺 ─────────────────────────────────────────────────────────
  // 冲刺题池：已掌握的题不出；先出错题本里的题，再出练过但没掌握的题，最后是没练过的题（挑战难度优先）。
  function sprintRank(q) {
    const h = hist[q.id];
    if (wrong[q.id]) return 0;
    if (h && h.c + h.w) return 1;
    return q.difficulty === 'hard' ? 2 : 3;
  }
  function sprintPool(section = sprintSection, includeUnseen = sprintUnseen) {
    return shuffle(BANK.filter(q => (section === 'all' || q.section === section) && !isMastered(q.id) && (includeUnseen || sprintRank(q) < 2)))
      .map(q => ({ q, rank: sprintRank(q), weight: (wrong[q.id] || 0) * 10 + (hist[q.id]?.w || 0) - (hist[q.id]?.c || 0) }))
      .sort((a, b) => a.rank - b.rank || b.weight - a.weight)
      .map(x => x.q);
  }
  function renderSprint() {
    setHeader('考前冲刺', '只练易错和还没掌握的题，把短板补上。');
    const scope = BANK.filter(q => sprintSection === 'all' || q.section === sprintSection);
    const counts = [0, 0, 0, 0];
    scope.forEach(q => { if (!isMastered(q.id)) counts[sprintRank(q)]++; });
    const mastered = scope.filter(q => isMastered(q.id)).length, pool = sprintPool();
    const planned = sprintCount === 'all' ? pool.length : Math.min(sprintCount, pool.length);
    const tile = (n, label, desc, tone) => `<div class="sprint-tile ${tone}"><strong>${n}</strong><span>${label}</span><small>${desc}</small></div>`;
    view.innerHTML = `
      <div class="page-intro"><div><h2>考前冲刺，把会错的题先练熟。</h2><p>已经掌握的题不再出现。错题优先，其次是练过但还没掌握的题，最后才是没练过的题。</p></div></div>
      <section class="panel sprint-panel">
        <div class="sprint-tiles">
          ${tile(counts[0], '错题本里的题', '最先出现', 'tone-red')}
          ${tile(counts[1], '练过但没掌握', '答错次数不少于答对', 'tone-amber')}
          ${tile(counts[2] + counts[3], '还没练过', `其中挑战难度 ${counts[2]} 道`, 'tone-blue')}
          ${tile(mastered, '已掌握', '冲刺时跳过', 'tone-green')}
        </div>
        <div class="option-rows">
          <div class="field-row"><span class="field-label">冲刺范围</span>${segmented('sprint-section', '冲刺范围', [['all', '全部'], ['rules', '交通规则'], ['signs', '道路标志']], sprintSection)}</div>
          <div class="field-row"><span class="field-label">题目数量</span>${segmented('sprint-count', '冲刺题目数量', [[20, '20 题'], [40, '40 题'], ['all', '全部']], sprintCount)}</div>
          <label class="toggle-row" for="sprint-unseen"><span class="toggle-copy"><strong>加入还没练过的题</strong><small>关掉后只练错题和练过没掌握的题</small></span><span class="switch"><input type="checkbox" id="sprint-unseen" ${sprintUnseen ? 'checked' : ''}><span aria-hidden="true"></span></span></label>
        </div>
        <div class="setup-footer">
          <p><strong>本次冲刺 ${planned} 题</strong><span>${pool.length ? `题池共 ${pool.length} 道 · 答对后移出错题本` : '这个范围里的题都掌握了'}</span></p>
          ${btn('start-sprint', `${icon('bolt')}<span>开始冲刺</span>`, 'primary large', planned ? '' : 'disabled')}
        </div>
      </section>`;
  }

  // ── 开始与作答 ───────────────────────────────────────────────────────
  async function beginSession(ids, mode) {
    ids = [...new Set(ids)].filter(id => byId[id]);
    if (!ids.length) { toast('当前没有符合条件的题目，请调整筛选条件。'); return; }
    if (session && !session.finished) {
      const answered = session.items.filter(it => it.pick !== null).length;
      const yes = await confirmDialog('开始新的练习？', `你还有一份未完成的${modeName(session.mode)}（已答 ${answered}/${session.items.length} 题）。开始后会替换这份进度，已记录的练习成绩会保留。`, '开始新的练习');
      if (!yes) return;
    }
    session = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mode, items: ids.map(id => ({ id, order: shuffle(byId[id].options.map((_, i) => i)), pick: null, recorded: false, flagged: false })), i: 0, createdAt: Date.now(), startedAt: Date.now(), elapsed: 0, finished: false };
    page = 'quiz'; sheetPage = 0; reviewPage = 0; notesOpenFor = null;
    saveSession(); render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function startExam() {
    const signs = shuffle(BANK.filter(q => q.section === 'signs').map(q => q.id)).slice(0, META.exam.signs);
    const rules = shuffle(BANK.filter(q => q.section === 'rules').map(q => q.id)).slice(0, META.exam.rules);
    return beginSession([...signs, ...rules], 'exam');
  }
  function startPractice() {
    let ids = practicePool().map(q => q.id);
    if (randomOrder) ids = shuffle(ids);
    if (practiceCount !== 'all') ids = ids.slice(0, Number(practiceCount));
    beginSession(ids, 'practice');
  }
  function startQuick() {
    let candidates = shuffle(BANK.filter(q => !isMastered(q.id)));
    if (candidates.length < 20) candidates = [...candidates, ...shuffle(BANK.filter(q => isMastered(q.id)))];
    beginSession(candidates.slice(0, 20).map(q => q.id), 'practice');
  }
  function startReview(all = false) { const ids = dueIds(); beginSession(all ? ids : ids.slice(0, 20), 'review'); }
  function startSprint() {
    let ids = sprintPool().map(q => q.id);
    if (sprintCount !== 'all') ids = ids.slice(0, sprintCount);
    beginSession(shuffle(ids), 'sprint');
  }
  function startSmart(group = null) {
    const pool = BANK.filter(q => !group || q.group === group);
    const rank = q => { const h = hist[q.id] || { c: 0, w: 0 }; return (wrong[q.id] ? 100 : 0) + h.w * 5 - h.c * 2 + (h.c + h.w === 0 ? 10 : 0); };
    beginSession(shuffle(pool).sort((a, b) => rank(b) - rank(a)).slice(0, 20).map(q => q.id), Object.keys(wrong).length && !group ? 'wrong' : 'practice');
  }

  // 文字描述是图片的兜底：练习时图片加载失败或答题后才显示，模拟考试交卷前不显示。已失败的图片不再重复请求。
  function questionMarkup(item, reveal, exam = false) {
    const q = byId[item.id], correct = item.pick === q.answer_index, broken = brokenImages.has(q.image_url);
    const alt = exam && !reveal ? '本题道路标志图片' : (lang === 'en' ? q.sign_desc_en : q.sign_desc_zh) || '道路标志图片';
    const describe = (!exam || reveal) && (q.sign_desc_zh || q.sign_desc_en);
    const image = q.image_url ? `<figure class="signbox">
      <div class="sign-tile"><img data-src="${esc(q.image_url)}" ${broken ? 'hidden' : `src="${esc(q.image_url)}"`} alt="${esc(alt)}" loading="eager"></div>
      <p class="sign-fallback" ${broken ? '' : 'hidden'}>${icon('image')}<span>标志图片暂时无法加载，请检查网络后重试。</span>${btn('retry-image', '重新加载图片', 'ghost small')}</p>
      ${describe ? `<figcaption class="sign-description" ${reveal || broken ? '' : 'hidden'}>${textPair(q.sign_desc_zh, q.sign_desc_en)}</figcaption>` : ''}
    </figure>` : '';
    const options = item.order.map((oi, index) => {
      const picked = item.pick === oi, isAnswer = oi === q.answer_index;
      const cls = [picked ? 'selected' : '', reveal && isAnswer ? 'correct' : '', reveal && picked && !correct ? 'incorrect' : '', reveal && !picked && !isAnswer ? 'dim' : ''].join(' ');
      const status = reveal && isAnswer ? `${icon('check')}<span class="sr-only">正确答案</span>` : reveal && picked && !correct ? `${icon('close')}<span class="sr-only">你的选择</span>` : '';
      return `<button type="button" class="opt ${cls}" data-action="choose" data-option="${oi}" data-focus="option-${oi}" ${reveal ? 'disabled' : ''} aria-pressed="${picked}"><span class="option-key">${KEYS[index]}</span><span class="option-copy">${textPair(q.options[oi].zh, q.options[oi].en)}</span><span class="option-status">${status}</span></button>`;
    }).join('');
    const state = item.pick === null ? 'unanswered' : correct ? 'correct' : 'incorrect';
    const feedback = reveal ? `<section class="feedback ${state}" role="status">
      <div class="feedback-heading"><span class="feedback-icon">${icon(correct ? 'check' : item.pick === null ? 'note' : 'close')}</span><strong>${item.pick === null ? '本题未作答' : correct ? '回答正确，继续保持。' : '差一点，记住这个知识点。'}</strong><span class="feedback-answer">正确答案 ${KEYS[item.order.indexOf(q.answer_index)]}</span></div>
      <div class="explanation">${textPair(q.explanation_zh, q.explanation_en)}</div>
      <a class="source-link" href="${esc(q.source_url)}" target="_blank" rel="noopener noreferrer">${icon('book')}<span>${esc(q.source_title || '官方手册依据')}</span>${icon('external')}</a>
    </section>` : '';
    return `<div class="stem">${textPair(q.question_zh, q.question_en)}</div>${image}<div class="opts" role="group" aria-label="选项">${options}</div>${feedback}`;
  }
  function renderQuiz() {
    if (!session || session.finished) { page = session?.finished ? 'result' : 'home'; return render(); }
    const item = session.items[session.i], q = byId[item.id], n = session.items.length, isExam = session.mode === 'exam';
    const reveal = !isExam && item.pick !== null;
    const answered = session.items.filter(it => it.pick !== null).length, flags = session.items.filter(it => it.flagged).length;
    const last = session.i === n - 1, correct = session.items.filter(it => it.pick === byId[it.id].answer_index).length;
    const skip = !isExam && item.pick === null;
    sheetPage = Math.floor(session.i / 60);
    setHeader(modeName(session.mode), isExam ? '交卷前可以随时修改答案，交卷后再看对错。' : '看懂解析，再进入下一题。');
    const nextButton = last
      ? btn('finish', isExam ? `${icon('check')}<span>交卷</span>` : `<span>完成练习</span>${icon('check')}`, 'primary', 'data-focus="finish"')
      : btn('next', `<span>${skip ? '跳过' : '下一题'}</span>${icon('arrow')}`, skip ? 'ghost' : 'primary', 'data-focus="next"');
    view.innerHTML = `<div class="quiz-layout">
      <section class="panel question-panel">
        <div class="quiz-topline">
          <p class="quiz-position"><span class="sr-only">第 </span><strong>${pad2(session.i + 1)}</strong><span> / ${n}</span><span class="sr-only"> 题</span></p>
          <div class="question-tools">
            <button type="button" class="icon-btn ${bookmarks[q.id] ? 'active' : ''}" data-action="bookmark" data-focus="bookmark" title="收藏这道题（Shift+B）" aria-label="收藏这道题" aria-pressed="${!!bookmarks[q.id]}">${icon('bookmark')}</button>
            <button type="button" class="icon-btn ${item.flagged ? 'active flag' : ''}" data-action="flag" data-focus="flag" title="标记稍后回看" aria-label="标记稍后回看" aria-pressed="${item.flagged}">${icon('flag')}</button>
          </div>
        </div>
        ${progress(ratio(answered, n), 'quiz-progress', `已答 ${answered} / ${n} 题`)}
        <div class="question-meta"><span class="chip ${q.section}">${sectionNames[q.section]}</span><span class="meta-group">${esc(shortName(q.group))}</span>${q.difficulty ? `<span class="difficulty ${esc(q.difficulty)}">${difficultyNames[q.difficulty] || esc(q.difficulty)}</span>` : ''}<span class="question-id">${esc(q.id)}</span></div>
        ${questionMarkup(item, reveal, isExam)}
        ${(!isExam || reveal) ? `<details class="notes-box" ${notes[q.id] || notesOpenFor === q.id ? 'open' : ''}><summary data-focus="notes">${icon('note')}<span>我的笔记</span>${notes[q.id] ? '<span class="status-dot" aria-label="已有笔记"></span>' : ''}</summary><label class="sr-only" for="question-note">这道题的个人笔记</label><textarea id="question-note" maxlength="4000" rows="3" placeholder="写下易错点或记忆方法，笔记会自动保存。">${esc(notes[q.id] || '')}</textarea><span class="footnote">只保存在这台设备的浏览器里，可在“偏好与数据”导出备份。</span></details>` : ''}
        <div class="quiz-actions">
          <div class="actions-left">${btn('previous', `${icon('back')}<span>上一题</span>`, 'ghost', `data-focus="previous" aria-label="上一题" ${session.i === 0 ? 'disabled' : ''}`)}${btn('pause', `${icon('pause')}<span>保存并退出</span>`, 'ghost pause-button', 'data-focus="pause"')}</div>
          ${btn('toggle-sheet', `${icon('grid')}<span>答题卡</span><span class="sheet-count">${answered}/${n}</span>`, 'ghost sheet-toggle', 'aria-controls="quiz-sidebar" aria-expanded="false"')}
          <div class="actions-right">${nextButton}</div>
        </div>
        <div class="shortcut-row"><span><kbd>1</kbd>–<kbd>4</kbd> 或 <kbd>A</kbd>–<kbd>D</kbd> 选答案</span><span><kbd>Enter</kbd> 下一题</span><span><kbd>Shift</kbd>+<kbd>B</kbd> 收藏</span></div>
      </section>
      <button type="button" class="sheet-backdrop" data-action="close-sheet" aria-label="关闭答题卡" tabindex="-1"></button>
      <aside class="quiz-sidebar" id="quiz-sidebar" aria-label="答题卡与进度">
        <div class="sheet-header"><strong>答题卡与进度</strong><button type="button" class="icon-btn" data-action="close-sheet" aria-label="关闭答题卡">${icon('close')}</button></div>
        <section class="panel session-summary">
          <div class="section-head"><h3>${isExam ? '本次模拟' : '本次练习'}</h3><span class="chip live"><span class="status-dot"></span>进行中</span></div>
          <div class="session-timer">${icon('clock')}<strong id="session-timer">${timeLabel(elapsed())}</strong><span>已用时间</span></div>
          <div class="session-counts"><div><strong>${answered}<small>/ ${n}</small></strong><span>已完成</span></div><div><strong>${isExam ? flags : answered ? `${ratio(correct, answered)}%` : '—'}</strong><span>${isExam ? '标记回看' : '当前正确率'}</span></div></div>
          ${progress(ratio(answered, n), '', `已答 ${answered} / ${n} 题`)}
          <p class="footnote">${isExam ? `标志 ${META.exam.signs} 题 + 交规 ${META.exam.rules} 题，每部分都要达到 ${META.exam.pass_ratio * 100}%。` : '练习记录自动保存，随时可以回来继续。'}</p>
          ${isExam ? btn('finish', '提前交卷', 'ghost small block') : ''}
        </section>
        <section class="panel answer-sheet">
          <div class="section-head"><h3>答题卡</h3><span class="muted">第 ${session.i + 1} / ${n} 题</span></div>
          <div class="answer-legend">${isExam ? '<span><i class="legend-dot answered"></i>已答</span>' : '<span><i class="legend-dot correct"></i>答对</span><span><i class="legend-dot incorrect"></i>答错</span>'}<span><i class="legend-dot flagged"></i>待回看 ${flags}</span></div>
          <div id="answer-sheet-content">${answerGrid()}</div>
          <div class="sheet-actions">${btn('jump-unanswered', '下一道未答', 'ghost small')}${btn('jump-flagged', '查看标记题', 'ghost small', flags ? '' : 'disabled')}</div>
        </section>
        <p class="quiz-tip">${icon('spark')}<span>${isExam ? '遇到不确定的题先标记，交卷前回到这里检查。' : '看懂解析再前进，把答案背后的规则变成自己的判断。'}</span></p>
      </aside>
    </div>`;
    bindImages();
  }
  function answerGrid() {
    const n = session.items.length, pages = Math.ceil(n / 60);
    sheetPage = Math.max(0, Math.min(pages - 1, sheetPage));
    const reveal = session.mode !== 'exam' || session.finished;
    return `<div class="answer-grid" role="group" aria-label="题目导航">${session.items.slice(sheetPage * 60, sheetPage * 60 + 60).map((it, k) => {
      const i = sheetPage * 60 + k, correct = it.pick === byId[it.id].answer_index;
      const cls = [i === session.i ? 'current' : '', it.pick !== null ? 'answered' : '', reveal && it.pick !== null ? (correct ? 'correct' : 'incorrect') : '', it.flagged ? 'flagged' : ''].join(' ');
      return `<button type="button" class="answer-cell ${cls}" data-action="jump" data-index="${i}" aria-label="第 ${i + 1} 题，${it.pick === null ? '未答' : reveal ? (correct ? '答对' : '答错') : '已答'}${it.flagged ? '，已标记' : ''}" ${i === session.i ? 'aria-current="step"' : ''}>${i + 1}</button>`;
    }).join('')}</div>${pages > 1 ? `<div class="pagination compact">${btn('sheet-prev', '上一页', 'ghost small', sheetPage === 0 ? 'disabled' : '')}<span>${sheetPage + 1} / ${pages}</span>${btn('sheet-next', '下一页', 'ghost small', sheetPage === pages - 1 ? 'disabled' : '')}</div>` : ''}`;
  }
  function bindImages() { view.querySelectorAll('.signbox img[src]').forEach(watchImage); }
  function watchImage(img) {
    img.addEventListener('error', () => {
      const box = img.closest('.signbox');
      brokenImages.add(img.dataset.src); img.hidden = true;
      box.querySelector('.sign-fallback').hidden = false;
      box.querySelector('.sign-description')?.removeAttribute('hidden');
    }, { once: true });
  }
  function record(item) {
    if (item.recorded || item.pick === null) return;
    const q = byId[item.id], correct = item.pick === q.answer_index, h = hist[q.id] || { c: 0, w: 0 };
    h[correct ? 'c' : 'w']++; hist[q.id] = h;
    // 错题复习、今日复习和考前冲刺里答对，错题移出错题本；其他模式只记成绩。
    if (!correct) wrong[q.id] = (wrong[q.id] || 0) + 1; else if (['wrong', 'review', 'sprint'].includes(session.mode)) delete wrong[q.id];
    schedule(q.id, correct);
    const a = activity[dateKey()] || { c: 0, w: 0 };
    a[correct ? 'c' : 'w']++; activity[dateKey()] = a; item.recorded = true;
    storage.set('g1-hist', hist); storage.set('g1-wrong', wrong); storage.set('g1-activity', activity);
  }
  function choose(index) {
    if (page !== 'quiz' || !session || session.finished) return;
    const item = session.items[session.i], q = byId[item.id];
    if (!Number.isInteger(index) || index < 0 || index >= q.options.length || (session.mode !== 'exam' && item.pick !== null)) return;
    item.pick = index;
    if (session.mode !== 'exam') record(item);
    saveSession(); render(true);
    view.querySelectorAll('.feedback, .opt.correct').forEach(el => el.classList.add('fresh'));
    // 练习：焦点移到“下一题/完成练习”；考试：焦点跟着所选答案，按 Enter 即进入下一题。
    view.querySelector(session.mode === 'exam' ? `.opt[data-option="${index}"]` : '.quiz-actions [data-action="next"], .quiz-actions [data-action="finish"]')?.focus({ preventScroll: true });
  }
  function moveTo(index) {
    if (!session || index < 0 || index >= session.items.length) return;
    session.i = index; saveSession(); render();
    view.querySelector('.question-panel')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function nextQuestion() { if (!session) return; if (session.i < session.items.length - 1) moveTo(session.i + 1); else finishSession(); }
  async function finishSession() {
    if (!session || session.finished) return;
    const unanswered = session.items.filter(it => it.pick === null).length;
    if (unanswered) {
      const exam = session.mode === 'exam';
      const yes = await confirmDialog(exam ? '还有未作答的题目' : '结束这次练习？', `还有 ${unanswered} 道题没有作答。${exam ? '这些题会按未答计入考试结果，交卷后无法修改。' : '结束后可以在结果页重新练习未答题。'}`, exam ? '确认交卷' : '结束并查看结果');
      if (!yes) return;
    }
    openSheet(false); pauseSession();
    if (session.mode === 'exam') session.items.forEach(record);
    session.finished = true; session.finishedAt = Date.now();
    const correct = session.items.filter(it => it.pick === byId[it.id].answer_index).length, answered = session.items.filter(it => it.pick !== null).length;
    const parts = examParts(session), passed = session.mode === 'exam' && parts.every(p => p.pass);
    const entry = { id: session.id, mode: session.mode, total: session.items.length, correct, answered, duration: session.elapsed, finishedAt: session.finishedAt, passed };
    if (session.mode === 'exam') { entry.signs = { c: parts[0].c, n: parts[0].n }; entry.rules = { c: parts[1].c, n: parts[1].n }; }
    sessions.push(entry);
    sessions = sessions.slice(-100);
    storage.set('g1-sessions', sessions); storage.set('g1-session', null);
    page = 'result'; reviewPage = 0; openReviews.clear(); render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function examParts(s) {
    return ['signs', 'rules'].map(section => {
      const items = s.items.filter(it => byId[it.id].section === section), c = items.filter(it => it.pick === byId[it.id].answer_index).length, need = Math.ceil(items.length * META.exam.pass_ratio);
      return { section, n: items.length, c, need, pass: c >= need };
    });
  }

  // ── 成绩页 ───────────────────────────────────────────────────────────
  function renderResult() {
    if (!session?.finished) { page = 'home'; return render(); }
    const n = session.items.length, c = session.items.filter(it => it.pick === byId[it.id].answer_index).length, unanswered = session.items.filter(it => it.pick === null).length;
    const w = n - c - unanswered, isExam = session.mode === 'exam', parts = examParts(session), passed = parts.every(p => p.pass), pct = ratio(c, n);
    const revisit = session.items.filter(it => it.pick !== byId[it.id].answer_index), pages = Math.ceil(revisit.length / 8);
    reviewPage = Math.min(Math.max(0, pages - 1), reviewPage);
    const tone = isExam ? (passed ? 'pass' : 'fail') : 'done';
    setHeader(isExam ? '模拟考试结果' : '练习完成', isExam ? '读懂每道错题，比一个分数更有价值。' : '每次练习，都在为更从容的出发做准备。');
    view.innerHTML = `
      <section class="panel result-hero ${tone}">
        <div class="result-main">
          <div class="score-ring">${ring(pct, 172, 14)}<div class="score-label"><strong>${pct}<small>%</small></strong><span>正确率</span></div></div>
          <div class="result-copy">
            <span class="result-badge">${isExam ? (passed ? `${icon('check')}模拟通过` : `${icon('target')}暂未通过`) : `${icon('check')}${modeName(session.mode)}完成`}</span>
            <h2>${isExam ? (passed ? '这次模拟，通过。' : '找到薄弱点，就是进步的开始。') : '又向前迈进了一步。'}</h2>
            <p class="result-meta">完成 ${n - unanswered} 道作答 · 用时 ${timeLabel(session.elapsed)}</p>
            <div class="result-grid">
              <div class="result-stat correct"><strong>${c}</strong><span>答对</span></div>
              <div class="result-stat incorrect"><strong>${w}</strong><span>答错</span></div>
              <div class="result-stat"><strong>${unanswered}</strong><span>未作答</span></div>
              <div class="result-stat"><strong>${timeLabel(session.elapsed)}</strong><span>用时</span></div>
            </div>
          </div>
        </div>
        ${isExam ? `<div class="result-parts">${parts.map(p => `<div class="result-part ${p.pass ? 'pass' : 'fail'}">
          <div class="part-head"><span class="part-name">${icon(p.section === 'signs' ? 'stop' : 'car')}${sectionNames[p.section]}</span><strong class="part-score">${p.c} / ${p.n}</strong></div>
          <div class="part-meter" role="img" aria-label="${sectionNames[p.section]}答对 ${p.c} 道，共 ${p.n} 道，及格线 ${p.need} 道"><i style="width:${ratio(p.c, p.n)}%"></i><b style="left:${META.exam.pass_ratio * 100}%"></b></div>
          <span class="part-status">${icon(p.pass ? 'check' : 'close')}${p.pass ? '已达到' : '未达到'} ${p.need} 道及格线</span>
        </div>`).join('')}</div><p class="result-note">${esc(META.exam.note)}</p>` : ''}
        <div class="result-actions">
          ${revisit.length ? btn('retry-result', `${icon('repeat')}<span>重练错题与未答题</span>`, 'primary') : btn('quick', `${icon('play')}<span>再来一组练习</span>`, 'primary')}
          ${isExam ? btn('start-exam', '再考一次', 'secondary') : ''}
          ${btn('navigate', '回到学习总览', 'ghost', 'data-page-target="home"')}
        </div>
      </section>
      ${revisit.length ? `<section class="panel result-review">
        <div class="section-head"><div><h3>回看 ${revisit.length} 道错题与未答题</h3><p class="section-sub">点开查看正确答案和解析</p></div></div>
        <div class="review-list">${revisit.slice(reviewPage * 8, reviewPage * 8 + 8).map(it => {
          const q = byId[it.id];
          return `<details class="review-item" data-review="${esc(it.id)}" ${openReviews.has(it.id) ? 'open' : ''}>
            <summary><span class="review-status ${it.pick === null ? 'unanswered' : 'incorrect'}">${icon(it.pick === null ? 'note' : 'close')}</span><span class="review-summary"><small>${esc(it.id)} · ${esc(shortName(q.group))} · ${it.pick === null ? '未作答' : '答错'}</small><strong>${esc(lang === 'en' ? q.question_en : q.question_zh)}</strong></span>${icon('chevron', 'review-chevron')}</summary>
            <div class="review-question">${questionMarkup(it, true, isExam)}<div class="review-tools"><button class="btn ghost small" type="button" data-action="bookmark-id" data-id="${esc(it.id)}" aria-pressed="${!!bookmarks[it.id]}">${icon('bookmark')}<span>${bookmarks[it.id] ? '已收藏' : '收藏这道题'}</span></button></div></div>
          </details>`;
        }).join('')}</div>
        ${pages > 1 ? `<div class="pagination">${btn('review-prev', '上一页', 'ghost small', reviewPage === 0 ? 'disabled' : '')}<span>${reviewPage + 1} / ${pages}</span>${btn('review-next', '下一页', 'ghost small', reviewPage === pages - 1 ? 'disabled' : '')}</div>` : ''}
      </section>` : `<section class="panel empty-state">${icon('spark')}<h3>本次没有错题</h3><p>保持节奏，去挑战更多主题。</p></section>`}`;
    bindImages();
  }

  // ── 错题本与收藏 ─────────────────────────────────────────────────────
  function collectionIds() {
    const source = page === 'wrong' ? wrong : bookmarks, term = collectionSearch.trim().toLowerCase();
    return Object.keys(source).filter(id => {
      const q = byId[id];
      return q && (collectionGroup === 'all' || q.group === collectionGroup) && (!term || `${q.id} ${q.question_zh} ${q.question_en} ${q.topic_zh}`.toLowerCase().includes(term));
    });
  }
  function renderCollection() {
    const isWrong = page === 'wrong', total = Object.keys(isWrong ? wrong : bookmarks).length, ids = collectionIds(), pages = Math.ceil(ids.length / 12);
    collectionPage = Math.min(collectionPage, Math.max(0, pages - 1));
    setHeader(isWrong ? '错题本' : '我的收藏', isWrong ? '把薄弱点变成得分点，每一次回看都值得。' : '重要的知识点，值得多看一次。');
    view.innerHTML = `
      <div class="page-intro">
        <div><h2>${isWrong ? '错过的题，再从容答对。' : '为重要的规则，留个位置。'}</h2><p>${isWrong ? `共 ${total} 道错题，复习时答对就会自动移出。` : `共 ${total} 道收藏，可以随时开始专项练习。`}</p></div>
        ${btn('start-collection', `${icon('play')}<span>开始${isWrong ? '错题复习' : '收藏练习'}</span>`, 'primary', ids.length ? '' : 'disabled')}
      </div>
      ${total ? `<section class="panel collection-panel">
        <div class="toolbar">
          <label class="search-field" for="collection-search">${icon('search')}<input id="collection-search" type="search" placeholder="搜索题目、关键词或题号" value="${esc(collectionSearch)}" autocomplete="off"></label>
          <label class="select-field" for="collection-group"><span class="sr-only">按章节筛选</span><select id="collection-group"><option value="all">全部章节</option>${GROUPS.map(g => `<option value="${g.id}" ${collectionGroup === g.id ? 'selected' : ''}>${esc(shortName(g.id))}</option>`).join('')}</select></label>
        </div>
        <div class="list-head"><span>${ids.length} 道符合条件</span><div class="row export-row">${btn('export-md', `${icon('download')}<span>导出 Markdown</span>`, 'ghost small', ids.length ? '' : 'disabled')}${btn('export-csv', `${icon('download')}<span>导出 CSV</span>`, 'ghost small', ids.length ? '' : 'disabled')}${btn('print-answers', `${icon('note')}<span>打印（含答案）</span>`, 'ghost small', ids.length ? '' : 'disabled')}${btn('print-blank', `${icon('note')}<span>打印练习卷</span>`, 'ghost small', ids.length ? '' : 'disabled')}</div></div>
        <div class="review-list">${ids.length ? ids.slice(collectionPage * 12, collectionPage * 12 + 12).map(id => {
          const q = byId[id], h = hist[id] || { c: 0, w: 0 };
          return `<article class="review-row">
            <span class="review-type ${q.section}">${icon(groupIcons[q.group])}</span>
            <div class="review-copy">
              <div class="question-meta"><span class="chip ${q.section}">${esc(shortName(q.group))}</span><span>${esc(id)}</span>${isWrong ? `<span class="wrong-count">答错 ${wrong[id]} 次</span>` : ''}</div>
              <h3>${esc(lang === 'en' ? q.question_en : q.question_zh)}</h3>
              ${lang === 'both' ? `<p class="en" lang="en">${esc(q.question_en)}</p>` : ''}
              <small>${h.c + h.w ? `已练 ${h.c + h.w} 次 · 答对 ${h.c} 次` : '还没有练过'}</small>
            </div>
            <div class="review-actions">${btn('practice-one', '练这道题', 'secondary small', `data-id="${id}"`)}<button class="icon-btn bordered ${bookmarks[id] ? 'active' : ''}" type="button" data-action="bookmark-id" data-id="${id}" aria-label="收藏" aria-pressed="${!!bookmarks[id]}">${icon('bookmark')}</button></div>
          </article>`;
        }).join('') : `<div class="empty-state">${icon('search')}<h3>没有匹配的题目</h3><p>试试其他关键词，或者调整章节筛选。</p>${btn('clear-collection-search', '清空筛选', 'ghost')}</div>`}</div>
        ${pages > 1 ? `<div class="pagination">${btn('collection-prev', '上一页', 'ghost small', collectionPage === 0 ? 'disabled' : '')}<span>${collectionPage + 1} / ${pages}</span>${btn('collection-next', '下一页', 'ghost small', collectionPage === pages - 1 ? 'disabled' : '')}</div>` : ''}
      </section>` : `<section class="panel empty-state collection-empty">
        <span class="empty-illustration">${icon(isWrong ? 'check' : 'bookmark')}</span>
        <h3>${isWrong ? '错题本还是空的' : '你的收藏，从一道好题开始'}</h3>
        <p>${isWrong ? '继续练习，答错的题会自动收进这里。' : '答题时点右上角的书签图标，就能把重要的题放在这里。'}</p>
        ${btn('navigate', '去分类练习', 'primary', 'data-page-target="practice"')}
      </section>`}`;
  }

  // ── 必背速查 ─────────────────────────────────────────────────────────
  // 内容来自 data/cheat.json、data/info.json，由 build.py 解析成块结构内嵌（REF）。块里的 HTML 已在生成时转义。
  function filterItems(items, test) {
    return items.flatMap(it => {
      if (test(stripTags(it.html))) return [it];
      const children = (it.children || []).map(c => ({ ...c, items: filterItems(c.items, test) })).filter(c => c.items.length);
      return children.length ? [{ ...it, children }] : [];
    });
  }
  // 搜索时只留下命中的段落、表格行和列表条目；命中小标题时带出它下面的全部内容，命中内容也会带上所属小标题。
  function filterBlocks(blocks, test) {
    const keep = new Set(), result = blocks.slice();
    let hits = 0, h3 = -1, h4 = -1, open = 0;
    blocks.forEach((b, i) => {
      if (b.t === 'h3' || b.t === 'h4') {
        const level = b.t === 'h3' ? 3 : 4;
        if (level === 3) { h3 = i; h4 = -1; } else h4 = i;
        if (open && level > open) { keep.add(i); return; }
        open = test(stripTags(b.html)) ? level : 0;
        if (open) { keep.add(i); hits++; if (level === 4 && h3 >= 0) keep.add(h3); }
        return;
      }
      if (open) { keep.add(i); return; }
      let kept = null;
      if (b.t === 'table') {
        const rows = test(b.head.map(stripTags).join(' ')) ? b.rows : b.rows.filter(r => test(r.map(stripTags).join(' ')));
        if (rows.length) { kept = { ...b, rows }; hits += rows.length; }
      } else if (b.t === 'ul' || b.t === 'ol') {
        const items = filterItems(b.items, test);
        if (items.length) { kept = { ...b, items }; hits += items.length; }
      } else if (b.t !== 'links' && test(stripTags(b.html))) { kept = b; hits++; }
      if (kept) { result[i] = kept; keep.add(i); if (h3 >= 0) keep.add(h3); if (h4 >= 0) keep.add(h4); }
    });
    return { blocks: result.filter((_, i) => keep.has(i)), hits };
  }
  function refList(b) {
    const tag = b.t === 'ol' ? 'ol' : 'ul';
    return `<${tag} class="ref-list">${b.items.map(it => `<li>${it.html}${(it.children || []).map(refList).join('')}</li>`).join('')}</${tag}>`;
  }
  function refBlock(b) {
    if (b.t === 'h3') return `<h3 class="ref-h3">${b.html}</h3>`;
    if (b.t === 'h4') return `<h4 class="ref-h4">${b.html}</h4>`;
    if (b.t === 'ul' || b.t === 'ol') return refList(b);
    if (b.t === 'quote') return `<blockquote class="ref-quote">${b.html}</blockquote>`;
    if (b.t === 'links') return `<p class="ref-links">${icon('book')}<span>${b.html}</span></p>`;
    if (b.t === 'table') {
      const labels = b.head.map(stripTags);
      return `<div class="ref-table cols-${b.head.length}"><table><thead><tr>${b.head.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, i) => i ? `<td data-label="${esc(labels[i])}">${c}</td>` : `<th scope="row">${c}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    return `<p>${b.html}</p>`;
  }
  function refResults(doc, test) {
    return doc.sections.map((s, i) => {
      if (!test) return { s, i, blocks: s.blocks, hits: 0 };
      if (test(s.title)) return { s, i, blocks: s.blocks, hits: 1 };
      const r = filterBlocks(s.blocks, test);
      return { s, i, blocks: r.blocks, hits: r.hits };
    }).filter(x => !test || x.hits);
  }
  function renderReference() {
    setHeader('必背速查', '考前快速翻看：关键数字、扣分、标志和考试须知。');
    const test = matcher(refSearch), docs = REF.docs || [];
    const doc = docs.find(d => d.id === refDoc) || docs[0];
    if (!doc) { view.innerHTML = `<section class="panel empty-state">${icon('note')}<h3>没有速查资料</h3></section>`; return; }
    const results = refResults(doc, test), hits = results.reduce((n, x) => n + x.hits, 0);
    const others = test ? docs.filter(d => d !== doc).map(d => ({ d, hits: refResults(d, test).reduce((n, x) => n + x.hits, 0) })).filter(o => o.hits) : [];
    const shortTitle = d => d.id === 'cheat' ? '必背要点' : d.id === 'info' ? '考试须知' : d.title;
    view.innerHTML = `
      <section class="panel ref-toolbar">
        <div class="toolbar">
          ${segmented('ref-doc', '速查资料', docs.map(d => [d.id, shortTitle(d)]), doc.id)}
          <label class="search-field" for="ref-search">${icon('search')}<input id="ref-search" type="search" placeholder="搜规则、数字或英文，如：扣分、30 m、school bus" value="${esc(refSearch)}" autocomplete="off"></label>
          ${btn('print-page', `${icon('note')}<span>打印</span>`, 'ghost print-button')}
        </div>
        ${test ? `<p class="ref-summary" role="status">${hits ? `在「${shortTitle(doc)}」找到 ${hits} 处` : `「${shortTitle(doc)}」里没有找到`}${others.map(o => `；「${shortTitle(o.d)}」有 ${o.hits} 处 <button type="button" class="link-button" data-action="ref-doc" data-value="${o.d.id}">去看看</button>`).join('')}</p>` : `<p class="ref-summary">${esc(doc.title)}</p>`}
      </section>
      <div class="ref-layout">
        ${results.length ? `<nav class="ref-toc" aria-label="章节目录">${results.map(x => `<a href="#ref-${doc.id}-${x.i}" data-action="ref-jump" data-target="ref-${doc.id}-${x.i}">${esc(x.s.title)}${test ? `<small>${x.hits}</small>` : ''}</a>`).join('')}</nav>` : ''}
        <div class="ref-content">
          ${!test && doc.intro.length ? `<section class="panel ref-intro">${doc.intro.map(refBlock).join('')}</section>` : ''}
          ${results.length ? results.map(x => `<section class="panel ref-section" id="ref-${doc.id}-${x.i}"><h2>${esc(x.s.title)}</h2>${x.blocks.map(refBlock).join('')}</section>`).join('') : `<section class="panel empty-state">${icon('search')}<h3>没有找到相关内容</h3><p>换个说法试试，比如“酒驾”“扣分”“stop sign”；也可以去题库搜索里找相关题目。</p>${btn('bank-from-ref', '在题库里搜索', 'ghost')}</section>`}
        </div>
      </div>`;
    highlight(view.querySelector('.ref-content'), queryTokens(refSearch));
  }

  // ── 题库搜索 ─────────────────────────────────────────────────────────
  const FIELD_NAMES = { question: '题干', options: '选项', explanation: '解析', sign: '标志描述', meta: '章节 / 题号' };
  function searchIndex() {
    if (!bankIndex) {
      bankIndex = BANK.map(q => {
        const fields = {
          question: `${q.question_zh} ${q.question_en}`,
          options: q.options.map(o => `${o.zh} ${o.en}`).join(' '),
          explanation: `${q.explanation_zh} ${q.explanation_en}`,
          sign: `${q.sign_desc_zh || ''} ${q.sign_desc_en || ''}`,
          meta: `${q.id} ${q.topic_zh} ${shortName(q.group)} ${q.source_title || ''}`,
        };
        const packed = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, compact(v)]));
        return { q, fields: packed, all: Object.values(packed).join('|') };
      });
    }
    return bankIndex;
  }
  function bankResults() {
    const tokens = queryTokens(bankSearch);
    if (!tokens.length) return [];
    return searchIndex()
      .filter(e => (bankSection === 'all' || e.q.section === bankSection) && tokens.every(t => e.all.includes(t)))
      .map(e => ({ q: e.q, where: Object.keys(FIELD_NAMES).filter(k => tokens.some(t => e.fields[k].includes(t))) }))
      .sort((a, b) => (b.where[0] === 'question') - (a.where[0] === 'question'));
  }
  function renderSearch() {
    setHeader('题库搜索', '题干、选项、解析都能搜，中英文都可以。');
    const results = bankResults(), pages = Math.ceil(results.length / 20);
    bankPage = Math.min(bankPage, Math.max(0, pages - 1));
    const examples = ['校车', '扣分', '黄灯', 'roundabout', 'school bus', '30 km/h', '施工区', '酒驾'];
    view.innerHTML = `
      <section class="panel search-panel">
        <div class="toolbar">
          <label class="search-field large" for="bank-search">${icon('search')}<input id="bank-search" type="search" placeholder="输入关键词，多个词用空格隔开" value="${esc(bankSearch)}" autocomplete="off"></label>
          ${segmented('bank-section', '搜索范围', [['all', '全部'], ['rules', '交通规则'], ['signs', '道路标志']], bankSection)}
        </div>
        <div class="search-tips"><span>试试：</span>${examples.map(t => `<button type="button" class="search-chip" data-action="search-example" data-value="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      </section>
      ${bankSearch.trim() ? `<section class="panel search-results-panel">
        <div class="list-head" role="status"><span>${results.length ? `找到 ${results.length} 道题` : '没有找到相关题目'}</span>${pages > 1 ? `<span>每页 20 道</span>` : ''}</div>
        ${results.length ? `<div class="search-results">${results.slice(bankPage * 20, bankPage * 20 + 20).map(({ q, where }) => {
          const deep = !where.includes('question');
          return `<article class="search-result">
            <div class="question-meta"><span class="chip ${q.section}">${esc(shortName(q.group))}</span><span>${esc(q.id)}</span>${q.difficulty ? `<span class="difficulty ${esc(q.difficulty)}">${difficultyNames[q.difficulty] || ''}</span>` : ''}<span class="match-where">匹配：${where.map(k => FIELD_NAMES[k]).join('、')}</span></div>
            <div class="search-stem">${textPair(q.question_zh, q.question_en)}</div>
            <details class="search-answer" ${deep ? 'open' : ''}><summary>${icon('chevron', 'review-chevron')}<span>选项、答案与解析</span></summary>
              <ol class="search-options">${q.options.map((o, i) => `<li class="${i === q.answer_index ? 'is-answer' : ''}"><span class="option-key">${KEYS[i]}</span><span class="option-copy">${textPair(o.zh, o.en)}</span>${i === q.answer_index ? `<span class="answer-tag">${icon('check')}正确答案</span>` : ''}</li>`).join('')}</ol>
              <div class="explanation">${textPair(q.explanation_zh, q.explanation_en)}</div>
              ${q.sign_desc_zh || q.sign_desc_en ? `<p class="sign-note">标志：${textPair(q.sign_desc_zh, q.sign_desc_en)}</p>` : ''}
              <a class="source-link" href="${esc(q.source_url)}" target="_blank" rel="noopener noreferrer">${icon('book')}<span>${esc(q.source_title || '官方手册依据')}</span>${icon('external')}</a>
            </details>
            <div class="review-actions">${btn('practice-one', '练这道题', 'secondary small', `data-id="${q.id}"`)}<button class="icon-btn bordered ${bookmarks[q.id] ? 'active' : ''}" type="button" data-action="bookmark-id" data-id="${q.id}" aria-label="收藏" aria-pressed="${!!bookmarks[q.id]}">${icon('bookmark')}</button></div>
          </article>`;
        }).join('')}</div>` : `<div class="empty-state">${icon('search')}<h3>换个关键词试试</h3><p>可以用中文或英文，多个词之间加空格；也可以去必背速查里找规则原文。</p>${btn('ref-from-bank', '去必背速查', 'ghost')}</div>`}
        ${pages > 1 ? `<div class="pagination">${btn('bank-prev', '上一页', 'ghost small', bankPage === 0 ? 'disabled' : '')}<span>${bankPage + 1} / ${pages}</span>${btn('bank-next', '下一页', 'ghost small', bankPage === pages - 1 ? 'disabled' : '')}</div>` : ''}
      </section>` : `<section class="panel empty-state search-empty"><span class="empty-illustration">${icon('search')}</span><h3>在 ${BANK.length} 道题里找答案</h3><p>输入关键词，题干、选项、解析和标志描述里出现的都会找出来。</p></section>`}`;
    highlight(view.querySelector('.search-results'), queryTokens(bankSearch));
  }

  // ── 学习统计 ─────────────────────────────────────────────────────────
  // 学习日历：最近 12 周，颜色深浅按当天练习量相对每日目标分 4 档（同一色相、由浅到深）。
  function heatmap() {
    const end = new Date(); end.setHours(12, 0, 0, 0);
    const start = new Date(end); start.setDate(end.getDate() - ((end.getDay() + 6) % 7) - 7 * 11);
    const level = n => !n ? 0 : n < prefs.goal / 2 ? 1 : n < prefs.goal ? 2 : n < prefs.goal * 2 ? 3 : 4;
    // 按列排布：第一列是星期标签，之后每列一周（月份 + 周一到周日）。
    const cells = ['<span class="heat-month"></span>', ...['一', '', '三', '', '五', '', '日'].map(d => `<span class="heat-day">${d}</span>`)], active = [];
    for (let w = 0; w < 12; w++) {
      const monday = new Date(start); monday.setDate(start.getDate() + w * 7);
      cells.push(`<span class="heat-month">${w === 0 || monday.getDate() <= 7 ? `${monday.getMonth() + 1}月` : ''}</span>`);
      for (let d = 0; d < 7; d++) {
        const day = new Date(monday); day.setDate(monday.getDate() + d);
        if (day > end) { cells.push('<span class="heat-cell future"></span>'); continue; }
        const key = dateKey(day), a = activity[key] || { c: 0, w: 0 }, n = a.c + a.w;
        if (n) active.push({ key, n, c: a.c });
        cells.push(`<span class="heat-cell l${level(n)}" title="${key}：${n} 题"></span>`);
      }
    }
    const total = active.reduce((n, d) => n + d.n, 0);
    return `<figure class="chart heatmap">
      <div class="heat-grid" role="img" aria-label="最近 12 周有 ${active.length} 天练习，共 ${total} 题">${cells.join('')}</div>
      <figcaption class="heat-legend"><span>少</span>${[0, 1, 2, 3, 4].map(l => `<i class="heat-cell l${l}"></i>`).join('')}<span>多</span><em>第三档起表示达到每日目标（${prefs.goal} 题）</em></figcaption>
      ${active.length ? `<details class="chart-table"><summary>查看每日数据</summary><table><thead><tr><th scope="col">日期</th><th scope="col">练习题数</th><th scope="col">答对</th></tr></thead><tbody>${active.slice().reverse().map(d => `<tr><td>${d.key}</td><td>${d.n}</td><td>${d.c}</td></tr>`).join('')}</tbody></table></details>` : ''}
    </figure>`;
  }
  function historyRow(s) {
    const exam = s.mode === 'exam';
    return `<div class="history-row"><span class="history-icon ${exam ? 'exam' : ''}">${icon({ exam: 'clipboard', wrong: 'history', bookmarks: 'bookmark', review: 'repeat', sprint: 'bolt' }[s.mode] || 'book')}</span><span class="history-copy"><strong>${modeName(s.mode)}${exam ? ` <span class="chip ${s.passed ? 'ok' : 'warn'}">${s.passed ? '通过' : '未通过'}</span>` : ''}</strong><small>${esc(new Date(s.finishedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))} · 用时 ${timeLabel(s.duration)}</small></span><span class="history-score"><strong>${s.correct} / ${s.total}</strong><small>${ratio(s.correct, s.total)}%</small></span></div>`;
  }
  function reviewPlanPanel() {
    const tracked = Object.values(srs);
    if (!tracked.length) return '';
    const strength = [tracked.filter(s => s.b <= 1).length, tracked.filter(s => s.b >= 2 && s.b <= 3).length, tracked.filter(s => s.b >= 4).length];
    return `<section class="panel review-plan">
      <div class="section-head"><div><h3>复习计划</h3><p class="section-sub">${tracked.length} 道练过的题按遗忘规律排期；记得越牢，下次复习隔得越久</p></div>${btn('start-review', `${icon('repeat')}<span>复习到期的题</span>`, 'secondary small', dueIds().length ? '' : 'disabled')}</div>
      <div class="plan-grid">
        <div class="plan-strength">
          <div class="plan-row"><span>刚学 / 易忘</span><strong>${strength[0]}</strong><small>1–2 天内再复习</small></div>
          <div class="plan-row"><span>巩固中</span><strong>${strength[1]}</strong><small>4–7 天后复习</small></div>
          <div class="plan-row"><span>记得牢</span><strong>${strength[2]}</strong><small>半个月以上再复习</small></div>
        </div>
        <div class="plan-forecast">${forecastBars(forecast(7))}</div>
      </div>
    </section>`;
  }
  function renderStats() {
    const t = totals(), exams = sessions.filter(s => s.mode === 'exam'), pass = exams.filter(s => s.passed).length;
    const seenOnly = t.seen - t.mastered, unseen = BANK.length - t.seen;
    setHeader('学习统计', '用真实的积累，看见自己的进步。');
    view.innerHTML = `
      <div class="stat-grid">
        ${statCard('chart', t.attempts, '累计作答', `${t.seen} 道不同题目`, 'tone-green')}
        ${statCard('target', t.attempts ? `${t.accuracy}<small>%</small>` : '—', '累计正确率', `${t.correct} 次答对 · ${t.incorrect} 次答错`, 'tone-blue')}
        ${statCard('fire', `${streakDays()}<small>天</small>`, '连续学习', '按每天实际练习统计', 'tone-amber')}
        ${statCard('trophy', `${pass}<small>/ ${exams.length}</small>`, '模拟通过次数', '只统计已交卷的模拟考试', 'tone-violet')}
      </div>
      <div class="stats-grid">
        <section class="panel"><div class="section-head"><div><h3>学习日历</h3><p class="section-sub">最近 12 周每天的练习量</p></div></div>${heatmap()}</section>
        <section class="panel coverage-card">
          <div class="section-head"><h3>题库覆盖</h3><span class="chip">${ratio(t.seen, BANK.length)}%</span></div>
          <p class="coverage-number"><strong>${t.seen}</strong><span>/ ${BANK.length} 道已练</span></p>
          <div class="stack-bar large" role="img" aria-label="已掌握 ${t.mastered} 道，练过未掌握 ${seenOnly} 道，未练 ${unseen} 道"><i class="mastered" style="width:${t.mastered / BANK.length * 100}%"></i><i class="seen" style="width:${seenOnly / BANK.length * 100}%"></i></div>
          <ul class="coverage-legend"><li><i class="sw mastered"></i>已掌握<strong>${t.mastered}</strong></li><li><i class="sw seen"></i>练过未掌握<strong>${seenOnly}</strong></li><li><i class="sw unseen"></i>未练<strong>${unseen}</strong></li></ul>
          <p class="footnote">已掌握：至少答对一次，且答对次数不少于答错次数。</p>
          ${btn('navigate', '继续拓展新题', 'secondary', 'data-page-target="practice"')}
        </section>
      </div>
      <section class="panel">
        <div class="section-head"><div><h3>章节掌握情况</h3><p class="section-sub">点击某一章，练这一章最需要巩固的 20 题</p></div><ul class="coverage-legend inline" aria-hidden="true"><li><i class="sw mastered"></i>已掌握</li><li><i class="sw seen"></i>练过未掌握</li><li><i class="sw unseen"></i>未练</li></ul></div>
        <div class="mastery-list">${GROUPS.map(g => {
          const s = groupStats(g), seen = s.seen - s.mastered;
          return `<button type="button" class="mastery-row" data-action="weak-group" data-group="${g.id}" aria-label="${esc(shortName(g.id))}：已掌握 ${s.mastered} 道，练过未掌握 ${seen} 道，未练 ${s.count - s.seen} 道，正确率 ${s.attempts ? `${s.accuracy}%` : '暂无'}。练习本章薄弱题">
            <span class="category-icon ${g.section}">${icon(groupIcons[g.id])}</span>
            <span class="mastery-copy"><span class="mastery-title"><strong>${esc(shortName(g.id))}</strong><small>已练 ${s.seen} / ${s.count} 道 · ${s.attempts} 次作答</small></span><span class="stack-bar"><i class="mastered" style="width:${s.mastered / s.count * 100}%"></i><i class="seen" style="width:${seen / s.count * 100}%"></i></span></span>
            <span class="mastery-accuracy"><strong>${s.attempts ? `${s.accuracy}%` : '—'}</strong><small>正确率</small></span>
            ${icon('chevron', 'row-chevron')}
          </button>`;
        }).join('')}</div>
      </section>
      ${reviewPlanPanel()}
      ${examHistoryPanel(exams)}
      <section class="panel">
        <div class="section-head"><div><h3>最近完成的练习</h3><p class="section-sub">最近 12 次</p></div></div>
        ${sessions.length ? `<div class="history-list">${sessions.slice().sort((a, b) => a.finishedAt - b.finishedAt).slice(-12).reverse().map(historyRow).join('')}</div>` : `<div class="empty-state compact">${icon('clock')}<p>完成一次练习后，会在这里留下记录。</p>${btn('quick', '开始第一组练习', 'secondary')}</div>`}
      </section>`;
  }

  // ── 偏好与数据 ───────────────────────────────────────────────────────
  function renderSettings() {
    setHeader('偏好与数据', '让练习更合习惯，让记录好好保存。');
    const row = (title, desc, control) => `<div class="setting-row"><div class="setting-copy"><strong>${title}</strong><p>${desc}</p></div>${control}</div>`;
    view.innerHTML = `<div class="settings-grid">
      <section class="panel">
        <div class="section-head"><h3>阅读与外观</h3>${icon('sun', 'section-icon')}</div>
        ${row('页面主题', '选择让眼睛更舒服的背景。', segmented('theme', '页面主题', [['light', '浅色'], ['dark', '深色'], ['system', '跟随系统']], prefs.theme))}
        ${row('题目字号', '放大题干、选项和解析。', segmented('font', '题目字号', [['normal', '标准'], ['large', '大字号']], prefs.font))}
        ${row('专注模式', '答题时收起导航和侧边答题卡。', `<label class="switch" for="settings-focus"><input type="checkbox" id="settings-focus" ${prefs.focus ? 'checked' : ''}><span aria-hidden="true"></span><span class="sr-only">启用专注模式</span></label>`)}
        ${row('默认题目语言', '题目、选项和解析同步切换。', segmented('language', '默认题目语言', [['both', '中英'], ['zh', '中文'], ['en', 'EN']], lang))}
      </section>
      <section class="panel">
        <div class="section-head"><h3>每日学习目标</h3>${icon('target', 'section-icon')}</div>
        <p class="panel-text">给自己一个轻松完成的小目标，按实际作答次数累计。</p>
        <label class="goal-input" for="settings-goal"><input id="settings-goal" type="number" min="5" max="200" step="5" value="${prefs.goal}" inputmode="numeric"><span>题 / 天</span></label>
        <div class="goal-presets">${[10, 20, 40, 60].map(v => `<button type="button" class="btn ghost small ${prefs.goal === v ? 'active' : ''}" data-action="goal" data-value="${v}" aria-pressed="${prefs.goal === v}">${v} 题</button>`).join('')}</div>
        <p class="footnote">调整目标会立即保存，不会改动已经记录的练习量。</p>
      </section>
      <section class="panel">
        <div class="section-head"><h3>备份学习记录</h3>${icon('download', 'section-icon')}</div>
        <p class="panel-text">成绩、错题、收藏、笔记和未完成的练习都保存在这台设备的浏览器里。换电脑或换浏览器前，先导出一份备份。</p>
        <div class="row">${btn('export', `${icon('download')}<span>导出记录</span>`, 'secondary')}${btn('import', `${icon('upload')}<span>导入记录</span>`, 'ghost')}</div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <p class="footnote">导入前会先显示备份里有什么并请你确认；确认后会替换当前的学习记录。</p>
      </section>
      <section class="panel danger-zone">
        <div class="section-head"><h3>重新开始</h3>${icon('repeat', 'section-icon')}</div>
        <p class="panel-text">清空答题成绩、错题本、每日统计、练习历史和未完成的进度。收藏和笔记会保留。</p>
        ${btn('reset', '清空练习记录', 'danger')}
        <p class="footnote">建议先导出备份。这个操作需要再次确认。</p>
      </section>
    </div>`;
  }

  // ── 对话框与数据 ─────────────────────────────────────────────────────
  function confirmDialog(title, message, confirmText = '确认', danger = false) {
    if (confirmPending) return Promise.resolve(false);
    const previous = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"><span class="modal-icon ${danger ? 'danger' : ''}">${icon(danger ? 'warning' : 'note')}</span><h2 id="confirm-title">${esc(title)}</h2><p id="confirm-message">${esc(message)}</p><div class="modal-actions"><button type="button" class="btn ghost" data-modal-cancel>取消</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-modal-confirm>${esc(confirmText)}</button></div></section>`;
    document.body.appendChild(overlay);
    return new Promise(resolve => {
      const done = result => { document.removeEventListener('keydown', onKey, true); overlay.remove(); confirmPending = null; previous?.focus({ preventScroll: true }); resolve(result); };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === 'Tab') {
          const controls = [...overlay.querySelectorAll('button')], first = controls[0], last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      confirmPending = done;
      overlay.querySelector('[data-modal-cancel]').onclick = () => done(false);
      overlay.querySelector('[data-modal-confirm]').onclick = () => done(true);
      overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
      document.addEventListener('keydown', onKey, true);
      overlay.querySelector('[data-modal-cancel]').focus();
    });
  }
  // 错题本 / 收藏导出：选项按题库原始顺序（A–D），附答案、解析、答错次数和个人笔记。导出当前筛选结果。
  function collectionTitle() { return page === 'wrong' ? '错题本' : '我的收藏'; }
  function questionsMarkdown(ids) {
    const lines = [`# G1 ${collectionTitle()}（${dateKey()} 导出，共 ${ids.length} 题）`, '', '> 来自 G1 Studio。选项按题库原始顺序排列；标志图片引用官方网址，需要联网显示。', ''];
    ids.forEach((id, n) => {
      const q = byId[id], answer = q.options[q.answer_index];
      lines.push(`## ${n + 1}. ${q.id}　〔${shortName(q.group)}〕`, '');
      if (q.image_url) lines.push(`![${q.sign_desc_zh || '交通标志'}](${q.image_url})`, '', `（图示：${q.sign_desc_zh || q.sign_desc_en}）`, '');
      lines.push(`**${q.question_zh}**  `, `*${q.question_en}*`, '');
      q.options.forEach((o, i) => lines.push(`- ${KEYS[i]}. ${o.zh} ／ ${o.en}${i === q.answer_index ? ' ✅' : ''}`));
      lines.push('', `**答案：${KEYS[q.answer_index]}**　${answer.zh}（${answer.en}）  `, `**解析：** ${q.explanation_zh}  `, `*${q.explanation_en}*  `);
      if (page === 'wrong' && wrong[id]) lines.push(`累计答错 ${wrong[id]} 次  `);
      if (notes[id]) lines.push(`**我的笔记：** ${notes[id].replace(/\s*\n\s*/g, ' ')}  `);
      lines.push(`依据：[${q.source_title || '官方手册'}](${q.source_url})`, '', '---', '');
    });
    return lines.join('\n');
  }
  function questionsCsv(ids) {
    const cell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = [['题号', '章节', '部分', '题目(中)', '题目(EN)', 'A', 'B', 'C', 'D', '答案', '解析', '答错次数', '我的笔记', '图片', '依据']];
    ids.forEach(id => {
      const q = byId[id];
      rows.push([q.id, shortName(q.group), sectionNames[q.section], q.question_zh, q.question_en, ...q.options.map(o => `${o.zh} / ${o.en}`), KEYS[q.answer_index], q.explanation_zh, wrong[id] || 0, notes[id] || '', q.image_url || '', q.source_url]);
    });
    return '\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  function exportQuestions(format) {
    const ids = collectionIds();
    if (!ids.length) return;
    const name = `G1-${collectionTitle()}-${dateKey()}`;
    if (format === 'md') download(`${name}.md`, questionsMarkdown(ids), 'text/markdown');
    else download(`${name}.csv`, questionsCsv(ids), 'text/csv');
    toast(`已导出 ${ids.length} 道题。`);
  }
  // 打印：把题目排进专用的打印区域再调用浏览器打印；练习卷不带答案，答案统一附在最后。
  // 有标志图片时先等图片加载完（失败的去掉，最多等 5 秒）再打开打印窗口，否则打印出来的图是空白。
  let printPending = false;
  function printQuestions(withAnswers) {
    const ids = collectionIds(), sheet = $('#print-sheet');
    if (!ids.length || !sheet || printPending) return;
    sheet.innerHTML = `<header class="print-head"><h1>G1 ${collectionTitle()}${withAnswers ? '' : ' · 练习卷'}</h1><p>${dateKey()} · 共 ${ids.length} 题 · G1 Studio</p></header>${ids.map((id, n) => {
      const q = byId[id];
      return `<article class="print-q"><h2><span>${n + 1}.</span> ${esc(q.question_zh)}</h2><p class="print-en">${esc(q.question_en)}</p>${q.image_url ? `<p class="print-sign">${brokenImages.has(q.image_url) ? '' : `<img src="${esc(q.image_url)}" alt="">`}（图示：${esc(q.sign_desc_zh || q.sign_desc_en)}）</p>` : ''}<ol class="print-options">${q.options.map((o, i) => `<li class="${withAnswers && i === q.answer_index ? 'is-answer' : ''}"><b>${KEYS[i]}.</b> ${esc(o.zh)} <span>${esc(o.en)}</span>${withAnswers && i === q.answer_index ? ' ✔' : ''}</li>`).join('')}</ol>${withAnswers ? `<p class="print-explain"><b>答案 ${KEYS[q.answer_index]}</b>　${esc(q.explanation_zh)}</p>${notes[id] ? `<p class="print-note">我的笔记：${esc(notes[id])}</p>` : ''}` : ''}<p class="print-id">${esc(q.id)} · ${esc(shortName(q.group))}${page === 'wrong' && wrong[id] ? ` · 答错 ${wrong[id]} 次` : ''}</p></article>`;
    }).join('')}${withAnswers ? '' : `<section class="print-key"><h2>答案</h2><p>${ids.map((id, n) => `${n + 1}. ${KEYS[byId[id].answer_index]}`).join('　')}</p></section>`}`;
    const settle = img => new Promise(done => {
      if (img.complete) { if (!img.naturalWidth) img.remove(); done(); return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => { img.remove(); done(); }, { once: true });
    });
    const images = [...sheet.querySelectorAll('img')];
    document.body.classList.add('print-questions');
    if (!images.length) { window.print(); return; }
    printPending = true;
    toast('正在载入标志图片，马上打开打印窗口…');
    Promise.race([Promise.all(images.map(settle)), new Promise(done => setTimeout(done, 5000))]).then(() => { printPending = false; window.print(); });
  }

  // 备份格式保持 version 2：只增加可选字段，旧版网页仍能导入新备份。
  function exportRecords() {
    pauseSession();
    const backup = { app: 'ontario-g1', version: 2, exportedAt: new Date().toISOString(), hist, wrong, bookmarks, notes, activity, sessions, preferences: prefs, session: session && !session.finished ? { ...session, startedAt: null } : null, language: lang, practice: { groups: [...selectedGroups], count: practiceCount, random: randomOrder, unmastered: unmasteredOnly }, srs };
    download(`Ontario-G1-学习备份-${dateKey()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    toast('备份已导出，请妥善保存。');
  }
  async function importRecords(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('备份文件过大，请选择 8 MB 以下的 G1 备份。'); return; }
    try {
      const b = JSON.parse(await file.text());
      if (!b || b.app !== 'ontario-g1' || ![1, 2].includes(b.version) || !b.hist || typeof b.hist !== 'object' || Array.isArray(b.hist)) throw new Error('format');
      const nextHist = cleanHist(b.hist), nextWrong = cleanWrong(b.wrong), nextBookmarks = cleanBookmarks(b.bookmarks), nextNotes = cleanNotes(b.notes), nextSession = validateSession(b.session);
      const yes = await confirmDialog('导入这份学习备份？', `备份包含 ${Object.keys(nextHist).length} 道题的练习记录、${Object.keys(nextWrong).length} 道错题、${Object.keys(nextBookmarks).length} 道收藏及 ${Object.keys(nextNotes).length} 条笔记${nextSession ? '，并有一份未完成的练习' : ''}。确认后会替换当前学习记录，建议先导出当前记录。`, '确认导入');
      if (!yes) return;
      // 学习记录整体替换；旧版备份里没有的外观设置和语言保留当前值。
      hist = nextHist; wrong = nextWrong; bookmarks = nextBookmarks; notes = nextNotes;
      activity = cleanActivity(b.activity); sessions = cleanSessions(b.sessions); session = nextSession;
      srs = b.srs && typeof b.srs === 'object' && !Array.isArray(b.srs) ? cleanSrs(b.srs) : seedSrs();
      prefs = b.preferences && typeof b.preferences === 'object' ? cleanPrefs(b.preferences) : prefs;
      lang = cleanLang(b.language, lang);
      if (b.practice && typeof b.practice === 'object') {
        if (Array.isArray(b.practice.groups)) selectedGroups = new Set(b.practice.groups.filter(id => GROUPS.some(g => g.id === id)));
        if ([10, 20, 40, 'all'].includes(b.practice.count)) practiceCount = b.practice.count;
        if (typeof b.practice.random === 'boolean') randomOrder = b.practice.random;
        if (typeof b.practice.unmastered === 'boolean') unmasteredOnly = b.practice.unmastered;
        storage.set('g1-groups', [...selectedGroups]); storage.set('g1-count', practiceCount); storage.set('g1-random', randomOrder); storage.set('g1-unseen', unmasteredOnly);
      }
      storage.set('g1-hist', hist); storage.set('g1-wrong', wrong); storage.set('g1-bookmarks', bookmarks); storage.set('g1-notes', notes); storage.set('g1-activity', activity);
      storage.set('g1-sessions', sessions); storage.set('g1-session', session); storage.set('g1-preferences', prefs); storage.set('g1-lang', lang); storage.set('g1-srs', srs);
      page = 'home'; render(); toast('学习记录已导入。');
    } catch (_) { toast('无法读取这份备份，请选择由 G1 练习导出的 JSON 文件。'); }
  }
  async function resetRecords() {
    const yes = await confirmDialog('清空全部练习记录？', '将删除累计答题成绩、错题本、复习计划、每日统计、练习历史，以及未完成的练习进度。收藏、笔记和阅读设置会保留。此操作不能撤销。', '确认清空', true);
    if (!yes) return;
    hist = {}; wrong = {}; activity = {}; sessions = []; session = null; srs = {};
    ['g1-hist', 'g1-wrong', 'g1-activity', 'g1-srs'].forEach(k => storage.set(k, {}));
    storage.set('g1-sessions', []); storage.set('g1-session', null);
    render(); toast('练习记录已清空，收藏和笔记已保留。');
  }
  function toggleBookmark(id) {
    if (!byId[id]) return;
    const added = !bookmarks[id];
    if (added) bookmarks[id] = true; else delete bookmarks[id];
    storage.set('g1-bookmarks', bookmarks); render(true);
    toast(added ? '已加入收藏。' : '已取消收藏。');
  }
  function setLanguage(value) { if (!['both', 'en', 'zh'].includes(value)) return; lang = value; storage.set('g1-lang', lang); render(true); }
  function jumpBy(predicate) {
    const n = session.items.length;
    for (let offset = 1; offset <= n; offset++) { const i = (session.i + offset) % n; if (predicate(session.items[i])) return moveTo(i); }
    toast('没有符合条件的题目。');
  }

  // ── 事件 ─────────────────────────────────────────────────────────────
  view.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action, value = target.dataset.value;
    if (action === 'navigate') return navigate(target.dataset.pageTarget);
    if (action === 'quick') return startQuick();
    if (action === 'smart') return startSmart();
    if (action === 'weak-group') return startSmart(target.dataset.group);
    if (action === 'resume') { if (!session || session.finished) return; session.startedAt = Date.now(); page = 'quiz'; render(); saveSession(); return; }
    if (action === 'start-practice') return startPractice();
    if (action === 'start-exam') return startExam();
    if (action === 'start-review' || action === 'start-review-all') return startReview(action === 'start-review-all');
    if (action === 'start-sprint') return startSprint();
    if (action === 'sprint-section') { sprintSection = value; render(true); return; }
    if (action === 'sprint-count') { sprintCount = value === 'all' ? 'all' : Number(value); render(true); return; }
    if (action === 'ref-doc') { refDoc = value; render(); window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    if (action === 'ref-jump') {
      event.preventDefault();
      const section = document.getElementById(target.dataset.target);
      if (section) { section.setAttribute('tabindex', '-1'); section.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); section.focus({ preventScroll: true }); }
      return;
    }
    if (action === 'bank-section') { bankSection = value; bankPage = 0; render(true); return; }
    if (action === 'bank-prev' || action === 'bank-next') { bankPage += action === 'bank-next' ? 1 : -1; render(); view.querySelector('.search-results-panel')?.scrollIntoView({ block: 'start', behavior: 'instant' }); return; }
    if (action === 'search-example') { bankSearch = value; bankPage = 0; render(); $('#bank-search')?.focus(); return; }
    if (action === 'bank-from-ref') { bankSearch = refSearch; bankPage = 0; return navigate('search'); }
    if (action === 'ref-from-bank') { refSearch = bankSearch; return navigate('reference'); }
    if (action === 'export-md' || action === 'export-csv') return exportQuestions(action === 'export-md' ? 'md' : 'csv');
    if (action === 'print-answers' || action === 'print-blank') return printQuestions(action === 'print-answers');
    if (action === 'print-page') return window.print();
    if (action === 'category-section') { categorySection = value; render(true); return; }
    if (action === 'clear-category-search') { categorySearch = ''; render(); return; }
    if (action === 'select-all' || action === 'select-none') {
      GROUPS.filter(g => categorySection === 'all' || g.section === categorySection).forEach(g => action === 'select-all' ? selectedGroups.add(g.id) : selectedGroups.delete(g.id));
      storage.set('g1-groups', [...selectedGroups]); render(true); return;
    }
    if (action === 'practice-count') { practiceCount = value === 'all' ? 'all' : Number(value); storage.set('g1-count', practiceCount); render(true); return; }
    if (action === 'practice-difficulty') { practiceDifficulty = value; render(true); return; }
    if (action === 'choose') return choose(Number(target.dataset.option));
    if (action === 'bookmark') return toggleBookmark(session.items[session.i].id);
    if (action === 'bookmark-id') return toggleBookmark(target.dataset.id);
    if (action === 'flag') { const item = session.items[session.i]; item.flagged = !item.flagged; saveSession(); render(true); return; }
    if (action === 'previous') return moveTo(session.i - 1);
    if (action === 'next' || action === 'skip') return nextQuestion();
    if (action === 'jump') { openSheet(false); return moveTo(Number(target.dataset.index)); }
    if (action === 'finish') return finishSession();
    if (action === 'pause') { pauseSession(); openSheet(false); page = 'home'; render(); toast('进度已保存，下次可继续。'); return; }
    if (action === 'toggle-sheet') return openSheet(!document.body.classList.contains('sheet-open'));
    if (action === 'close-sheet') { openSheet(false); view.querySelector('[data-action="toggle-sheet"]')?.focus({ preventScroll: true }); return; }
    if (action === 'jump-unanswered') { openSheet(false); return jumpBy(it => it.pick === null); }
    if (action === 'jump-flagged') { openSheet(false); return jumpBy(it => it.flagged); }
    if (action === 'sheet-prev' || action === 'sheet-next') { sheetPage += action === 'sheet-next' ? 1 : -1; $('#answer-sheet-content').innerHTML = answerGrid(); return; }
    if (action === 'retry-image') {
      const box = target.closest('.signbox'), img = box?.querySelector('img');
      if (img) { brokenImages.delete(img.dataset.src); img.hidden = false; box.querySelector('.sign-fallback').hidden = true; watchImage(img); img.removeAttribute('src'); img.src = img.dataset.src; }
      return;
    }
    if (action === 'retry-result') return beginSession(session.items.filter(it => it.pick !== byId[it.id].answer_index).map(it => it.id), 'wrong');
    if (action === 'review-prev' || action === 'review-next') { reviewPage += action === 'review-next' ? 1 : -1; render(); return; }
    if (action === 'start-collection') return beginSession(shuffle(collectionIds()), page === 'wrong' ? 'wrong' : 'bookmarks');
    if (action === 'practice-one') return beginSession([target.dataset.id], page === 'wrong' ? 'wrong' : 'practice');
    if (action === 'collection-prev' || action === 'collection-next') { collectionPage += action === 'collection-next' ? 1 : -1; render(); return; }
    if (action === 'clear-collection-search') { collectionSearch = ''; collectionGroup = 'all'; render(); return; }
    if (action === 'theme') { prefs.theme = value; render(true); return; }
    if (action === 'font') { prefs.font = value; render(true); return; }
    if (action === 'language') return setLanguage(value);
    if (action === 'goal') { prefs.goal = Number(value); render(true); return; }
    if (action === 'export') return exportRecords();
    if (action === 'import') return $('#import-file').click();
    if (action === 'reset') return resetRecords();
  });
  // 拼音等输入法组字期间不重绘（重绘会打断组字），组字结束后再筛选。
  view.addEventListener('compositionend', event => {
    const el = event.target;
    if (['category-search', 'collection-search', 'ref-search', 'bank-search'].includes(el.id)) el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  view.addEventListener('toggle', event => {
    const el = event.target;
    if (el.dataset?.review) el.open ? openReviews.add(el.dataset.review) : openReviews.delete(el.dataset.review);
    else if (el.classList?.contains('notes-box') && page === 'quiz' && session) notesOpenFor = el.open ? session.items[session.i].id : null;
  }, true);
  view.addEventListener('input', event => {
    const el = event.target;
    if (event.isComposing) return;
    if (el.id === 'category-search') { categorySearch = el.value; render(true); }
    else if (el.id === 'collection-search') { collectionSearch = el.value; collectionPage = 0; render(true); }
    else if (el.id === 'ref-search') { refSearch = el.value; render(true); }
    else if (el.id === 'bank-search') { bankSearch = el.value; bankPage = 0; render(true); }
    else if (el.id === 'question-note' && session) {
      const id = session.items[session.i].id;
      if (el.value.trim()) notes[id] = el.value; else delete notes[id];
      storage.set('g1-notes', notes);
    }
  });
  view.addEventListener('change', event => {
    const el = event.target;
    if (el.dataset.groupSelect) { el.checked ? selectedGroups.add(el.dataset.groupSelect) : selectedGroups.delete(el.dataset.groupSelect); storage.set('g1-groups', [...selectedGroups]); render(true); }
    else if (el.id === 'practice-random') { randomOrder = el.checked; storage.set('g1-random', randomOrder); }
    else if (el.id === 'practice-unmastered') { unmasteredOnly = el.checked; storage.set('g1-unseen', unmasteredOnly); render(true); }
    else if (el.id === 'sprint-unseen') { sprintUnseen = el.checked; render(true); }
    else if (el.id === 'collection-group') { collectionGroup = el.value; collectionPage = 0; render(true); }
    else if (el.id === 'settings-focus') { prefs.focus = el.checked; applyPreferences(); }
    else if (el.id === 'settings-goal') { prefs.goal = Math.min(200, Math.max(5, Math.round(Number(el.value) || 20))); render(true); }
    else if (el.id === 'import-file') { const file = el.files?.[0]; el.value = ''; importRecords(file); }
  });
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  document.querySelectorAll('#sidebar [data-page], .tabbar [data-page]').forEach(b => b.addEventListener('click', event => { event.preventDefault(); navigate(b.dataset.page); }));
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLanguage(b.dataset.lang)));
  $('#theme-toggle')?.addEventListener('click', () => { prefs.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; render(true); toast(prefs.theme === 'dark' ? '已切换深色模式。' : '已切换浅色模式。'); });
  $('#font-toggle')?.addEventListener('click', () => { prefs.font = prefs.font === 'large' ? 'normal' : 'large'; render(true); toast(prefs.font === 'large' ? '已开启大字号。' : '已恢复标准字号。'); });
  $('#focus-toggle')?.addEventListener('click', () => { prefs.focus = !prefs.focus; if (page === 'settings') render(true); else applyPreferences(); toast(prefs.focus ? '答题时将使用专注模式。' : '已退出专注模式。'); });
  $('#search-button')?.addEventListener('click', () => { navigate('search'); $('#bank-search')?.focus(); });
  window.addEventListener('afterprint', () => document.body.classList.remove('print-questions'));
  $('#quiz-back')?.addEventListener('click', () => { if (page !== 'quiz') return; pauseSession(); openSheet(false); page = 'home'; render(); toast('进度已保存，下次可继续。'); });
  $('#mobile-menu')?.addEventListener('click', () => {
    const open = document.body.classList.toggle('sidebar-open');
    $('#mobile-menu').setAttribute('aria-expanded', String(open));
    if (open) $('#sidebar .nav-item.active, #sidebar .nav-item')?.focus({ preventScroll: true });
  });
  $('#sidebar-overlay')?.addEventListener('click', closeMobile);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !confirmPending) {
      if (document.body.classList.contains('sidebar-open')) { closeMobile(); $('#mobile-menu')?.focus(); return; }
      if (document.body.classList.contains('sheet-open')) { openSheet(false); view.querySelector('[data-action="toggle-sheet"]')?.focus({ preventScroll: true }); return; }
    }
    if (confirmPending || page !== 'quiz' || !session || session.finished || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    // 正在输入笔记或搜索时不触发；焦点停在按钮上（比如刚点过选项）时快捷键照常可用。
    const target = event.target;
    if (target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const key = event.key.toUpperCase();
    if (key === 'B' && event.shiftKey) { event.preventDefault(); toggleBookmark(session.items[session.i].id); return; }
    const index = Math.max(['1', '2', '3', '4'].indexOf(key), KEYS.indexOf(key));
    if (index >= 0) { event.preventDefault(); choose(session.items[session.i].order[index]); return; }
    // 焦点在其他按钮、链接上时 Enter 交给它本身；焦点在已选中的选项上时 Enter 进入下一题。
    if (event.key === 'Enter' && (!target.closest('button,a,summary') || target.closest('.opt[aria-pressed="true"]'))) { event.preventDefault(); nextQuestion(); }
  });
  window.addEventListener('beforeunload', saveSession);
  window.addEventListener('pagehide', saveSession);
  // 页面切到后台（换标签页、手机锁屏）时暂停计时，回来后继续。
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (page === 'quiz') pauseSession(); else saveSession(); }
    else if (page === 'quiz' && session && !session.finished && !session.startedAt) session.startedAt = Date.now();
  });
  // 另一个窗口改了学习记录时重新读取，避免这个窗口用旧数据把它覆盖掉。答题中的这一组练习不受影响。
  window.addEventListener('storage', event => {
    if (event.storageArea !== localStorage || (event.key && !event.key.startsWith('g1-'))) return;
    hist = cleanHist(storage.get('g1-hist', {})); wrong = cleanWrong(storage.get('g1-wrong', {})); bookmarks = cleanBookmarks(storage.get('g1-bookmarks', {})); notes = cleanNotes(storage.get('g1-notes', {}));
    activity = cleanActivity(storage.get('g1-activity', {})); sessions = cleanSessions(storage.get('g1-sessions', [])); prefs = cleanPrefs(storage.get('g1-preferences', {})); lang = cleanLang(storage.get('g1-lang', 'both'), lang);
    srs = cleanSrs(storage.get('g1-srs', {}));
    if (page === 'quiz' || page === 'result') { applyPreferences(false); updateCounts(); return; }
    session = validateSession(storage.get('g1-session', null)); render(true);
  });
  setInterval(() => { if (page === 'quiz' && session && !session.finished && session.startedAt) { const timer = $('#session-timer'); if (timer) timer.textContent = timeLabel(elapsed()); } }, 1000);
  setInterval(() => { if (page === 'quiz') saveSession(); }, 15000);
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (prefs.theme === 'system') applyPreferences(); });
  if ($('#foot')) $('#foot').innerHTML = `${esc(META.footer)} <a href="${esc(META.handbook_url)}" target="_blank" rel="noopener noreferrer">官方手册 ${icon('external')}</a>`;
  render();
})();
