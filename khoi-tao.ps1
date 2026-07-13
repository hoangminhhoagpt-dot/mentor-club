# =============================================================================
#  KHỞI TẠO TOÀN BỘ MODULE YOUTUBE <-> LARK BASE   (Windows / PowerShell)
#
#  Cách dùng:  điền các giá trị bên dưới → mở PowerShell tại thư mục này → gõ:
#                .\khoi-tao.ps1
#  Cần: Node 18 trở lên. Không cần npm install.
# =============================================================================

# ---------- BẮT BUỘC ----------
$env:LARK_APP_ID     = "cli_xxxxxxxxxxxx"
$env:LARK_APP_SECRET = "xxxxxxxxxxxxxxxx"
$env:LARK_BASE_ID    = "xxxxxxxxxxxxxxxxxxxxxxxxxx"
$env:YOUTUBE_API_KEY = "AIzaSyxxxxxxxxxxxx"
$env:YT_CHANNEL      = "@tenkenhcuaban"          # @handle hoặc UCxxxxxxxx

# ---------- CHỈ CẦN NẾU MUỐN ĐĂNG VIDEO LÊN YOUTUBE ----------
# Bỏ trống 3 dòng này thì vẫn chạy được phần LẤY DỮ LIỆU (16.1 / 16.2).
$env:YT_OAUTH_CLIENT_ID     = ""
$env:YT_OAUTH_CLIENT_SECRET = ""
$env:YT_OAUTH_REFRESH_TOKEN = ""

# ---------- TUỲ CHỌN ----------
$env:LARK_DOMAIN = "https://open.larksuite.com"   # Trung Quốc: https://open.feishu.cn
$VideoLimitInit  = "50"                            # số video lấy lần đầu (0 = lấy hết kênh)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

foreach ($v in "LARK_APP_ID","LARK_APP_SECRET","LARK_BASE_ID","YOUTUBE_API_KEY","YT_CHANNEL") {
  $val = [Environment]::GetEnvironmentVariable($v)
  if (-not $val -or $val -like "*xxx*") {
    Write-Host "✖ Chưa điền $v ở đầu file khoi-tao.ps1" -ForegroundColor Red
    exit 1
  }
}

function Step($t) { Write-Host ""; Write-Host "════ $t ════" -ForegroundColor Cyan }
function Run($file, $rest) {
  node $file @rest
  if ($LASTEXITCODE -ne 0) { Write-Host "✖ Lỗi ở $file — đọc thông báo phía trên." -ForegroundColor Red; exit 1 }
}

Step "1/3  Tạo 3 bảng mẫu 16.1 / 16.2 / 16.3 vào Base"
Run "scripts/init-tables.mjs" @()

Step "2/3  Lấy dữ liệu kênh + video  ->  bảng 16.1 và 16.2"
Run ".claude/skills/hmh-AIOS-sync-youtube-lark/scripts/sync-youtube-lark.mjs" @("--limit", $VideoLimitInit)

Step "3/3  Kiểm tra bảng đăng video (16.3) — chạy thử, KHÔNG đăng thật"
Run ".claude/skills/hmh-AIOS-dang-video-youtube/scripts/post-video-youtube.mjs" @("--dry-run")

Write-Host @"

═══════════════════════════════════════════════════════
XONG. Mở Lark Base kiểm tra 3 bảng 16.1 -> 16.3.

Chạy lại file này bao nhiêu lần cũng được: bảng đã có thì
không tạo lại, video đã có thì cập nhật số liệu, không tạo trùng.

Còn 1 việc làm tay: dựng automation "Đăng video" trong Lark Base
-> xem LARK-AUTOMATION.md
═══════════════════════════════════════════════════════
"@ -ForegroundColor Green
