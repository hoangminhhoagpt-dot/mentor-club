#!/usr/bin/env bash
# =============================================================================
#  KHỞI TẠO TOÀN BỘ MODULE YOUTUBE ⇄ LARK BASE
#
#  Cách dùng:  điền các giá trị bên dưới → chạy:  bash khoi-tao.sh
#  Cần: Node 18 trở lên. Không cần npm install.
# =============================================================================

# ---------- BẮT BUỘC ----------
export LARK_APP_ID="cli_xxxxxxxxxxxx"
export LARK_APP_SECRET="xxxxxxxxxxxxxxxx"
export LARK_BASE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"
export YOUTUBE_API_KEY="AIzaSyxxxxxxxxxxxx"
export YT_CHANNEL="@tenkenhcuaban"          # @handle hoặc UCxxxxxxxx

# ---------- CHỈ CẦN NẾU MUỐN ĐĂNG VIDEO LÊN YOUTUBE ----------
# Bỏ trống 3 dòng này thì vẫn chạy được phần LẤY DỮ LIỆU (16.1 / 16.2).
export YT_OAUTH_CLIENT_ID=""
export YT_OAUTH_CLIENT_SECRET=""
export YT_OAUTH_REFRESH_TOKEN=""

# ---------- TUỲ CHỌN ----------
export LARK_DOMAIN="https://open.larksuite.com"   # Trung Quốc: https://open.feishu.cn
VIDEO_LIMIT_INIT=50                                # số video lấy lần đầu (0 = lấy hết kênh)

set -e
cd "$(dirname "$0")"

for v in LARK_APP_ID LARK_APP_SECRET LARK_BASE_ID YOUTUBE_API_KEY YT_CHANNEL; do
  case "${!v}" in *xxx*|"") echo "✖ Chưa điền $v ở đầu file khoi-tao.sh"; exit 1;; esac
done

step() { echo; echo "════ $1 ════"; }

step "1/3  Tạo 3 bảng mẫu 16.1 / 16.2 / 16.3 vào Base"
node scripts/init-tables.mjs

step "2/3  Lấy dữ liệu kênh + video  →  bảng 16.1 và 16.2"
node .claude/skills/hmh-AIOS-sync-youtube-lark/scripts/sync-youtube-lark.mjs --limit "$VIDEO_LIMIT_INIT"

step "3/3  Kiểm tra bảng đăng video (16.3) — chạy thử, KHÔNG đăng thật"
node .claude/skills/hmh-AIOS-dang-video-youtube/scripts/post-video-youtube.mjs --dry-run

cat <<EOF

═══════════════════════════════════════════════════════
XONG. Mở Lark Base kiểm tra 3 bảng 16.1 → 16.3.

Chạy lại file này bao nhiêu lần cũng được: bảng đã có thì
không tạo lại, video đã có thì cập nhật số liệu, không tạo trùng.

Còn 1 việc làm tay: dựng automation "Đăng video" trong Lark Base
→ xem LARK-AUTOMATION.md
═══════════════════════════════════════════════════════
EOF
