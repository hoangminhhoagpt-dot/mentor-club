# Chi tiết 3 action

Mọi action gọi chung **một URL**, chỉ khác `event_type`:

```
POST https://api.github.com/repos/<OWNER>/<REPO>/dispatches

Headers:
  Authorization: Bearer <GITHUB_PAT>
  Accept:        application/vnd.github+json
  Content-Type:  application/json

Body:
  {"event_type":"<TÊN ACTION>","client_payload":{ ... }}
```

GitHub trả **204 No Content** = đã nhận lệnh. Kết quả xem ở tab **Actions**.
Không truyền `client_payload` thì dùng cấu hình trong Variables — **đa số cứ để `{}` là đúng**.

| Tham số dùng chung | Ý nghĩa |
|---|---|
| `base_id` | Ghi đè `LARK_BASE_ID` — bắn vào Base khác mà không sửa Variables |
| `domain` | Ghi đè `LARK_DOMAIN` |

---

## 0. `init-tables` — tạo 3 bảng mẫu

Tạo bảng 16.1 → 16.3 trong Base, **đủ cột**. Chạy đầu tiên, một lần.

```json
{"event_type":"init-tables","client_payload":{}}
```

Chạy lại nhiều lần vẫn an toàn:
- Bảng **đã có** → không tạo lại, chỉ **bổ sung cột còn thiếu**.
- Cột đã có → **giữ nguyên, không đổi kiểu**. Khách lỡ sửa bảng thì chạy lại là "vá", không phá.

Xem trước mà chưa tạo thật: `{"mode":"--dry-run"}`.

> Cột đầu tiên của mỗi bảng là **primary field**, mà primary **không nhận** URL / Attachment / Select. Nên bảng mẫu mở đầu bằng cột chữ: `channel id` (16.1), `video id` (16.2), `Tiêu đề` (16.3).

---

## 1. `sync-youtube` — lấy kênh + video → bảng 16.1 & 16.2

```json
{"event_type":"sync-youtube","client_payload":{"channel":"@tenkenh"}}
```

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `channel` | `YT_CHANNEL` | `@handle` hoặc `UCxxxx`. Truyền vào đây = đồng bộ kênh khác mà không sửa Variables → **1 repo phục vụ nhiều kênh** |
| `table_channel` / `table_video` | tự tìm `16.1` / `16.2` | chỉ cần khi bạn đổi tên bảng |

**Ghi vào 16.1:** channel id, link kênh, tiêu đề, mô tả, ảnh đại diện (tải thật lên Lark), số video, lượt xem, subscriber, quốc gia, ngày tạo kênh.

**Ghi vào 16.2:** video id, link, mô tả, tag, thời gian đăng, thumbnail (tải thật lên Lark), viewCount, likeCount, favoriteCount, commentCount, link kênh.

**Chống trùng, mặc định upsert:** kênh khớp theo link, video khớp theo `video id`. Video đã có → **cập nhật lại số liệu** (view/like/comment thay đổi liên tục); chưa có → **tạo dòng mới**. Hẹn lịch chạy hằng ngày là bảng luôn đúng số.

> Đồng bộ ra **kênh 0 sub / 0 video** = `YT_CHANNEL` sai handle. YouTube có nhiều kênh trùng tên; gõ thiếu một chữ là ra kênh khác. Copy y nguyên `@...` từ thanh địa chỉ.

---

## 2. `dang-video-youtube` — đăng video từ bảng 16.3

Đây là action gắn với **nút bấm trong Lark Base**.

```json
{"event_type":"dang-video-youtube","client_payload":{"record_id":"recXXXXXXXX"}}
```

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `record_id` | — | Đăng **đúng dòng đó ngay**. Đây là cách Lark bấm nút đăng 1 video. |
| `table_post` | tự tìm `16.3` | chỉ cần khi đổi tên bảng |

Bỏ trống `record_id` → quét cả bảng, đăng mọi dòng **`Trạng thái = Chờ đăng`**.

**Các cột của 16.3:**

| Cột | Việc |
|---|---|
| `Tiêu đề` | tiêu đề video trên YouTube |
| `Video` | file MP4 (đính kèm) |
| `Mô tả` | mô tả |
| `Tags` | các tag, **phân tách bằng dấu phẩy** |
| `Loại` | `Video dài` / `Shorts` |
| `Chế độ` | `private` / `unlisted` / `public` |
| `Lịch đăng` | hẹn giờ công khai |
| `Trạng thái` | `Chờ đăng` → `Đang đăng` → `Đã đăng` (hoặc `Lỗi`) |
| `Video ID`, `Link video`, `Ngày đăng` | hệ thống tự ghi sau khi đăng xong |
| `Ghi chú lỗi`, `Log` | lý do hỏng, đọc ở đây khi `Trạng thái = Lỗi` |
| `Record ID` | công thức `RECORD_ID()` — để Lark automation gửi `record_id` sang GitHub |

Upload dùng **resumable** (video nặng vẫn lên được). Đăng xong ghi ngược `Video ID` + `Link video` + `Trạng thái`.

> **Quota:** mỗi video tốn ~1.600 đơn vị / 10.000 mỗi ngày → **khoảng 6 video/ngày**. Đăng cái thứ 7 sẽ lỗi `quotaExceeded` — không phải code hỏng.

---

## Chạy trên máy (không qua GitHub)

```bash
export LARK_APP_ID=cli_xxx
export LARK_APP_SECRET=xxx
export LARK_BASE_ID=xxx
export YOUTUBE_API_KEY=AIzaSyxxx
export YT_CHANNEL=@tenkenhcuaban

node scripts/init-tables.mjs
node .claude/skills/hmh-AIOS-sync-youtube-lark/scripts/sync-youtube-lark.mjs --limit 50
node .claude/skills/hmh-AIOS-dang-video-youtube/scripts/post-video-youtube.mjs --dry-run
```

Hoặc gọn hơn: điền giá trị vào **`khoi-tao.ps1`** (Windows) / **`khoi-tao.sh`** rồi chạy — nó làm cả 3 bước trên.

Không cần `npm install` — bộ này **không dùng thư viện ngoài nào**, chỉ cần Node 18+.
