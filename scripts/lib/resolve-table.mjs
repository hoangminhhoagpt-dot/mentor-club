/*
 * resolve-table.mjs — tìm table_id từ TÊN bảng, để người triển khai không phải đi copy table_id.
 *
 * Nhận "gợi ý" có thể là:
 *   - table_id sẵn ("tblXXXX")  → trả về luôn
 *   - tiền tố tên bảng ("16.1") → tra trong Base rồi trả table_id
 * Khớp bỏ qua dấu cách thừa và hoa/thường, nên "16.1  Lấy dữ liệu kênh" vẫn khớp "16.1".
 */
export async function resolveTable({ domain, appId, appSecret, base, hint, label = 'bảng' }) {
  if (!hint) throw new Error(`Thiếu gợi ý ${label} (table_id hoặc tên như "16.1")`);
  if (/^tbl\w+$/.test(hint)) return hint;

  const d = String(domain || 'https://open.larksuite.com').replace(/\/+$/, '');
  const tr = await fetch(d + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tj = await tr.json();
  if (tj.code !== 0) throw new Error('Lark token: ' + JSON.stringify(tj));

  const r = await fetch(`${d}/open-apis/bitable/v1/apps/${base}/tables?page_size=100`, {
    headers: { Authorization: 'Bearer ' + tj.tenant_access_token },
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error('Đọc danh sách bảng lỗi: ' + JSON.stringify(j));

  const tables = j.data.items || [];
  const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  const h = norm(hint);
  const hit =
    tables.find(t => norm(t.name) === h) ||
    tables.find(t => norm(t.name).startsWith(h)) ||
    tables.find(t => norm(t.name).includes(h));

  if (!hit) {
    throw new Error(
      `Không thấy ${label} khớp "${hint}" trong base ${base}.\n` +
      `   Bảng đang có: ${tables.map(t => t.name).join(' | ') || '(trống)'}\n` +
      `   → Chạy action "init-tables" để tạo bộ bảng mẫu.`
    );
  }
  return hit.table_id;
}
