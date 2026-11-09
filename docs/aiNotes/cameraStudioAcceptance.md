# Camera Studio và Chrome Aspect Ratio — biên bản nghiệm thu bắt buộc

**2026-11-08. Người viết:** ChatGPT (GPT-6). **Không ghi PASS dựa trên mock.** Bài kiểm thử GUI, AI và Render dưới đây chưa được chạy trong môi trường lập trình này.

## Điều kiện ban đầu

- Nhánh `feat/independentToonFlowFullIntegration` của `mktminhqpbga-glitch/ToonFlow-App`. PR #4 Draft, không merge.
- Máy thử **Mac Intel Ventura 13** và trình duyệt Chrome thật, ảnh/video chưa bị giới hạn tài khoản. Backend local `127.0.0.1`, Chrome Companion đã cài, Render Relay URL và owner key đúng do người dùng quản lý.
- Bài thử không dùng tài khoản AI không được phép; không vượt CAPTCHA, hạn mức, đăng nhập.
- CI Linux có typecheck và build, nhưng không tự tạo một sản phẩm ảnh/video AI.

## Cách khởi động Web Ventura

```bash
git clone https://github.com/mktminhqpbga-glitch/ToonFlow-App.git
cd ToonFlow-App
git switch feat/independentToonFlowFullIntegration
bun install --frozen-lockfile
bun run build:tools
bun run build:ext
bun run build:nodes
bun run build:mcp
bun run dev:server:local
```

Mở Terminal thứ hai trong cùng thư mục: `bun run dev:web:local`. Dùng địa chỉ Vite hiển thị (thường `http://127.0.0.1:5173`). Trong Settings → AI Bridge · Chrome, ghép thiết bị thật qua Render/Extension, chọn đúng tab/cuộc trò chuyện đã đăng nhập. URL tab đang chọn sẽ bị khóa tại lượt gửi, nếu đổi URL phải chọn lại. Không lưu token/owner key vào biên bản công khai.

## Bảng bài thử

| ID | Thao tác và điều kiện đạt | Kết quả hiện tại |
|---|---|---|
| CAM-01 | Image Node bật Studio, chọn camera/lens/35mm/f2.8; lựa chọn xuất hiện trong node, không mất model/ratio/size | NOT TESTED (GUI) |
| CAM-02 | Tắt Studio: dữ liệu prompt người dùng không đổi, prompt gửi không chứa dòng camera | NOT TESTED (GUI/AI) |
| CAM-03 | Đổi 35→85mm, f2.8→f8; prompt gửi khác, nguồn prompt người dùng không thay đổi | NOT TESTED (GUI/AI) |
| CAM-04 | Save preset có tên, áp dụng trên Image và Video Node khác trong cùng browser, restart vẫn thấy | NOT TESTED (GUI) |
| CAM-05 | Tạo ảnh thật, lưu asset, xem snapshot Camera và kích thước thực; ratioMatched dựa width/height | BLOCKED (Chrome+AI) |
| CAM-06 | Tạo video Muse thật, bytes/MIME khác poster, thời lượng và frame size dương; lưu và mở lại Canvas | BLOCKED (Chrome Muse+Render) |
| CAM-07 | Chuyển ảnh ratio 1:1/9:16/3:4 với tab đã xác minh; kiểm kích thước pixel lưu bằng `sips -g pixelWidth -g pixelHeight file.png` | BLOCKED (AI account) |
| CAM-08 | Director 3D đổi 24→50→135mm; FOV cập nhật qua PerspectiveCamera, position/target/aspect không đổi, animation vẫn đúng | BLOCKED (Browser GPU/UI) |
| CAM-09 | Director bật/tắt Camera Studio, lưu model.json, đóng/mở dự án, metadata scene vẫn tồn tại và camera không bị thay engine | NOT TESTED (GUI/workspace) |
| CAM-10 | Inpaint, ánh sáng, nhiều góc nhìn, media history, 9 node gốc, Agent/tools/MCP vẫn dùng được | NOT TESTED (Regression) |
| CAM-11 | Tab AI đóng/reload/đổi URL trước khi gửi, adapter từ chối rõ lý do, không gửi vào chat mới và không tự retry job | BLOCKED (Chrome/Render) |
| CAM-12 | Batch nhiều prompt/cảnh với preset snapshot theo Task/Scene ID | BLOCKED (Batch Engine chưa sẵn sàng, không có UI giả) |

**Kiểm chứng bên ngoài sau khi file xuất:** dùng Finder hoặc Terminal trên Mac để đối chiếu byte size/MIME. Với MP4/WebM, sử dụng `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 <file>` (trên bản sao file output thật). Kiểm tra video có track video và thời lượng; thumbnail/poster không đạt.

## Kết quả xác minh code và CI

- [PASS CI Linux trước lần chỉnh UI gần nhất](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42493990963): Bun frozen install, Chrome/Relay JS syntax, typecheck cả Director3D, Web, Server, image/video Nodes, nodeShared/Scaffold, build Tools/Extensions/Nodes/MCP/Web/Server.
- [CI cho commit UI/snapshot gần nhất](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42494199700): **PASS (CI Linux) tại thời điểm cập nhật tài liệu**.
- **NOT TESTED:** chọn/đọc preset trên Canvas thực, aspect thật, animation, persist Model JSON.
- **BLOCKED:** tạo ảnh/video AI thật và lưu reopen, vì phiên lập trình không có Chrome VM đã đăng nhập Muse/Gemini/ChatGPT và Render Web Service URL thực tế.

## Ghi nhận khi chủ dự án nghiệm thu

Với mỗi CAM ID, lưu: ngày giờ, commit SHA, OS + Bun/Chrome version, device ID rút gọn, provider, loại media, tên file và SHA256, kích thước (width × height), duration/ffprobe (video), trạng thái và log lỗi nếu có. **Không** chụp token pairing, cookie, owner key hoặc prompt riêng tư lên issue công khai. Không sửa bảng thành PASS nếu chưa có bằng chứng.

