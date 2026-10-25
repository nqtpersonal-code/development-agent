# nqt — đội agent làm ticket bằng ngôn ngữ tự nhiên

Plugin cho Claude Code. Bạn mô tả bằng lời, đội agent lo phần kỹ thuật:
đọc ticket, lần theo code và DB thật, hỏi bạn khi chưa rõ, thiết kế màn hình,
viết kịch bản test, code (qua superpowers), review, kiểm thử và báo cáo. Không bao giờ tự push.

## Cần có

- Claude Code, Node.js 20+ (khuyên 24), Git.
- Plugin **superpowers** đã cài.
- Docker (không bắt buộc, chỉ cần khi DB local chạy bằng Docker).
- `gh` / `glab` (không bắt buộc; không có thì dán nội dung ticket vào).

## Cài đặt (chỉ cài ở cấp người dùng)

**Cách 1 — từ thư mục trên máy (hoặc từ file zip đã giải nén):**

```
claude plugin marketplace add "<đường-dẫn-tới-thư-mục-plugin>"
claude plugin install nqt@nqt-local --scope user
```

**Cách 2 — từ repo GitHub private:** máy cần đăng nhập GitHub (`gh auth login` hoặc SSH key), rồi

```
claude plugin marketplace add <tài-khoản>/<repo>
claude plugin install nqt@nqt-local --scope user
```

Không cài ở cấp dự án (`--scope project`): cách đó ghi vào `.claude/settings.json` trong repo của team.

**Sau khi cài, chạy một lần** để cài thư viện phụ trợ (pg, mysql2, Playwright + Chromium) vào thư mục dữ liệu:

```
node "<thư-mục-plugin-đã-cài>/scripts/nqt.mjs" doctor --install
```

(Thư mục plugin đã cài thường là `~/.claude/plugins/cache/nqt-local/nqt/<phiên-bản>/`.)

## Dùng

Mở Claude Code **trong folder project của ticket**, rồi:

| Lệnh | Việc |
|---|---|
| `/nqt:work-ticket <dự-án> <số-ticket>` | làm trọn một ticket |
| `/nqt:ask-system <dự-án>` | hỏi đáp về hệ thống hiện tại |
| `/nqt:retro <dự-án> <số-ticket>` | rút kinh nghiệm sau một ticket (nên mở phiên mới) |
| `/nqt:add-pattern <thư-mục>` | thêm một bộ mẫu best practice vào thư viện |

Lần đầu với một dự án, đội agent sẽ tự dò và hỏi bạn vài câu để tạo hồ sơ dự án
và "bộ chuyển đổi truy vết" (kèm bài kiểm tra) — các lần sau dùng lại.

## Dữ liệu của bạn ở đâu

Tất cả nằm ngoài plugin và ngoài repo dự án, ở `~/.claude/nqt/`:

- `config.md` — ngôn ngữ (`vi`/`en`), thư mục quy tắc review cá nhân, biệt danh cho agent và bước.
- `review-rules/` — quy tắc review cá nhân (mọi file `.md`).
- `patterns/` — thư viện mẫu dùng chung (có sẵn 2 bộ khởi đầu).
- `projects/<dự-án>/` — `project.md`, `ui.md`, `pitfalls.md`, `review-rules/` (quy tắc của team), `patterns/`, `tracer/`.
- `work/<dự-án>/<ticket>/` — mọi kết quả khi làm ticket (hồ sơ ticket, kịch bản test, báo cáo, ảnh chụp…).

Cập nhật hay cài lại plugin không làm mất dữ liệu này.

## Cho người sửa plugin

```
npm test                    # chạy test (cần Docker cho 2 dự án mẫu: tests/fixtures/school-a, school-b-api)
node tools/export-zip.mjs   # tạo dist/nqt-plugin-<phiên-bản>.zip (chặn nếu phát hiện dữ liệu dự án)
git config core.hooksPath .githooks   # bật chốt quét bảo mật trước mỗi commit
```

Repo này không bao giờ được chứa dữ liệu dự án thật (tên dự án, số ticket, URL nội bộ, code, mật khẩu…).
