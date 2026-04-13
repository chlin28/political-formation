import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'

const PARTY_COLORS = {
  '民進黨': { color: '#00833D' },
  '國民黨': { color: '#004A97' },
  '民眾黨': { color: '#008995' },
  '時代力量': { color: '#FF9E15' },
  '基進黨': { color: '#86391F' },
  '社民黨': { color: '#DC143C' },
  '親民黨': { color: '#FF6B35' },
  '正神名黨': { color: '#8B0000' },
  '新黨': { color: '#FFD700' },
  '綠黨': { color: '#90EE90' },
  '台灣團結聯盟': { color: '#FF69B4' },
  '無黨團結聯盟': { color: '#DDA0DD' },
  '台灣維新': { color: '#87CEEB' },
  '勞動黨': { color: '#B22222' },
  '其他政黨': { color: '#808080' },
  '無特定政黨屬性': { color: '#4A4A4A' }
};

const COUNTIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '嘉義市',
  '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣',
  '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣',
  '不分區', '山地原住民', '平地原住民'
];

// 政黨排序（優先順序）
const PARTY_ORDER = [
  '民進黨', '國民黨', '民眾黨', '時代力量', '基進黨', '無特定政黨屬性', '社民黨'
];
const sortParties = (parties) => {
  return [...parties].sort((a, b) => {
    const ai = PARTY_ORDER.indexOf(a);
    const bi = PARTY_ORDER.indexOf(b);
    const isOtherA = a === '其他政黨';
    const isOtherB = b === '其他政黨';
    if (isOtherA) return 1;
    if (isOtherB) return -1;
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    // 其餘依筆畫（locale）排序
    return a.localeCompare(b, 'zh-Hant-TW');
  });
};

const RELATIONSHIP_TYPES = {
  compete: { name: '競爭對立', color: '#FF0000', dash: '5,5' },
  criticize: { name: '批評攻擊', color: '#FF6B6B', dash: '10,5' },
  cooperate: { name: '合作支持', color: '#4ECDC4', dash: '0' },
  support: { name: '聲援呼應', color: '#95E1D3', dash: '3,3' },
  linked: { name: '議題連動', color: '#F38181', dash: '8,2' }
};

const formatAxisLabel = (num) => {
  if (num === 0) return '0';
  const abs = Math.abs(num);
  if (abs >= 10000) {
    const wan = num / 10000;
    return (wan % 1 === 0 ? wan.toFixed(0) : wan.toFixed(1)) + ' 萬';
  }
  return Math.round(num).toLocaleString();
};

const formatNumber = (num) => {
  if (num >= 100000) return Math.round(num / 10000) + '萬';
  if (num >= 10000) return (num / 10000).toFixed(1) + '萬';
  if (num >= 1000) return (num / 1000).toFixed(0) + '千';
  if (num >= 100) return Math.round(num / 100) + '百';
  return Math.round(num).toString();
};

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const Plus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

// ── 共用的資料庫編輯表單元件 ──────────────────────────────
const DBEditForm = ({ form, onChange, onSave, onCancel, bgClass = 'bg-yellow-50' }) => (
  <div className={`border-b ${bgClass} p-2 space-y-1`}>
    <div className="grid gap-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <input
        autoFocus
        type="text"
        placeholder="姓名"
        value={form.alias || ''}
        onChange={(e) => onChange({ ...form, alias: e.target.value })}
        className="px-1 py-0.5 border rounded text-xs"
      />
      <select
        value={form.political_party_label || ''}
        onChange={(e) => onChange({ ...form, political_party_label: e.target.value })}
        className="px-1 py-0.5 border rounded text-xs"
      >
        <option value="">選擇政黨</option>
        {Object.keys(PARTY_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
    <div className="grid gap-1" style={{ gridTemplateColumns: '1fr auto' }}>
      <select
        value={form.county || ''}
        onChange={(e) => onChange({ ...form, county: e.target.value })}
        className="px-1 py-0.5 border rounded text-xs"
      >
        <option value="">選擇縣市</option>
        {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs whitespace-nowrap">
        <input
          type="checkbox"
          checked={form.national_affairs || false}
          onChange={(e) => onChange({ ...form, national_affairs: e.target.checked })}
        />
        全國性
      </label>
    </div>
    <div className="flex gap-1">
      <button onClick={onSave} className="flex-1 px-2 py-0.5 bg-teal-600 text-white rounded text-xs">
        儲存
      </button>
      <button onClick={onCancel} className="flex-1 px-2 py-0.5 bg-gray-200 rounded text-xs">
        取消
      </button>
    </div>
  </div>
);

export default function App() {
  // ── 政治人物列表（Supabase 共用資料庫）──────────────────
  const [politicianDB, setPoliticianDB] = useState({});
  const [dbLoading, setDbLoading] = useState(true);
  const [dbSyncing, setDbSyncing] = useState(false);

  // ── 圖表數據 ──────────────────────────────────────────
  const [internalFiles, setInternalFiles] = useState([]);
  const [externalFiles, setExternalFiles] = useState([]);
  const internalFilesRef = useRef([]);
  const externalFilesRef = useRef([]);
  const [mergedData, setMergedData] = useState([]);
  const [displayData, setDisplayData] = useState([]);

  // ── UI 狀態 ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('data');
  const [selectedParties, setSelectedParties] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [rankFilter, setRankFilter] = useState({ start: '', end: '' });
  const [selectedTag, setSelectedTag] = useState('');
  const [tags, setTags] = useState({});
  const [newTagName, setNewTagName] = useState('');

  const [showNationalOnly, setShowNationalOnly] = useState(false);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [showAddPolitician, setShowAddPolitician] = useState(false);
  const [newPolitician, setNewPolitician] = useState({
    alias: '', political_party_label: '', county: '',
    bgw_spectrum: '', national_affairs: false, otherTags: ''
  });

  const [axisRange, setAxisRange] = useState({
    xMin: '', xMax: '', yMin: '', yMax: '', autoAdjust: true
  });

  // 象限篩選
  const [selectedQuadrants, setSelectedQuadrants] = useState([]);
  const toggleQuadrant = (q) => setSelectedQuadrants(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q]);

  // 顯示選項
  const [displayOptions, setDisplayOptions] = useState({
    quadrantBg: true,
    quadrantLabel: true,
    momentum: true,
    relationLines: true,
    trendMark: true,
    nameLabel: true,
    labelAntiOverlap: true,
  });
  const toggleDisplayOption = (key) => setDisplayOptions(prev => ({ ...prev, [key]: !prev[key] }));

  // 局部放大模式
  const [zoomFocusPerson, setZoomFocusPerson] = useState('');

  const [highlights, setHighlights] = useState({});
  const [highlightSettings, setHighlightSettings] = useState({
    person: '', color: '#FF0000', type: 'circle'
  });
  const [relationships, setRelationships] = useState([]);
  const [newRelationship, setNewRelationship] = useState({
    personA: '', personB: '', type: 'compete'
  });

  const [canvasSize, setCanvasSize] = useState('16:9');
  const [title, setTitle] = useState('2026 整體政壇形勢');
  const [subtitle, setSubtitle] = useState('');
  const [bubbleSettings, setBubbleSettings] = useState({
    minRadius: 6, maxRadius: 35, fontSize: 11
  });

  // ── Refs ──────────────────────────────────────────────
  const svgRef = useRef(null);
  const politicianFileRef = useRef(null);
  const internalFileRef = useRef(null);
  const externalFileRef = useRef(null);
  const chartContainerRef = useRef(null);
  const partyDropdownRef = useRef(null);
  const cityDropdownRef = useRef(null);

  // ── 縮放 & 平移 ───────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const fitZoomRef = useRef(1);
  const hasFitRef = useRef(false);

  // ── 政治人物列表編輯器 ────────────────────────────────
  const [dbSearch, setDbSearch] = useState('');
  const [editingAlias, setEditingAlias] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showDBEditor, setShowDBEditor] = useState(false);
  const [dbPage, setDbPage] = useState(0);
  const DB_PAGE_SIZE = 15;

  // ══════════════════════════════════════════════════════
  // Supabase：初始載入 & 即時訂閱
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    // 初始載入全部資料（分批讀取，突破 Supabase 1000 筆上限）
    const loadAll = async () => {
      setDbLoading(true);
      const db = {};
      const PAGE = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('politicians')
          .select('*')
          .range(from, from + PAGE - 1);
        if (error || !data) break;
        data.forEach(row => {
          db[row.alias] = {
            political_party_label: row.political_party_label,
            county: row.county,
            bgw_spectrum: row.bgw_spectrum,
            national_affairs: row.national_affairs
          };
        });
        hasMore = data.length === PAGE;
        from += PAGE;
      }
      setPoliticianDB(db);
      setDbLoading(false);
    };
    loadAll();

    // 即時訂閱：其他使用者的變更
    const channel = supabase
      .channel('politicians-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'politicians' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new;
          setPoliticianDB(prev => ({
            ...prev,
            [row.alias]: {
              political_party_label: row.political_party_label,
              county: row.county,
              bgw_spectrum: row.bgw_spectrum,
              national_affairs: row.national_affairs
            }
          }));
        } else if (payload.eventType === 'DELETE') {
          const alias = payload.old.alias;
          setPoliticianDB(prev => {
            const next = { ...prev };
            delete next[alias];
            return next;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Supabase 寫入輔助函式 ─────────────────────────────
  const upsertToDB = async (alias, info) => {
    setDbSyncing(true);
    await supabase.from('politicians').upsert({
      alias,
      political_party_label: info.political_party_label || '無特定政黨屬性',
      county: info.county || '',
      bgw_spectrum: info.bgw_spectrum || '',
      national_affairs: info.national_affairs || false
    }, { onConflict: 'alias' });
    setDbSyncing(false);
  };

  const deleteFromSupabase = async (alias) => {
    setDbSyncing(true);
    await supabase.from('politicians').delete().eq('alias', alias);
    setDbSyncing(false);
  };

  const bulkUpsertToDB = async (db) => {
    setDbSyncing(true);
    const rows = Object.entries(db).map(([alias, info]) => ({
      alias,
      political_party_label: info.political_party_label || '無特定政黨屬性',
      county: info.county || '',
      bgw_spectrum: info.bgw_spectrum || '',
      national_affairs: info.national_affairs || false
    }));
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await supabase.from('politicians').upsert(rows.slice(i, i + CHUNK), { onConflict: 'alias' });
    }
    setDbSyncing(false);
  };

  // ══════════════════════════════════════════════════════
  // 圖表維度
  // ══════════════════════════════════════════════════════
  const getCanvasDimensions = () => {
    const sizes = {
      '16:9': { width: 1920, height: 1080 },
      'square': { width: 1080, height: 1080 },
      'og': { width: 1200, height: 630 }
    };
    return sizes[canvasSize] || sizes['16:9'];
  };

  // ══════════════════════════════════════════════════════
  // CSV 解析
  // ══════════════════════════════════════════════════════
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = '';
      } else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };

  const readFileText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      resolve(text);
    };
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });

  // ══════════════════════════════════════════════════════
  // 政治人物列表上傳（CSV → Supabase）
  // ══════════════════════════════════════════════════════
  const handlePoliticianListUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileText(file);
      const lines = text.split('\n').filter(line => line.trim());
      const rawHeaders = parseCSVLine(lines[0]);
      const headers = rawHeaders.map(h => h.toLowerCase().trim());

      const aliasIdx = headers.findIndex(h => h === 'alias');
      const partyIdx = headers.findIndex(h => h === 'political_party_label');
      const countyIdx = headers.findIndex(h => h === 'county');
      const bgwIdx = headers.findIndex(h => h === 'bgw_spectrum');
      const nationalIdx = headers.findIndex(h => h === 'national_affairs');

      if (aliasIdx === -1) {
        alert(`找不到 alias 欄位\n偵測到的欄位：${rawHeaders.join(', ')}`);
        return;
      }

      const db = {};
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const alias = values[aliasIdx]?.trim();
        if (alias) {
          const nationalRaw = nationalIdx !== -1 ? values[nationalIdx]?.trim().toUpperCase() : '';
          db[alias] = {
            political_party_label: partyIdx !== -1 ? (values[partyIdx]?.trim() || '無特定政黨屬性') : '無特定政黨屬性',
            county: countyIdx !== -1 ? (values[countyIdx]?.trim() || '') : '',
            bgw_spectrum: bgwIdx !== -1 ? (values[bgwIdx]?.trim() || '') : '',
            national_affairs: nationalRaw === 'TRUE' || nationalRaw === '1' || nationalRaw === 'YES'
          };
        }
      }

      setPoliticianDB(db);
      setDbPage(0);
      await bulkUpsertToDB(db);
      alert(`載入 ${Object.keys(db).length} 位政治人物，並已同步至資料庫`);
    } catch (error) {
      alert('載入失敗: ' + error.message);
    }
  };

  // ══════════════════════════════════════════════════════
  // 新增 / 更新單一政治人物（原有表單）
  // ══════════════════════════════════════════════════════
  const handleAddOrUpdatePolitician = async () => {
    if (!newPolitician.alias) { alert('請輸入政治人物姓名'); return; }
    const info = {
      political_party_label: newPolitician.political_party_label || '無特定政黨屬性',
      county: newPolitician.county,
      bgw_spectrum: newPolitician.bgw_spectrum,
      national_affairs: newPolitician.national_affairs,
      otherTags: newPolitician.otherTags
    };
    setPoliticianDB(prev => ({ ...prev, [newPolitician.alias]: info }));
    await upsertToDB(newPolitician.alias, info);
    setNewPolitician({ alias: '', political_party_label: '', county: '', bgw_spectrum: '', national_affairs: false, otherTags: '' });
    setShowAddPolitician(false);
    alert(`已儲存 ${newPolitician.alias}`);
  };

  const searchPolitician = () => {
    if (!newPolitician.alias) return;
    const found = politicianDB[newPolitician.alias];
    if (found) {
      setNewPolitician({
        alias: newPolitician.alias,
        political_party_label: found.political_party_label || '',
        county: found.county || '',
        bgw_spectrum: found.bgw_spectrum || '',
        national_affairs: found.national_affairs || false,
        otherTags: found.otherTags || ''
      });
      alert('已找到此人物，可編輯後儲存');
    } else {
      alert('資料庫中找不到此人物，可以直接新增');
    }
  };

  // ══════════════════════════════════════════════════════
  // 圖表數據處理
  // ══════════════════════════════════════════════════════
  const parseNumeric = (str) => {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const aliasIdx = headers.findIndex(h => h === 'alias');
    const postIdx = headers.findIndex(h => h === 'post_count' || h === 'post');
    const engagementIdx = headers.findIndex(h => h === 'engagement_score' || h.includes('engagement'));
    if (aliasIdx === -1) return [];
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const alias = values[aliasIdx]?.trim();
      if (alias) {
        data.push({
          name: alias,
          post: postIdx !== -1 ? parseNumeric(values[postIdx]) : 0,
          score: engagementIdx !== -1 ? parseNumeric(values[engagementIdx]) : 0
        });
      }
    }
    return data;
  };

  const handleFiles = async (event, type) => {
    const files = Array.from(event.target.files);
    const allData = [];
    for (const file of files) {
      try {
        const text = await readFileText(file);
        allData.push(...parseCSV(text));
      } catch (error) {
        alert(`錯誤: ${error.message}`); return;
      }
    }
    const grouped = {};
    allData.forEach(item => {
      if (!grouped[item.name]) grouped[item.name] = { score: 0, post: 0 };
      grouped[item.name].score += item.score;
      grouped[item.name].post += item.post;
    });
    const result = Object.entries(grouped).map(([name, d]) => ({
      name,
      [type]: d.score,
      [`${type}Post`]: d.post
    }));
    if (type === 'internal') {
      internalFilesRef.current = result; setInternalFiles(result);
      if (externalFilesRef.current.length > 0) mergeData(result, externalFilesRef.current);
    } else {
      externalFilesRef.current = result; setExternalFiles(result);
      if (internalFilesRef.current.length > 0) mergeData(internalFilesRef.current, result);
    }
  };

  const mergeData = async (internal, external) => {
    const intMap = {};
    internal.forEach(d => { intMap[d.name] = d; });
    const extMap = {};
    external.forEach(d => { extMap[d.name] = d; });

    const allNames = new Set([...Object.keys(intMap), ...Object.keys(extMap)]);
    const merged = [];
    let id = 1;
    const missingParty = [];

    allNames.forEach(name => {
      const intItem = intMap[name];
      const extItem = extMap[name];
      const info = politicianDB[name];
      if (!info || !info.political_party_label) missingParty.push(name);

      const intVal = intItem?.internal ?? 0;
      const intPost = intItem?.internalPost ?? 0;
      const extVal = extItem?.external ?? 0;
      const externalOnly = !intItem;
      const avgPostImpact = (!externalOnly && intPost > 0) ? (intVal / intPost) : 0;
      const momentum = externalOnly ? extVal : Math.sqrt(intVal * intVal + extVal * extVal);
      const nationalAffairs = info?.national_affairs === true;

      merged.push({
        id: id++, name, internal: intVal, external: extVal,
        internalPost: intPost, avgPostImpact, externalOnly,
        party: info?.political_party_label || '無特定政黨屬性',
        county: info?.county || '',
        bgw_spectrum: info?.bgw_spectrum || '',
        national_affairs: nationalAffairs, momentum
      });
    });

    merged.sort((a, b) => b.momentum - a.momentum);

    const top30NeedUpdate = [];
    const updatedDB = { ...politicianDB };
    merged.forEach((item, idx) => {
      if (idx < 30 && !item.national_affairs) {
        top30NeedUpdate.push(item.name);
        item.national_affairs = true;
        updatedDB[item.name] = { ...(updatedDB[item.name] || {}), national_affairs: true };
      }
    });

    if (top30NeedUpdate.length > 0) {
      alert(`【自動更新】已將前30名的以下人物標記為全國性：\n${top30NeedUpdate.join(', ')}`);
      setPoliticianDB(updatedDB);
      // 同步到 Supabase
      for (const name of top30NeedUpdate) {
        await upsertToDB(name, updatedDB[name]);
      }
    }

    if (missingParty.length > 0) {
      alert(`【缺少政黨標籤】以下政治人物缺少政黨標籤：\n${missingParty.join(', ')}`);
    }

    setMergedData(merged);
    setDisplayData(merged);
    const externalOnlyCount = merged.filter(d => d.externalOnly).length;
    alert(`合併完成！\n總計：${merged.length} 位\n全國性：${merged.filter(d => d.national_affairs).length} 位\n僅外部數據（僅標籤）：${externalOnlyCount} 位`);
  };

  // ══════════════════════════════════════════════════════
  // 篩選
  // ══════════════════════════════════════════════════════
  const applyFilters = useCallback(() => {
    let base = showNationalOnly ? mergedData.filter(d => d.national_affairs) : [...mergedData];
    if (rankFilter.start || rankFilter.end) {
      const start = parseInt(rankFilter.start) || 1;
      const end = parseInt(rankFilter.end) || base.length;
      base = base.slice(start - 1, end);
    }
    let filtered = base;
    if (selectedParties.length > 0) filtered = filtered.filter(d => selectedParties.includes(d.party));
    if (selectedCities.length > 0) filtered = filtered.filter(d => selectedCities.some(city => d.county && d.county.includes(city)));
    if (searchName) filtered = filtered.filter(d => d.name.includes(searchName));
    if (selectedTag) {
      const taggedNames = Object.entries(tags).filter(([_, t]) => t === selectedTag).map(([name]) => name);
      filtered = filtered.filter(d => taggedNames.includes(d.name));
    }
    // 象限篩選（依據 external / internal 中位數判斷象限）
    if (selectedQuadrants.length > 0) {
      const externals = base.map(d => d.external);
      const internals = base.filter(d => !d.externalOnly).map(d => d.internal);
      const midX = externals.length ? (Math.min(...externals) + Math.max(...externals)) / 2 : 0;
      const midY = internals.length ? (Math.min(...internals) + Math.max(...internals)) / 2 : 0;
      filtered = filtered.filter(d => {
        const highX = d.external >= midX;
        const highY = !d.externalOnly && d.internal >= midY;
        if (selectedQuadrants.includes('q1') && highX && highY) return true;   // 風暴中心
        if (selectedQuadrants.includes('q2') && !highX && highY) return true;  // 鐵粉經營
        if (selectedQuadrants.includes('q3') && !highX && !highY) return true; // 沉潛蟄伏
        if (selectedQuadrants.includes('q4') && highX && !highY) return true;  // 被動捲入
        return false;
      });
    }
    setDisplayData(filtered);
  }, [mergedData, showNationalOnly, selectedParties, selectedCities, searchName, rankFilter, selectedTag, tags, selectedQuadrants]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const clearFilters = () => {
    setShowNationalOnly(false); setSelectedParties([]); setSelectedCities([]);
    setSearchName(''); setRankFilter({ start: '', end: '' }); setSelectedTag('');
    setSelectedQuadrants([]);
  };

  const toggleParty = (party) => setSelectedParties(prev => prev.includes(party) ? prev.filter(p => p !== party) : [...prev, party]);
  const toggleCity = (city) => setSelectedCities(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]);

  // ══════════════════════════════════════════════════════
  // 政治人物列表 DB 編輯器
  // ══════════════════════════════════════════════════════
  const dbEntries = useMemo(() => {
    const entries = Object.entries(politicianDB);
    if (!dbSearch.trim()) return entries;
    return entries.filter(([alias]) => alias.includes(dbSearch.trim()));
  }, [politicianDB, dbSearch]);

  const dbTotalPages = Math.ceil(dbEntries.length / DB_PAGE_SIZE);
  const dbPageEntries = dbEntries.slice(dbPage * DB_PAGE_SIZE, (dbPage + 1) * DB_PAGE_SIZE);

  const startEditDB = (alias) => {
    const info = politicianDB[alias];
    setEditingAlias(alias);
    setEditForm({
      alias,
      political_party_label: info?.political_party_label || '',
      county: info?.county || '',
      bgw_spectrum: info?.bgw_spectrum || '',
      national_affairs: info?.national_affairs || false
    });
  };

  const saveEditDB = async () => {
    if (!editForm.alias) return;
    const updatedDB = { ...politicianDB };
    if (editForm.alias !== editingAlias) delete updatedDB[editingAlias];
    const info = {
      political_party_label: editForm.political_party_label || '無特定政黨屬性',
      county: editForm.county || '',
      bgw_spectrum: editForm.bgw_spectrum || '',
      national_affairs: editForm.national_affairs || false
    };
    updatedDB[editForm.alias] = info;
    setPoliticianDB(updatedDB);
    // 如果 alias 改變了，刪除舊記錄並新增
    if (editForm.alias !== editingAlias) {
      await deleteFromSupabase(editingAlias);
    }
    await upsertToDB(editForm.alias, info);
    setEditingAlias(null);
    setEditForm({});
  };

  const cancelEditDB = () => { setEditingAlias(null); setEditForm({}); };

  const deleteFromDB = async (alias) => {
    if (!window.confirm(`確定要刪除「${alias}」嗎？`)) return;
    const updatedDB = { ...politicianDB };
    delete updatedDB[alias];
    setPoliticianDB(updatedDB);
    await deleteFromSupabase(alias);
  };

  const addNewToDBInline = () => {
    setEditingAlias('__new__');
    setEditForm({ alias: '', political_party_label: '', county: '', bgw_spectrum: '', national_affairs: false });
  };

  const saveNewToDBInline = async () => {
    if (!editForm.alias) { alert('請輸入姓名'); return; }
    const info = {
      political_party_label: editForm.political_party_label || '無特定政黨屬性',
      county: editForm.county || '',
      bgw_spectrum: editForm.bgw_spectrum || '',
      national_affairs: editForm.national_affairs || false
    };
    setPoliticianDB(prev => ({ ...prev, [editForm.alias]: info }));
    await upsertToDB(editForm.alias, info);
    setEditingAlias(null);
    setEditForm({});
  };

  // ══════════════════════════════════════════════════════
  // 匯出
  // ══════════════════════════════════════════════════════
  const buildExportSVGString = () => {
    if (!svgRef.current) return null;
    const svgClone = svgRef.current.cloneNode(true);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svgClone.style.background = '#ffffff';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `text { font-family: 'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', '微軟正黑體', sans-serif; }`;
    defs.appendChild(style);
    svgClone.insertBefore(defs, svgClone.firstChild);
    return new XMLSerializer().serializeToString(svgClone);
  };

  const exportSVG = () => {
    const svgData = buildExportSVGString();
    if (!svgData) return;
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'political-formation.svg'; link.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = () => {
    const svgData = buildExportSVGString();
    if (!svgData) return;
    const { width: w, height: h } = getCanvasDimensions();
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = 'political-formation.png';
      link.href = canvas.toDataURL('image/png'); link.click();
    };
    img.onerror = () => { URL.revokeObjectURL(url); alert('PNG 匯出失敗，請改用 SVG 匯出'); };
    img.src = url;
  };

  // ══════════════════════════════════════════════════════
  // 下拉選單：點擊外部關閉
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (partyDropdownRef.current && !partyDropdownRef.current.contains(e.target)) setShowPartyDropdown(false);
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target)) setShowCityDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ══════════════════════════════════════════════════════
  // 縮放 & 平移
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const d = getCanvasDimensions();
    const calcFit = () => {
      const fz = Math.min(el.clientWidth / d.width, el.clientHeight / d.height);
      fitZoomRef.current = fz;
      if (!hasFitRef.current) {
        hasFitRef.current = true;
        setZoom(fz);
        setPan({ x: 0, y: 0 });
      }
    };
    calcFit();
    const ro = new ResizeObserver(calcFit);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize]);

  // canvasSize 改變時重置 fit
  useEffect(() => {
    hasFitRef.current = false;
  }, [canvasSize]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.01;
        setZoom(prev => Math.min(Math.max(prev + delta, 0.05), 5));
      } else {
        setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    const handlePointerDown = (e) => {
      if (e.button !== 0 && e.pointerType !== 'touch') return;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { x: pan.x, y: pan.y };
      el.setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e) => {
      if (!isPanning.current) return;
      setPan({ x: panOrigin.current.x + (e.clientX - panStart.current.x), y: panOrigin.current.y + (e.clientY - panStart.current.y) });
    };
    const handlePointerUp = () => { isPanning.current = false; };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [pan.x, pan.y]);

  const handleZoomReset = () => { setZoom(fitZoomRef.current); setPan({ x: 0, y: 0 }); };
  const isAtFit = Math.abs(zoom - fitZoomRef.current) < 0.005 && pan.x === 0 && pan.y === 0;

  // ══════════════════════════════════════════════════════
  // 圖表渲染
  // ══════════════════════════════════════════════════════
  const dims = getCanvasDimensions();
  const partiesInChart = sortParties([...new Set(displayData.map(d => d.party))]);
  const filterBase = useMemo(() => showNationalOnly ? mergedData.filter(d => d.national_affairs) : mergedData, [mergedData, showNationalOnly]);
  const availableParties = sortParties([...new Set(filterBase.map(d => d.party))]);
  const availableTags = [...new Set(Object.values(tags))];

  const scaleValue = (value, min, max, pixelMin, pixelMax) => {
    if (max === min) return (pixelMin + pixelMax) / 2;
    return pixelMin + ((value - min) / (max - min)) * (pixelMax - pixelMin);
  };

  const renderChart = () => {
    const legendRows = partiesInChart.length > 0 ? Math.ceil(partiesInChart.length / 8) : 0;
    const legendHeight = legendRows > 0 ? 60 + legendRows * 20 : 60;
    const margin = { top: legendHeight + 40, right: 120, bottom: 90, left: 130 };
    const width = dims.width - margin.left - margin.right;
    const height = dims.height - margin.top - margin.bottom;

    if (displayData.length === 0) {
      return (
        <g transform={`translate(${margin.left},${margin.top})`}>
          <text x={width / 2} y={height / 2} textAnchor="middle" fontSize="16" fill="#666">
            請上傳數據
          </text>
        </g>
      );
    }

    const externals = displayData.map(d => d.external);
    const internals = displayData.filter(d => !d.externalOnly).map(d => d.internal);
    let minX = axisRange.autoAdjust ? 0 : (parseFloat(axisRange.xMin) || 0);
    let maxX = axisRange.autoAdjust ? (Math.max(...externals) || 1) : (parseFloat(axisRange.xMax) || 100000);
    let minY = axisRange.autoAdjust ? 0 : (parseFloat(axisRange.yMin) || 0);
    let maxY = axisRange.autoAdjust ? (Math.max(...(internals.length ? internals : [1])) || 1) : (parseFloat(axisRange.yMax) || 50000);
    if (axisRange.autoAdjust) { maxX *= 1.05; maxY *= 1.05; }

    const avgImpacts = displayData.filter(d => !d.externalOnly).map(d => d.avgPostImpact);
    const maxAvgImpact = avgImpacts.length > 0 ? Math.max(...avgImpacts) : 1;

    const positions = displayData.map(d => {
      const x = scaleValue(d.external, minX, maxX, 0, width);
      const y = d.externalOnly ? height : scaleValue(d.internal, minY, maxY, height, 0);
      const size = d.externalOnly ? 0 : bubbleSettings.minRadius + (maxAvgImpact > 0 ? (d.avgPostImpact / maxAvgImpact) * (bubbleSettings.maxRadius - bubbleSettings.minRadius) : 0);
      return { ...d, x, y, size };
    });

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({ pos: width * ratio, value: Math.round(minX + (maxX - minX) * ratio) }));
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({ pos: height * (1 - ratio), value: Math.round(minY + (maxY - minY) * ratio) }));

    // 象限分隔線位置（數據範圍中點）
    const midXVal = (minX + maxX) / 2;
    const midYVal = (minY + maxY) / 2;
    const midXPx = scaleValue(midXVal, minX, maxX, 0, width);
    const midYPx = scaleValue(midYVal, minY, maxY, height, 0);

    return (
      <g transform={`translate(${margin.left},${margin.top})`}>

        {/* 象限背景色（極淡） */}
        {displayOptions.quadrantBg && <>
          <rect x={0} y={0} width={midXPx} height={midYPx} fill="#4ECDC4" opacity="0.07" />
          <rect x={midXPx} y={0} width={width - midXPx} height={midYPx} fill="#FF6B35" opacity="0.07" />
          <rect x={0} y={midYPx} width={midXPx} height={height - midYPx} fill="#7B9CC0" opacity="0.07" />
          <rect x={midXPx} y={midYPx} width={width - midXPx} height={height - midYPx} fill="#FF9999" opacity="0.07" />
        </>}

        {/* 象限標籤 */}
        {displayOptions.quadrantLabel && <>
          <text x={midXPx / 2} y={28} textAnchor="middle" fontSize="15" fill="#3A9A8A" opacity="0.75">🏠 鐵粉經營</text>
          <text x={midXPx + (width - midXPx) / 2} y={28} textAnchor="middle" fontSize="15" fill="#C05A20" opacity="0.75">🔥 風暴中心</text>
          <text x={midXPx / 2} y={height - 16} textAnchor="middle" fontSize="15" fill="#5A6A8A" opacity="0.75">😶 沉潛蟄伏</text>
          <text x={midXPx + (width - midXPx) / 2} y={height - 16} textAnchor="middle" fontSize="15" fill="#B04040" opacity="0.75">🎯 被動捲入</text>
        </>}

        {/* 象限分隔虛線 */}
        <line x1={midXPx} y1={0} x2={midXPx} y2={height} stroke="#888" strokeWidth="1.5" strokeDasharray="8,6" opacity="0.5" />
        <line x1={0} y1={midYPx} x2={width} y2={midYPx} stroke="#888" strokeWidth="1.5" strokeDasharray="8,6" opacity="0.5" />

        {/* 格線 */}
        <g opacity="0.25">
          {xTicks.map((tick, i) => (
            <g key={`xtick-${i}`}>
              <line x1={tick.pos} y1={0} x2={tick.pos} y2={height} stroke="#aaa" strokeWidth="1" />
              <text x={tick.pos} y={height + 22} textAnchor="middle" fontSize="11" fill="#555">{formatAxisLabel(tick.value)}</text>
            </g>
          ))}
          {yTicks.map((tick, i) => (
            <g key={`ytick-${i}`}>
              <line x1={0} y1={tick.pos} x2={width} y2={tick.pos} stroke="#aaa" strokeWidth="1" />
              <text x={-10} y={tick.pos + 4} textAnchor="end" fontSize="11" fill="#555">{formatAxisLabel(tick.value)}</text>
            </g>
          ))}
        </g>

        {/* 座標軸 */}
        <line x1={0} y1={height} x2={width} y2={height} stroke="#333" strokeWidth="2" />
        <line x1={0} y1={0} x2={0} y2={height} stroke="#333" strokeWidth="2" />
        <circle cx={0} cy={height} r="4" fill="#333" />
        <text x={-8} y={height + 18} fontSize="11" fill="#333">(0,0)</text>

        {/* 關係線 */}
        {displayOptions.relationLines && relationships.map((rel, idx) => {
          const pA = positions.find(p => p.name === rel.personA);
          const pB = positions.find(p => p.name === rel.personB);
          if (!pA || !pB) return null;
          const relType = RELATIONSHIP_TYPES[rel.type];
          return (
            <line key={idx} x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y}
              stroke={relType.color} strokeWidth="2.5" strokeDasharray={relType.dash} opacity="0.8" />
          );
        })}

        {/* 泡泡 & 標籤（防重疊） */}
        {(() => {
          // 計算每個標籤的防重疊位置
          const fontSize = bubbleSettings.fontSize;
          const charW = fontSize * 0.62; // 中文字寬估算
          const lineH = fontSize + 2;
          // 已佔用的標籤矩形紀錄
          const placed = [];
          const getLabelRect = (cx, cy, text) => {
            const tw = text.length * charW;
            return { x: cx - tw / 2, y: cy - lineH, w: tw, h: lineH };
          };
          const overlaps = (a, b) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
          // 候選偏移方向（先上，再右上、左上、右、左、下方向）
          const offsets = [
            (size) => ({ dx: 0,         dy: -(size + 6) }),
            (size) => ({ dx: size * 0.7, dy: -(size + 6) }),
            (size) => ({ dx: -size * 0.7,dy: -(size + 6) }),
            (size) => ({ dx: size + 4,   dy: 0 }),
            (size) => ({ dx: -(size + 4),dy: 0 }),
            (size) => ({ dx: 0,          dy: size + 14 }),
            (size) => ({ dx: size * 0.7, dy: -(size + 16) }),
            (size) => ({ dx: -size * 0.7,dy: -(size + 16) }),
          ];

          return positions.map(p => {
            const partyInfo = PARTY_COLORS[p.party] || PARTY_COLORS['無特定政黨屬性'];
            const highlight = highlights[p.name];
            const isBold = searchName && p.name.includes(searchName);

            if (p.externalOnly) {
              return (
                <g key={p.id}>
                  <polygon points={`${p.x},${p.y - 6} ${p.x - 4},${p.y + 1} ${p.x + 4},${p.y + 1}`} fill={partyInfo.color} opacity="0.7" />
                  {displayOptions.nameLabel && (
                    <text x={p.x} y={p.y - 10} fontSize={fontSize} fill="#222"
                      textAnchor="middle" fontWeight={isBold ? 'bold' : 'normal'} fontStyle="italic" opacity="0.85">
                      {p.name}
                    </text>
                  )}
                </g>
              );
            }

            // 防重疊：找到第一個不重疊的偏移
            let labelDx = 0, labelDy = -(p.size + 6);
            if (displayOptions.nameLabel && displayOptions.labelAntiOverlap) {
              for (const getOff of offsets) {
                const off = getOff(p.size);
                const rect = getLabelRect(p.x + off.dx, p.y + off.dy, p.name);
                if (!placed.some(r => overlaps(r, rect))) {
                  labelDx = off.dx;
                  labelDy = off.dy;
                  placed.push(rect);
                  break;
                }
              }
              // 若全部重疊，仍使用預設位置
              if (labelDx === 0 && labelDy === -(p.size + 6)) {
                placed.push(getLabelRect(p.x, p.y + labelDy, p.name));
              }
            }

            return (
              <g key={p.id}>
                {highlight?.type === 'glow' && (
                  <circle cx={p.x} cy={p.y} r={p.size + 6} fill="none" stroke={highlight.color} strokeWidth="3" opacity="0.55" />
                )}
                {highlight?.type === 'circle' && (
                  <circle cx={p.x} cy={p.y} r={p.size + 8} fill="none" stroke={highlight.color} strokeWidth="2.5" opacity="0.9" />
                )}
                <circle cx={p.x} cy={p.y} r={p.size} fill={partyInfo.color} opacity="0.82" />
                {highlight?.type === 'square' && (
                  <rect x={p.x - p.size - 4} y={p.y - p.size - 4}
                    width={(p.size + 4) * 2} height={(p.size + 4) * 2}
                    fill="none" stroke={highlight.color} strokeWidth="2.5" />
                )}
                {displayOptions.nameLabel && (
                  <text
                    x={p.x + labelDx}
                    y={p.y + labelDy}
                    fontSize={fontSize}
                    fill="#111"
                    textAnchor="middle"
                    fontWeight={isBold ? 'bold' : 'normal'}>
                    {p.name}
                  </text>
                )}
              </g>
            );
          });
        })()}

        {/* 軸標籤 */}
        <text x={width / 2} y={height + 58} fontSize="13" textAnchor="middle" fill="#444">
          外部影響力（非自主經營：媒體、他人粉專討論）→
        </text>
        <text x={0} y={0} fontSize="13" textAnchor="middle" fill="#444"
          transform={`translate(${-margin.left + 22}, ${height / 2}) rotate(-90)`}>
          ↑ 內部影響力（自主經營：粉專貼文）
        </text>
      </g>
    );
  };

  // ══════════════════════════════════════════════════════
  // 主渲染
  // ══════════════════════════════════════════════════════
  return (
    <div className="w-full h-screen bg-gray-50 flex">

      {/* ── 左側面板 ── */}
      <div className="w-80 bg-white border-r overflow-y-auto flex-shrink-0">
        <div className="p-3 border-b">
          <h1 className="font-bold text-lg">政壇形勢分析系統</h1>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            PEARSON Data · v2.0
            {dbLoading && <span className="text-orange-500">⏳ 載入中...</span>}
            {!dbLoading && dbSyncing && <span className="text-blue-500">🔄 同步中...</span>}
            {!dbLoading && !dbSyncing && <span className="text-green-600">✓ 已連線</span>}
          </p>
        </div>

        <div className="flex border-b">
          {[
            { key: 'data', icon: '📥', label: '匯入' },
            { key: 'filter', icon: '🔍', label: '篩選' },
            { key: 'annotate', icon: '🏷️', label: '標註' },
            { key: 'settings', icon: '⚙️', label: '設定' }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 p-2 text-xs ${activeTab === tab.key ? 'border-b-2 border-teal-600 bg-teal-50' : ''}`}>
              <div>{tab.icon}</div>
              <div>{tab.label}</div>
            </button>
          ))}
        </div>

        <div className="p-3">

          {/* ── 匯入 Tab ── */}
          {activeTab === 'data' && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-sm mb-2">匯入數據</h3>
                <div className="space-y-3">

                  {/* 政治人物列表 */}
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">政治人物列表 (CSV)</span>
                      {Object.keys(politicianDB).length > 0 && (
                        <button onClick={() => { setPoliticianDB({}); if (politicianFileRef.current) politicianFileRef.current.value = ''; }}
                          className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                          清除（本地）
                        </button>
                      )}
                    </div>
                    <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded bg-white hover:border-teal-400 hover:bg-teal-50 cursor-pointer transition-colors text-xs text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      選擇檔案
                      <input type="file" accept=".csv" ref={politicianFileRef} onChange={handlePoliticianListUpload} className="hidden" />
                    </label>
                    {Object.keys(politicianDB).length > 0 && (
                      <div className="text-xs text-green-600 mt-1">✓ 已載入 {Object.keys(politicianDB).length} 人（含資料庫資料）</div>
                    )}
                    {dbLoading && (
                      <div className="text-xs text-orange-500 mt-1">⏳ 正在從資料庫載入...</div>
                    )}
                  </div>

                  {/* 內部數據 */}
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">內部數據 (可多選)</span>
                      {internalFiles.length > 0 && (
                        <button onClick={() => { internalFilesRef.current = []; setInternalFiles([]); setMergedData([]); setDisplayData([]); if (internalFileRef.current) internalFileRef.current.value = ''; }}
                          className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200">清除</button>
                      )}
                    </div>
                    <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded bg-white hover:border-teal-400 hover:bg-teal-50 cursor-pointer transition-colors text-xs text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      選擇檔案（可多選）
                      <input type="file" accept=".csv" multiple ref={internalFileRef} onChange={(e) => handleFiles(e, 'internal')} className="hidden" />
                    </label>
                    {internalFiles.length > 0 && <div className="text-xs text-green-600 mt-1">✓ 已載入 {internalFiles.length} 人</div>}
                  </div>

                  {/* 外部數據 */}
                  <div className="p-2 bg-gray-50 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">外部數據 (可多選)</span>
                      {externalFiles.length > 0 && (
                        <button onClick={() => { externalFilesRef.current = []; setExternalFiles([]); setMergedData([]); setDisplayData([]); if (externalFileRef.current) externalFileRef.current.value = ''; }}
                          className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200">清除</button>
                      )}
                    </div>
                    <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded bg-white hover:border-teal-400 hover:bg-teal-50 cursor-pointer transition-colors text-xs text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      選擇檔案（可多選）
                      <input type="file" accept=".csv" multiple ref={externalFileRef} onChange={(e) => handleFiles(e, 'external')} className="hidden" />
                    </label>
                    {externalFiles.length > 0 && <div className="text-xs text-green-600 mt-1">✓ 已載入 {externalFiles.length} 人</div>}
                  </div>
                </div>
              </div>

              {/* ── 政治人物列表編輯器 ── */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm">
                    政治人物列表
                    <span className="ml-1 text-gray-400 font-normal text-xs">({Object.keys(politicianDB).length} 人)</span>
                  </h3>
                  <button
                    onClick={() => { setShowDBEditor(v => !v); setDbPage(0); }}
                    className={`text-xs px-2 py-0.5 rounded ${showDBEditor ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-700 hover:bg-teal-200'}`}
                  >
                    {showDBEditor ? '收起' : '展開編輯'}
                  </button>
                </div>

                {showDBEditor && (
                  <div className="space-y-2">
                    <input type="text" value={dbSearch}
                      onChange={(e) => { setDbSearch(e.target.value); setDbPage(0); }}
                      placeholder="搜尋姓名..."
                      className="w-full px-2 py-1 border rounded text-xs" />

                    <div className="border rounded overflow-hidden">
                      <div className="grid text-xs font-medium bg-gray-100 border-b px-2 py-1"
                        style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
                        <span>姓名</span><span>政黨</span><span>縣市</span><span></span>
                      </div>

                      {/* 新增中的列 */}
                      {editingAlias === '__new__' && (
                        <DBEditForm
                          form={editForm}
                          onChange={setEditForm}
                          onSave={saveNewToDBInline}
                          onCancel={cancelEditDB}
                          bgClass="bg-teal-50"
                        />
                      )}

                      {/* 資料列 */}
                      <div className="max-h-64 overflow-y-auto">
                        {dbPageEntries.map(([alias, info]) => (
                          <div key={alias}>
                            {editingAlias === alias ? (
                              <DBEditForm
                                form={editForm}
                                onChange={setEditForm}
                                onSave={saveEditDB}
                                onCancel={cancelEditDB}
                                bgClass="bg-yellow-50"
                              />
                            ) : (
                              <div className="grid items-center px-2 py-1 border-b hover:bg-gray-50 text-xs"
                                style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
                                <span className="truncate font-medium" title={alias}>{alias}</span>
                                <span className="truncate" style={{ color: (PARTY_COLORS[info?.political_party_label] || PARTY_COLORS['無特定政黨屬性']).color }}>
                                  {info?.political_party_label || '—'}
                                </span>
                                <span className="truncate text-gray-500">{info?.county || '—'}</span>
                                <div className="flex gap-1 ml-1">
                                  <button onClick={() => startEditDB(alias)} className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200" title="編輯">✏️</button>
                                  <button onClick={() => deleteFromDB(alias)} className="px-1 py-0.5 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200" title="刪除">🗑️</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {dbPageEntries.length === 0 && (
                          <div className="text-center text-gray-400 text-xs py-3">
                            {dbSearch ? '找不到符合的人物' : '列表為空'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 分頁 */}
                    {dbTotalPages > 1 && (
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <button disabled={dbPage === 0} onClick={() => setDbPage(p => p - 1)} className="px-2 py-0.5 bg-gray-100 rounded disabled:opacity-40">‹ 上一頁</button>
                        <span>{dbPage + 1} / {dbTotalPages}</span>
                        <button disabled={dbPage >= dbTotalPages - 1} onClick={() => setDbPage(p => p + 1)} className="px-2 py-0.5 bg-gray-100 rounded disabled:opacity-40">下一頁 ›</button>
                      </div>
                    )}

                    {/* 新增按鈕 */}
                    {editingAlias !== '__new__' && (
                      <button onClick={addNewToDBInline}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 border border-teal-300 rounded text-xs hover:bg-teal-100">
                        <Plus /> 新增人物
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── 加入新政治人物（快速表單）── */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm">加入新政治人物</h3>
                  <button onClick={() => setShowAddPolitician(!showAddPolitician)} className="p-1 bg-teal-600 text-white rounded"><Plus /></button>
                </div>
                {showAddPolitician && (
                  <div className="space-y-2 p-2 bg-gray-50 rounded">
                    <div className="flex gap-2">
                      <input type="text" placeholder="姓名" value={newPolitician.alias}
                        onChange={(e) => setNewPolitician({ ...newPolitician, alias: e.target.value })}
                        className="flex-1 px-2 py-1 border rounded text-xs" />
                      <button onClick={searchPolitician} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">搜尋</button>
                    </div>
                    <select value={newPolitician.political_party_label}
                      onChange={(e) => setNewPolitician({ ...newPolitician, political_party_label: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-xs">
                      <option value="">選擇政黨</option>
                      {Object.keys(PARTY_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={newPolitician.county}
                      onChange={(e) => setNewPolitician({ ...newPolitician, county: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-xs">
                      <option value="">選擇縣市</option>
                      {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={newPolitician.national_affairs}
                        onChange={(e) => setNewPolitician({ ...newPolitician, national_affairs: e.target.checked })} />
                      <span className="text-xs">全國性議題</span>
                    </label>
                    <div className="flex gap-2">
                      <button onClick={handleAddOrUpdatePolitician} className="flex-1 px-2 py-1 bg-teal-600 text-white rounded text-xs">儲存</button>
                      <button onClick={() => setShowAddPolitician(false)} className="flex-1 px-2 py-1 bg-gray-300 rounded text-xs">取消</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 篩選 Tab ── */}
          {activeTab === 'filter' && (
            <div className="space-y-4">
              {/* 全國性切換 */}
              <div className="p-2 bg-teal-50 border border-teal-200 rounded">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setShowNationalOnly(v => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showNationalOnly ? 'bg-teal-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showNationalOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-teal-800">顯示全國性人物</div>
                    <div className="text-xs text-teal-600">
                      {showNationalOnly ? `共 ${mergedData.filter(d => d.national_affairs).length} 人` : `全部 ${mergedData.length} 人`}
                    </div>
                  </div>
                </label>
              </div>

              {/* 政黨篩選 */}
              <div className="relative" ref={partyDropdownRef}>
                <h3 className="font-bold text-sm mb-2">政黨篩選</h3>
                <button onClick={() => setShowPartyDropdown(v => !v)}
                  className="w-full flex justify-between items-center px-3 py-2 border rounded text-sm bg-white">
                  <span className="text-xs">{selectedParties.length > 0 ? `已選 ${selectedParties.length} 個政黨` : '選擇政黨'}</span>
                  <ChevronDown />
                </button>
                {showPartyDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                    {/* 全選 / 全不選 */}
                    <div className="flex gap-1 px-3 py-1.5 border-b bg-gray-50 sticky top-0">
                      <button onClick={() => setSelectedParties(availableParties)}
                        className="flex-1 px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200">全選</button>
                      <button onClick={() => setSelectedParties([])}
                        className="flex-1 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300">全不選</button>
                    </div>
                    {availableParties.map(party => {
                      const count = filterBase.filter(d => d.party === party).length;
                      const dotColor = (PARTY_COLORS[party] || PARTY_COLORS['無特定政黨屬性']).color;
                      return (
                        <label key={party} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs">
                          <input type="checkbox" checked={selectedParties.includes(party)} onChange={() => toggleParty(party)} className="mr-2" />
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor, marginRight: 4, flexShrink: 0 }} />
                          <span>{party} ({count})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 縣市篩選 */}
              <div className="relative" ref={cityDropdownRef}>
                <h3 className="font-bold text-sm mb-2">縣市篩選</h3>
                <button onClick={() => setShowCityDropdown(v => !v)}
                  className="w-full flex justify-between items-center px-3 py-2 border rounded text-sm bg-white">
                  <span className="text-xs">{selectedCities.length > 0 ? `已選 ${selectedCities.length} 個縣市` : '選擇縣市'}</span>
                  <ChevronDown />
                </button>
                {showCityDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                    {/* 全選 / 全不選 */}
                    <div className="flex gap-1 px-3 py-1.5 border-b bg-gray-50 sticky top-0">
                      <button onClick={() => setSelectedCities(COUNTIES)}
                        className="flex-1 px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200">全選</button>
                      <button onClick={() => setSelectedCities([])}
                        className="flex-1 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300">全不選</button>
                    </div>
                    {COUNTIES.map(county => {
                      const count = filterBase.filter(d => d.county && d.county.includes(county)).length;
                      return (
                        <label key={county} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs">
                          <input type="checkbox" checked={selectedCities.includes(county)} onChange={() => toggleCity(county)} className="mr-2" />
                          <span>{county} ({count})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 姓名搜尋 */}
              <div>
                <h3 className="font-bold text-sm mb-2">姓名搜尋</h3>
                <input type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)}
                  placeholder="輸入姓名關鍵字..." className="w-full px-2 py-1 border rounded text-xs" />
              </div>

              {/* 排名篩選 */}
              <div>
                <h3 className="font-bold text-sm mb-2">排名篩選</h3>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="開始排名" value={rankFilter.start}
                    onChange={(e) => setRankFilter(prev => ({ ...prev, start: e.target.value }))}
                    onBlur={() => {
                      const s = parseInt(rankFilter.start);
                      const e = parseInt(rankFilter.end);
                      if (!isNaN(s) && !isNaN(e) && s > e) {
                        setRankFilter({ start: String(e), end: String(s) });
                      }
                    }}
                    className="px-2 py-1 border rounded text-xs" />
                  <input type="number" placeholder="結束排名" value={rankFilter.end}
                    onChange={(e) => setRankFilter(prev => ({ ...prev, end: e.target.value }))}
                    onBlur={() => {
                      const s = parseInt(rankFilter.start);
                      const e = parseInt(rankFilter.end);
                      if (!isNaN(s) && !isNaN(e) && s > e) {
                        setRankFilter({ start: String(e), end: String(s) });
                      }
                    }}
                    className="px-2 py-1 border rounded text-xs" />
                </div>
                <p className="text-xs text-gray-400 mt-1">輸入後自動調整為小→大順序</p>
              </div>

              {/* 象限篩選 */}
              <div>
                <h3 className="font-bold text-sm mb-2">象限篩選</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'q1', label: '🔥 風暴中心', sub: '內外皆強', activeBg: 'bg-orange-100 border-orange-400', inactiveBg: 'bg-white border-gray-200' },
                    { key: 'q2', label: '🏠 鐵粉經營', sub: '內強外弱', activeBg: 'bg-teal-100 border-teal-400', inactiveBg: 'bg-white border-gray-200' },
                    { key: 'q3', label: '😶 沉潛蟄伏', sub: '內外皆弱', activeBg: 'bg-blue-100 border-blue-400', inactiveBg: 'bg-white border-gray-200' },
                    { key: 'q4', label: '🎯 被動捲入', sub: '外強內弱', activeBg: 'bg-red-100 border-red-400', inactiveBg: 'bg-white border-gray-200' },
                  ].map(({ key, label, sub, activeBg, inactiveBg }) => {
                    const isActive = selectedQuadrants.includes(key);
                    return (
                      <button key={key} onClick={() => toggleQuadrant(key)}
                        className={`flex flex-col items-center px-2 py-2 border-2 rounded text-xs transition-all ${isActive ? activeBg : inactiveBg}`}>
                        <span className="font-medium text-center leading-tight">{label}</span>
                        <span className="text-gray-400 text-xs mt-0.5">{sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold">符合條件: <span className="text-teal-600">{displayData.length}</span> 人</span>
                  <button onClick={clearFilters} className="px-3 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">清除所有篩選</button>
                </div>
              </div>
            </div>
          )}

          {/* ── 標註 Tab ── */}
          {activeTab === 'annotate' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-2">🎯 人物標註</h3>
                <div className="space-y-2">
                  <select value={highlightSettings.person}
                    onChange={(e) => setHighlightSettings({ ...highlightSettings, person: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-xs">
                    <option value="">選擇人物</option>
                    {displayData.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <input type="color" value={highlightSettings.color}
                      onChange={(e) => setHighlightSettings({ ...highlightSettings, color: e.target.value })}
                      className="w-12 h-8 border rounded" />
                    <select value={highlightSettings.type}
                      onChange={(e) => setHighlightSettings({ ...highlightSettings, type: e.target.value })}
                      className="flex-1 px-2 py-1 border rounded text-xs">
                      <option value="circle">圓形框</option>
                      <option value="square">方形框</option>
                      <option value="glow">發光效果</option>
                    </select>
                  </div>
                  <button onClick={() => { if (highlightSettings.person) setHighlights({ ...highlights, [highlightSettings.person]: { color: highlightSettings.color, type: highlightSettings.type } }); }}
                    className="w-full px-2 py-1 bg-teal-600 text-white rounded text-xs">新增標註</button>
                  {Object.keys(highlights).length > 0 && (
                    <div className="space-y-1 mt-1">
                      {Object.entries(highlights).map(([name, hl]) => (
                        <div key={name} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded">
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: hl.color, flexShrink: 0, border: '1.5px solid rgba(0,0,0,0.1)' }} />
                          <span className="flex-1 text-xs truncate">{name}</span>
                          <button
                            onClick={() => { const next = { ...highlights }; delete next[name]; setHighlights(next); }}
                            className="text-gray-400 hover:text-red-500 text-xs font-bold px-1 flex-shrink-0"
                            title="移除標註">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setHighlights({})} className="w-full px-2 py-1 bg-gray-200 rounded text-xs">清除所有標註</button>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm mb-2">🔗 人物關係線</h3>
                <div className="space-y-2">
                  <select value={newRelationship.personA}
                    onChange={(e) => setNewRelationship({ ...newRelationship, personA: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-xs">
                    <option value="">人物 A</option>
                    {displayData.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <select value={newRelationship.personB}
                    onChange={(e) => setNewRelationship({ ...newRelationship, personB: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-xs">
                    <option value="">人物 B</option>
                    {displayData.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <select value={newRelationship.type}
                    onChange={(e) => setNewRelationship({ ...newRelationship, type: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-xs">
                    {Object.entries(RELATIONSHIP_TYPES).map(([key, rel]) => <option key={key} value={key}>{rel.name}</option>)}
                  </select>
                  <button onClick={() => { if (newRelationship.personA && newRelationship.personB) { setRelationships([...relationships, newRelationship]); setNewRelationship({ personA: '', personB: '', type: 'compete' }); } }}
                    className="w-full px-2 py-1 bg-teal-600 text-white rounded text-xs">新增關係</button>
                  {relationships.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {relationships.map((rel, idx) => {
                        const relType = RELATIONSHIP_TYPES[rel.type];
                        return (
                          <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded">
                            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: relType.color, flexShrink: 0, border: '1.5px solid rgba(0,0,0,0.1)' }} />
                            <span className="flex-1 text-xs truncate">{rel.personA} ↔ {rel.personB}</span>
                            <button
                              onClick={() => setRelationships(prev => prev.filter((_, i) => i !== idx))}
                              className="text-gray-400 hover:text-red-500 text-xs font-bold px-1 flex-shrink-0"
                              title="移除關係線">
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={() => setRelationships([])} className="w-full px-2 py-1 bg-gray-200 rounded text-xs">清除所有關係線</button>
                </div>
              </div>

              {/* 局部放大模式 */}
              <div className="border-t pt-3">
                <h3 className="font-bold text-sm mb-1">🔍 局部放大模式</h3>
                <div className="px-2 py-2 mb-2 rounded text-xs text-teal-800 leading-relaxed"
                  style={{ backgroundColor: 'rgba(78,205,196,0.08)', border: '1px solid rgba(78,205,196,0.25)' }}>
                  💡 選擇一個人物作為中心，自動調整視窗範圍，讓附近人物清楚顯示
                </div>
                <select value={zoomFocusPerson}
                  onChange={(e) => setZoomFocusPerson(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-xs mb-2">
                  <option value="">— 未啟用 —</option>
                  {displayData.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <button
                  onClick={() => {
                    if (!zoomFocusPerson) return;
                    const target = displayData.find(d => d.name === zoomFocusPerson);
                    if (!target || !svgRef.current || !chartContainerRef.current) return;
                    // 計算 target 的像素位置，置中顯示
                    const externals = displayData.map(d => d.external);
                    const internals = displayData.filter(d => !d.externalOnly).map(d => d.internal);
                    const legendRows = partiesInChart.length > 0 ? Math.ceil(partiesInChart.length / 8) : 0;
                    const legendHeight = legendRows > 0 ? 60 + legendRows * 20 : 60;
                    const margin = { top: legendHeight + 40, right: 120, bottom: 90, left: 130 };
                    const canvasDims = getCanvasDimensions();
                    const w = canvasDims.width - margin.left - margin.right;
                    const h = canvasDims.height - margin.top - margin.bottom;
                    const minX = 0, maxX = (Math.max(...externals) || 1) * 1.05;
                    const minY = 0, maxY = (Math.max(...(internals.length ? internals : [1])) || 1) * 1.05;
                    const px = margin.left + (w * (target.external - minX) / (maxX - minX));
                    const py = margin.top + (h * (1 - (target.internal - minY) / (maxY - minY)));
                    const focusZoom = 3;
                    const container = chartContainerRef.current;
                    const cx = container.clientWidth / 2;
                    const cy = container.clientHeight / 2;
                    setZoom(focusZoom);
                    setPan({ x: cx - px * focusZoom, y: cy - py * focusZoom });
                  }}
                  className="w-full px-2 py-1 bg-teal-600 text-white rounded text-xs hover:bg-teal-700">
                  {zoomFocusPerson ? `啟用局部放大：${zoomFocusPerson}` : '啟用局部放大'}
                </button>
              </div>

              {/* 顯示選項 */}
              <div className="border-t pt-3">
                <h3 className="font-bold text-sm mb-2">👁️ 顯示選項</h3>
                <div className="space-y-1">
                  {[
                    { key: 'quadrantBg', label: '象限背景色' },
                    { key: 'quadrantLabel', label: '象限標籤' },
                    { key: 'momentum', label: '移動軌跡（上週 → 本週）' },
                    { key: 'relationLines', label: '人物關係線' },
                    { key: 'trendMark', label: '趨勢標記' },
                    { key: 'nameLabel', label: '姓名標籤' },
                    { key: 'labelAntiOverlap', label: '標籤防重疊' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-50 text-xs">
                      <input type="checkbox" checked={displayOptions[key]} onChange={() => toggleDisplayOption(key)} className="accent-teal-600" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 設定 Tab ── */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-2">📐 畫布設定</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: '16:9', label: '16:9', size: '1920×1080' },
                    { key: 'square', label: '正方形', size: '1080×1080' },
                    { key: 'og', label: 'OG', size: '1200×630' }
                  ].map(option => (
                    <button key={option.key} onClick={() => setCanvasSize(option.key)}
                      className={`p-2 border rounded text-xs ${canvasSize === option.key ? 'border-teal-600 bg-teal-50' : ''}`}>
                      <div className="font-bold">{option.label}</div>
                      <div className="text-gray-500 text-xs">{option.size}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm mb-2">📝 標題</h3>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-xs mb-2" placeholder="主標題" />
                <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="副標題" className="w-full px-2 py-1 border rounded text-xs" />
              </div>

              {/* ── X / Y 軸範圍 ── */}
              <div>
                <h3 className="font-bold text-sm mb-2">📊 軸範圍設定</h3>
                <div className="space-y-2">
                  {/* 自動調整切換 */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => {
                        if (axisRange.autoAdjust) {
                          // 關閉自動調整時，把當前自動計算值填入欄位
                          const externals = displayData.map(d => d.external);
                          const internals = displayData.filter(d => !d.externalOnly).map(d => d.internal);
                          const autoMaxX = Math.round((Math.max(...(externals.length ? externals : [100000])) || 100000) * 1.05);
                          const autoMaxY = Math.round((Math.max(...(internals.length ? internals : [50000])) || 50000) * 1.05);
                          setAxisRange(prev => ({
                            ...prev,
                            autoAdjust: false,
                            xMin: prev.xMin !== '' ? prev.xMin : '0',
                            xMax: prev.xMax !== '' ? prev.xMax : String(autoMaxX),
                            yMin: prev.yMin !== '' ? prev.yMin : '0',
                            yMax: prev.yMax !== '' ? prev.yMax : String(autoMaxY),
                          }));
                        } else {
                          setAxisRange(prev => ({ ...prev, autoAdjust: true }));
                        }
                      }}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${axisRange.autoAdjust ? 'bg-teal-600' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${axisRange.autoAdjust ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-xs">自動縮放（依數據最大值縮放）</span>
                  </label>

                  {/* 手動輸入：autoAdjust 關閉時才啟用 */}
                  <div className={axisRange.autoAdjust ? 'opacity-40 pointer-events-none' : ''}>
                    <div className="text-xs font-medium text-gray-600 mb-1">X 軸（外部影響力）</div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs text-gray-500">最小值</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={axisRange.xMin}
                          onChange={(e) => setAxisRange(prev => ({ ...prev, xMin: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">最大值</label>
                        <input
                          type="number"
                          placeholder="100000"
                          value={axisRange.xMax}
                          onChange={(e) => setAxisRange(prev => ({ ...prev, xMax: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-xs mt-0.5"
                        />
                      </div>
                    </div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Y 軸（內部影響力）</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">最小值</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={axisRange.yMin}
                          onChange={(e) => setAxisRange(prev => ({ ...prev, yMin: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">最大值</label>
                        <input
                          type="number"
                          placeholder="50000"
                          value={axisRange.yMax}
                          onChange={(e) => setAxisRange(prev => ({ ...prev, yMax: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-xs mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm mb-2">⚙️ 泡泡設定</h3>
                <div className="space-y-2">
                  {[
                    { key: 'minRadius', label: '最小半徑', min: 3, max: 20 },
                    { key: 'maxRadius', label: '最大半徑', min: 20, max: 100 },
                    { key: 'fontSize', label: '標籤字體', min: 8, max: 16 }
                  ].map(({ key, label, min, max }) => (
                    <div key={key}>
                      <label className="text-xs">{label}: {bubbleSettings[key]}px</label>
                      <input type="range" min={min} max={max} value={bubbleSettings[key]}
                        onChange={(e) => setBubbleSettings({ ...bubbleSettings, [key]: parseInt(e.target.value) })}
                        className="w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 右側圖形區 ── */}
      <div className="flex-1 p-4 overflow-hidden bg-gray-100 flex flex-col relative">
        {/* 頂部工具列 */}
        <div className="mb-2 flex justify-between items-center flex-shrink-0">
          <div className="flex gap-4 text-sm">
            <span>總數: <span className="font-bold">{mergedData.length}</span></span>
            <span>全國性: <span className="font-bold text-teal-600">{mergedData.filter(d => d.national_affairs).length}</span></span>
            <span>顯示: <span className="font-bold text-blue-600">{displayData.length}</span></span>
          </div>
          <div className="flex gap-2">
            <button onClick={exportSVG} disabled={displayData.length === 0}
              className="px-3 py-1 bg-teal-600 text-white rounded text-sm disabled:bg-gray-300">下載 SVG</button>
            <button onClick={exportPNG} disabled={displayData.length === 0}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:bg-gray-300">下載 PNG</button>
          </div>
        </div>

        {/* 圖形容器（可縮放平移） */}
        <div ref={chartContainerRef} className="chart-container rounded-lg shadow-lg flex-1"
          style={{ touchAction: 'none', backgroundColor: '#f3f4f6' }}>
          <div className="chart-inner bg-white"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            <svg ref={svgRef} width={dims.width} height={dims.height} style={{ display: 'block' }}>
              <text x={dims.width / 2} y={35} fontSize="22" fontWeight="bold" textAnchor="middle" fill="#3B7D7D">
                {title}
              </text>
              {subtitle && (
                <text x={dims.width / 2} y={55} fontSize="14" textAnchor="middle" fill="#666">{subtitle}</text>
              )}
              {partiesInChart.length > 0 && (
                <g transform="translate(60, 68)">
                  {partiesInChart.map((party, idx) => {
                    const info = PARTY_COLORS[party] || PARTY_COLORS['無特定政黨屬性'];
                    const col = idx % 8;
                    const row = Math.floor(idx / 8);
                    return (
                      <g key={party} transform={`translate(${col * 120}, ${row * 20})`}>
                        <circle cx={7} cy={7} r={5} fill={info.color} />
                        <text x={17} y={11} fontSize="11" fill="#333">{party}</text>
                      </g>
                    );
                  })}
                </g>
              )}
              {renderChart()}
            </svg>
          </div>
        </div>

        {/* 右下角：縮放控制按鈕 */}
        <div className="absolute bottom-8 right-8 z-10 flex flex-col items-center gap-1">
          <button
            onClick={() => setZoom(prev => Math.min(prev * 1.2, 5))}
            className="w-9 h-9 flex items-center justify-center bg-white border border-gray-300 rounded-lg shadow-md text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all text-lg font-bold"
            title="放大">
            +
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.05))}
            className="w-9 h-9 flex items-center justify-center bg-white border border-gray-300 rounded-lg shadow-md text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all text-lg font-bold"
            title="縮小">
            −
          </button>
          {!isAtFit && (
            <button onClick={handleZoomReset}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-md text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all whitespace-nowrap"
              title="回到預設大小">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              回到預設大小
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
