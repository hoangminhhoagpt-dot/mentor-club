#!/usr/bin/env node
/*
 * init-tables.mjs — Tạo bộ 3 bảng mẫu module YouTube (16.1 / 16.2 / 16.3) vào Lark Base chỉ định.
 *
 *   node scripts/init-tables.mjs            tạo bảng còn thiếu + thêm cột còn thiếu vào bảng đã có
 *   node scripts/init-tables.mjs --dry-run  chỉ in ra sẽ làm gì, không đụng vào Base
 *
 * Chạy lại bao nhiêu lần cũng an toàn:
 *   - Bảng đã có (khớp tiền tố "16.1"…) → KHÔNG tạo lại, chỉ bổ sung cột còn THIẾU TÊN.
 *   - Cột đã tồn tại → giữ nguyên, không bao giờ đổi kiểu (không phá bảng khách đang dùng).
 *
 * Biến môi trường: LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_ID (bắt buộc), LARK_DOMAIN (tuỳ chọn).
 */
const DOMAIN = (process.env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/+$/, '');
const APP_ID = process.env.LARK_APP_ID || '';
const APP_SECRET = process.env.LARK_APP_SECRET || '';
const BASE = process.env.LARK_BASE_ID || '';
const DRY = process.argv.includes('--dry-run');

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const die = m => { console.error('\n✖ ' + m + '\n'); process.exit(1); };

if (!APP_ID || !APP_SECRET) die('Thiếu LARK_APP_ID / LARK_APP_SECRET');
if (!BASE) die('Thiếu LARK_BASE_ID (Settings → Secrets and variables → Actions → Variables)');

const T = { TEXT: 1, NUM: 2, SELECT: 3, MULTI: 4, DATE: 5, URL: 15, FILE: 17, FORMULA: 20 };
const num = () => ({ type: T.NUM, property: { formatter: '1,000' } });
// Lark chỉ nhận vài chuỗi định dạng ngày cố định — 'dd/MM/yyyy HH:mm' là KHÔNG hợp lệ.
const date = (f = 'yyyy/MM/dd') => ({ type: T.DATE, property: { date_formatter: f, auto_fill: false } });
const select = (...names) => ({ type: T.SELECT, property: { options: names.map(name => ({ name })) } });
const multi = (...names) => ({ type: T.MULTI, property: { options: names.map(name => ({ name })) } });
const formula = expr => ({ type: T.FORMULA, property: { formula_expression: expr } });

/*
 * ⚠ Cột ĐẦU TIÊN thành primary field, mà primary KHÔNG nhận URL/Attachment/Select —
 * chỉ Text/Number/Date. Nên mỗi bảng dưới đây đều mở đầu bằng một cột Text.
 */
const SPECS = [
  {
    key: '16.1',
    name: '16.1 Lấy dữ liệu kênh',
    fields: {
      'channel id': { type: T.TEXT },                 // primary — khoá upsert, bền hơn dò theo link
      'channel': { type: T.URL },
      'channel title': { type: T.TEXT },
      'channel description': { type: T.TEXT },
      'thumbnails': { type: T.FILE },
      'channel videoCount': num(),
      'channel viewCount': num(),
      'channel subscriberCount': num(),
      'country': select('VN'),
      'channel create time': date(),
    },
  },
  {
    key: '16.2',
    name: '16.2 Lấy dữ liệu video',
    fields: {
      'video id': { type: T.TEXT },                   // primary — khoá upsert
      'video': { type: T.URL },
      'video description': { type: T.TEXT },
      'video tag': multi(),
      'publish time': date(),
      'thumbnails': { type: T.FILE },
      'viewCount': num(),
      'likeCount': num(),
      'favoriteCount': num(),
      'commentCount': num(),
      'channel': { type: T.URL },
    },
  },
  {
    key: '16.3',
    name: '16.3 Đăng video YouTube',
    fields: {
      'Tiêu đề': { type: T.TEXT },                    // primary
      'STT': { type: T.TEXT },
      'Video': { type: T.FILE },
      'Mô tả': { type: T.TEXT },
      'Tags': { type: T.TEXT },                       // phân tách bằng dấu phẩy
      'Loại': select('Video dài', 'Shorts'),
      'Chế độ': select('private', 'unlisted', 'public'),
      'Lịch đăng': date('yyyy/MM/dd HH:mm'),
      // Cò kích hoạt automation cho người KHÔNG tự tạo nút bấm (API không tạo được field Button).
      'Đăng': select('Đăng ngay'),
      'Trạng thái': select('Chờ đăng', 'Đang đăng', 'Đã đăng', 'Lỗi'),
      'Video ID': { type: T.TEXT },
      'Link video': { type: T.URL },
      'Ngày đăng': date('yyyy/MM/dd HH:mm'),
      'Ghi chú lỗi': { type: T.TEXT },
      'Log': { type: T.TEXT },
      // Automation của Lark cần gửi record_id sang GitHub — có sẵn cột này thì luôn chọn được biến.
      'Record ID': formula('RECORD_ID()'),
    },
  },
];

async function api(url, opt = {}, tk) {
  const r = await fetch(DOMAIN + url, {
    ...opt,
    headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json; charset=utf-8', ...(opt.headers || {}) },
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`${url} → ${j.code}: ${j.msg || JSON.stringify(j)}`);
  return j.data;
}

const tk = await (async () => {
  const r = await fetch(DOMAIN + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const j = await r.json();
  if (j.code !== 0) die('Lấy Lark token lỗi: ' + JSON.stringify(j));
  return j.tenant_access_token;
})();

const existing = (await api(`/open-apis/bitable/v1/apps/${BASE}/tables?page_size=100`, {}, tk)).items || [];
log(`Base ${BASE} đang có ${existing.length} bảng: ${existing.map(t => t.name).join(' | ') || '(trống)'}`);

const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
const resolved = {};

for (const spec of SPECS) {
  const hit = existing.find(t => norm(t.name).startsWith(norm(spec.key)));

  if (!hit) {
    // Công thức phải thêm SAU (tham chiếu cột vừa tạo), nên tách ra khỏi lệnh tạo bảng.
    const simple = [], deferred = [];
    for (const [name, f] of Object.entries(spec.fields)) (f.type === T.FORMULA ? deferred : simple).push([name, f]);
    if (DRY) { log(`[DRY] TẠO bảng "${spec.name}" (${Object.keys(spec.fields).length} cột)`); continue; }
    const d = await api(`/open-apis/bitable/v1/apps/${BASE}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        table: {
          name: spec.name,
          default_view_name: 'Bảng',
          fields: simple.map(([field_name, f]) => ({ field_name, type: f.type, ...(f.property ? { property: f.property } : {}) })),
        },
      }),
    }, tk);
    resolved[spec.key] = d.table_id;
    log(`✔ TẠO bảng "${spec.name}" → ${d.table_id} (${simple.length} cột)`);
    for (const [name, f] of deferred) await addField(d.table_id, name, f);
    continue;
  }

  resolved[spec.key] = hit.table_id;
  const fields = (await api(`/open-apis/bitable/v1/apps/${BASE}/tables/${hit.table_id}/fields?page_size=200`, {}, tk)).items || [];
  const have = new Set(fields.map(f => f.field_name));
  const missing = Object.entries(spec.fields).filter(([name]) => !have.has(name));
  if (!missing.length) { log(`= Bảng "${hit.name}" đã đủ cột — giữ nguyên.`); continue; }
  log(`~ Bảng "${hit.name}" thiếu ${missing.length} cột: ${missing.map(([n]) => n).join(', ')}`);
  if (DRY) continue;
  for (const [name, f] of missing) await addField(hit.table_id, name, f);
}

log('\nXONG. Bảng của module YouTube:');
for (const s of SPECS) log(`  ${s.key} → ${resolved[s.key] || '(chưa tạo)'}  ${s.name}`);
log('\nCác engine tự tìm bảng theo TÊN, nên không cần copy table_id đi đâu cả.');

async function addField(tableId, name, f) {
  try {
    await api(`/open-apis/bitable/v1/apps/${BASE}/tables/${tableId}/fields`, {
      method: 'POST',
      body: JSON.stringify({ field_name: name, type: f.type, ...(f.property ? { property: f.property } : {}) }),
    }, tk);
    log(`  + cột "${name}"`);
  } catch (e) {
    log(`  ! không thêm được cột "${name}": ${String(e.message || e).slice(0, 120)}`);
  }
}
