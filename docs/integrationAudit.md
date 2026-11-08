# Kiểm kê tích hợp ToonFlow-App độc lập — đợt 1

**Ngày:** 2026-11-08 · **Người kiểm kê/viết thay đổi:** ChatGPT (GPT-6).
**Tình trạng:** kiểm kê mã và thực hiện sửa trên nhánh tích hợp; **chưa nghiệm thu toàn bộ 1.454 mục mã nguồn và tài nguyên**. Cây nguồn quan sát có khoảng 185 Vue SFC, 625 TypeScript, 267 tệp/đường dẫn API route; con số không chứng minh đã đọc hết nội dung các tệp.

## Mốc an toàn, không thay đổi nhánh cũ

| Nhánh | SHA mốc | Bảo toàn |
|---|---|---|
| `main` | `ddd0667c933f7ebb2c0c6a74cd8956e584c169b2` | `backup/toonFlowMain20261108` |
| `feat/chromeBridgeMuseGeminiChatgpt` | `99320616cfbf7991a4a25a75a82418bb2135fc20` | `backup/toonFlowChromeBridge20261108` |
| `feat/vietnameseApprovedPromptsV1` | `8f6395ee1271f0bc36c104cadcda05b3a6db8703` | `backup/toonFlowVietnamese20261108` |
| `feat/remoteChromeBridgeRender` | `a08cff1a0be2c89e443e782851f49faa25811fbb` | `backup/toonFlowRemoteRender20261108` |

Nguồn hợp nhất: Remote chứa Local Chrome Bridge/Render, sau đó lấy các file VI theo SHA và hợp nhất `packages/nodes/textNode/src/index.vue` theo ngữ cảnh; ghi lại 3 sổ VI cũ trong `docs/aiNotes/historyVietnameseV1/`. Không force-push, xóa lịch sử hoặc merge `main`.

## Chức năng phải giữ

Canvas Vue Flow, node Text/Image/Video/Audio/3D/Frame Analysis, workspace read/write và asset history, media tasks, prompt người dùng, plugin/tool scaffold, FFmpeg, dự án local, các provider khác, các locale không phải Việt, Electrobun Desktop hỗ trợ OS, dịch vụ Render và Chrome Companion. Tránh sửa schema/ID kết nối.

## Phân loại phụ thuộc và hướng xử lý

| Phụ thuộc / nguồn | Loại | Phát hiện và xử lý | Tồn đọng |
|---|---|---|---|
| Home banner và sidebar banner, `homeAdvertisementCarousel` | A | Bỏ mount và khởi tạo tải quảng cáo, chỉnh grid | Component source chưa xóa; phải audit mọi caller khác |
| `/api/channel/community/getAdvertisements` | A | Trả dữ liệu rỗng cục bộ, không gọi upstream | Cần đối chiếu auto-generated router khi chạy Bun |
| Home Explore mặc định tải thương mại | A/C | Bỏ mount khỏi Home, giữ mã để không làm mất tính năng chưa kiểm tra | Chưa thay Explore bằng thư viện độc lập |
| Tài khoản upstream/channels gọi `api.toonflow.net` | C | `channelRequest` chặn mặc định, chỉ có opt-in `TOONFLOW_LEGACY_CHANNEL=1` | Cần audit mọi nguồn fetch khác ngoài channelRequest |
| `@toonflow/*`, Vue, Bun, FFmpeg, Canvas, 3D | D | Giữ nguyên namespace và chức năng gốc | Kiểm thử hồi quy còn thiếu |
| Local Chrome Bridge và Remote Relay | B | Dùng nhánh PR #1/#3, manager định tuyến cùng node/media hiện có | Chưa test thật WSS/HTTPS/tab/multi device |
| Render Web Service | B/C | `render.yaml` + Docker + BYO Render secrets | Chưa deploy; Free SQLite không bền vững |
| User-managed Muse/Gemini/ChatGPT tabs | C | Extension ghép nối, không dùng API key hoặc cookie | Website DOM/capability chưa kiểm thử |
| Source, issues, README, releases/update fallback | B | Đổi các điểm nhận diện GitHub fork, giữ tác giả MIT | Release CI/DMG/updater thật chưa nghiệm thu |
| `.github_temp/workflows` | B | Không di chuyển mù quáng; thêm workflow kiểm tra mới dưới `.github/workflows` | CI thực tế và release workflows cũ chưa kiểm chứng |
| Electrobun runtime Desktop macOS 14+ | D | Không giả lập Ventura Desktop; hỗ trợ Web cục bộ cho Ventura | Crash C++ trên máy Ventura do người dùng báo, chưa tái hiện tại đây |
| UI/Node Việt hóa | A | Hợp nhất 127 ID V1 và 10 tên node/menu đã duyệt; nối Home/Settings với `vi.json` | Chuỗi còn thiếu ghi hàng chờ duyệt, chưa scan hết |
| Marketplace và thanh toán upstream | C | Không mount marketplace trong Settings cục bộ, chặn `channelRequest` | Backend/module vẫn tồn tại dạng legacy opt-in |

**Bảo mật:** Web Bridge chỉ khi macOS cục bộ và server bind `127.0.0.1`; API kiểm nguồn từ loopback, Origin/Referer và tín hiệu proxy Vite. Web công khai/LAN không được điều khiển Chrome. Toàn bộ claim bảo mật cần kiểm thử xâm nhập trước phát hành.

## Bảng thử nghiệm toàn ứng dụng

| Trường hợp | Trạng thái | Bằng chứng |
|---|---|---|
| GitHub chứa mã tổng hợp và bản sao nhánh | PASS (mã/refs) | SHA và URL GitHub |
| So sánh code/nhãn VI và xung đột Text Node | PASS (đối chiếu tĩnh) | Diff theo ID và mã |
| Web Ventura 13 Intel mở Home, không đăng nhập | NOT TESTED | Chưa chạy trên Mac |
| Banner không mount, route không gọi upstream | PASS (phân tích mã) | UI Home và route |
| Canvas/Node/3D/audio/video hoạt động hồi quy | NOT TESTED | Chưa chạy GUI |
| Typecheck Bun và build Web/Server/Nodes/MCP | NOT TESTED | Chờ GitHub Actions |
| Render `/healthz` và WSS hai phía | NOT TESTED | Chưa có URL dịch vụ thật |
| HTTPS fallback khi WSS bị chặn | NOT TESTED | Chưa có Chrome VM |
| Chrome 2 thiết bị, tab đúng, tránh tác vụ trùng | NOT TESTED | Chưa có tài khoản/tab thực |
| Muse/Gemini/ChatGPT trả kết quả thật | NOT TESTED | Chưa đăng nhập AI thật |
| Media history, lưu/mở project | NOT TESTED | Chưa có bài test runtime |
| Provider không dùng Bridge | NOT TESTED | Chưa chạy hồi quy |
| Toàn bộ locale VI/ZH/EN, light/dark | NOT TESTED | Chưa mở app |
| Mac DMG/Release, Ventura Desktop | BLOCKED | Cần macOS runtime/CI, chưa có DMG được kiểm chứng |
| Điều kiện sử dụng dịch vụ và kiểm toán security | NOT TESTED | Chưa phát hành |

**Không có kết quả giả lập nào được dùng để khẳng định chức năng AI thật đã chạy.** Cần scan sâu tất cả modules và kiểm thử từng dòng theo checklist trước khi đổi trạng thái PR Draft.

## Còn phải kiểm kê thêm

- Các nguồn upstream khác ngoài `channelRequest` (update server, provider adapters, pluginMarket, mạng/telemetry nếu có).
- Luồng đăng nhập hoặc auth ở nhiều chế độ public Web/multi-tenant (không được xóa hệ thống bảo mật).
- Tất cả chuỗi Trung trong Vue, plugin, tools, skills workflow, prompt hệ thống; nguồn Việt hóa V1 không phải toàn bộ.
- Mọi button/action nhấp, drag-drop, canvas export/import, phát/preview/tải media, lịch sử phiên.
- CI release, signing, macOS Intel 14+ và macOS 13 Web thực tế.

## Giấy phép/ghi công

Giữ `LICENSE` MIT của HBAI-Ltd, trường `author` gốc và code `@toonflow/*` hợp pháp. Không sao chép nguyên source GPL-2.0-or-later của repository `workflow`, chỉ dùng giao thức/kiến trúc độc lập. Tên tạm `ToonFlow-App` không chứng minh quyền thương hiệu hay chuyển quyền tác giả; trước phát hành phải rà soát logo, badge, nhạc/ảnh/tài sản nội dung từ upstream.
