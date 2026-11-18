# AI Bridge

AI Bridge turns a tab you are already logged into on an AI chat website into a **local, OpenAI-compatible** endpoint for a local IDE or agent. It deliberately keeps the two halves on your computer:

```text
IDE / agent ──HTTP──> 127.0.0.1:4317/v1 ──WebSocket──> Chrome extension ──DOM──> logged-in AI chat tab
```

## Supported AI chats

- [Grok](https://grok.com/)
- [Gemini](https://gemini.google.com/app)
- [DeepSeek](https://chat.deepseek.com/)
- [Perplexity](https://www.perplexity.ai/)
- [Qwen](https://chat.qwen.ai/)
- [ChatGPT](https://chatgpt.com/)
- [Claude](https://claude.ai/)
- [Z.ai](https://chat.z.ai/)
- [Kimi](https://www.kimi.com/)
- [Muse](https://muse.ai/) — text chat (local extension only; experimental DOM adapter)

This project borrows the practical idea of a web-chat-to-OpenAI gateway from [geminiweb-as-api](https://github.com/hieonn/geminiweb-as-api) and the extension-first direction of [Quarkonix](https://github.com/nikita-nikita12308/Quarkonix), without copying browser profiles or exposing a remote server.

## Install

1. Install Node.js 20 or newer.
2. From this directory, start the local companion with Run.bat or manually in cmd:

   ```powershell
   npm start
   ```

   On first start it creates `.ai-bridge-token` next to `local-server.mjs`, then prints that bridge token. Leave this terminal running. Future starts reuse the same token, so the extension does not need to be configured again.

3. In Chrome, open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select the `extension` folder in this project.
4. Open the AI Bridge extension, paste the printed token, and click **Save & connect**.
5. Click a provider in the popup, sign in normally, and leave that tab open. Choose it as the default provider, or use a provider-specific model name.

The server binds only to `127.0.0.1`. It never reads, copies, or uploads Chrome profile files. Each request is serialised because a chat tab can answer only one prompt at a time. While connected, the extension exchanges a heartbeat every 20 seconds, so its Manifest V3 service worker remains active indefinitely on Chrome 116 or newer. The **Pause** button intentionally stops that connection; **Continue** restores it.

After changing extension files during development, click the extension's **Reload** button on `chrome://extensions`. Restart `npm start` after changing the local server.

## Use from an IDE

Set the IDE's OpenAI-compatible base URL to:

```text
http://127.0.0.1:4317/v1
```

Use `bridge-auto` to route to the configured default provider, or select one explicitly:

```text
bridge-grok       bridge-gemini     bridge-deepseek
bridge-perplexity bridge-qwen       bridge-chatgpt
bridge-claude     bridge-zai        bridge-kimi
bridge-muse
```

The local endpoint implements `GET /v1/models`, `POST /v1/chat/completions`, including Server-Sent Events when `stream: true`, and `GET /health`.

Automatic “name this conversation” requests are detected and completed locally; they do not use the active AI-chat tab. Set `BRIDGE_INTERCEPT_TITLES=0` before starting the server to disable this behavior.

```powershell
curl http://127.0.0.1:4317/v1/chat/completions `
  -H 'Content-Type: application/json' `
  -d '{"model":"bridge-gemini","messages":[{"role":"user","content":"Explain this error briefly."}]}'
```

Most OpenAI clients require a non-empty API key even when a local server does not. Supply any placeholder value unless you opt into local API-key protection:

```powershell
$env:BRIDGE_API_KEY = 'choose-a-local-secret'
npm start
```

With `BRIDGE_API_KEY` set, send `Authorization: Bearer choose-a-local-secret`.

### Bridge-token storage

The bridge token is automatically stored in the ignored `.ai-bridge-token` file. Delete that file to rotate the token, then paste the newly printed value into the extension. To use a managed token without writing a file, set `BRIDGE_TOKEN`; to choose another token-file location, pass `--token-file <path>` or set `BRIDGE_TOKEN_FILE`.

### Settings

`ai-bridge.settings.json` sits beside the local server and is deliberately readable and versionable:

```json
{
  "interceptTitleRequests": true,
  "injectPromptInstructionsEveryMessage": true,
  "prePrompt": "Generic Pre-prompt",
  "postPrompt": "Generic Post-prompt",
  "// disguiseModelNameAsAssistant": "Turning on may increase responsiveness of a model to the prompt",
  "disguiseModelNameAsAssistant": false
}
```

Set `interceptTitleRequests` to `false` to pass IDE conversation-naming calls through to the selected AI website. The environment variable `BRIDGE_INTERCEPT_TITLES=0` overrides this setting for one run. Use `BRIDGE_SETTINGS_FILE` or `--settings-file <path>` to load a settings file from elsewhere.

Set `disguiseModelNameAsAssistant` to `true` to always replace `{{modelName}}` with `an assistant` instead of the provider display name. Turning this on may increase responsiveness of a model to the prompt. Keys that start with `//` are comments and are ignored.

### Prompt instructions

Markdown files under `prompt-instructions/` are wrapped around the bridged chat transcript before it is typed into the AI tab:

```text
prompt-instructions/
  pre-prompt/
    Generic Pre-prompt.md
    ZCode Pre-prompt.md
  post-prompt/
    Generic Post-prompt.md
    ZCode Post-prompt.md
```

- `prePrompt` / `postPrompt` name the active file stem (with or without `.md`). Set either to `""` to disable that side.
- Pre-prompt text is placed at the very start of the outgoing prompt; post-prompt text at the very end.
- With `injectPromptInstructionsEveryMessage: true` (default), both are injected on every chat completion. Set it to `false` to inject only on the first user turn of a conversation (`messages` has at most one `role: "user"` entry).
- Use `{{modelName}}` in either file for the provider display name (for example `Claude`, `Gemini`, `ChatGPT`). Prefer a provider-specific model (`bridge-claude`, …) so the server can substitute immediately; with `bridge-auto`, the placeholder is filled by the content script from the live tab hostname.
- Edit the markdown files anytime; the next request reloads them. Settings changes still require restarting `npm start`.
- Use `BRIDGE_PROMPT_INSTRUCTIONS_DIR` or `--prompt-instructions-dir <path>` to point at another instructions root.

## Notes and limits

- This uses the visible web UI, not a provider's private or undocumented network API. UI changes can require selector updates in `extension/content.js`.
- You are responsible for the terms, plan limits, and acceptable-use rules of every provider you choose to connect.
- File uploads, images, provider-specific citations, and native tool execution are outside the first version. When the IDE sends a `tools` array, the bridge best-effort detects JSON tool-call text from the chat tab (bare, fenced, or prose-wrapped) and returns OpenAI `tool_calls` for both streaming and non-streaming requests.
- Claude responses are intentionally emitted once its final response block is stable, rather than streaming its intermediate thinking/status blocks into the IDE.
- Keep the requested provider page fully loaded. If a request says the content script is not ready, reload that tab.
- The extension has permissions only for the ten named chat websites and localhost; it does not have broad `<all_urls>` access.

## Development

```powershell
npm test
```

The tests cover the local health endpoint, model list, title-request interception, bridge relay, streaming, heartbeats, token persistence, prompt-instruction injection, and text-to-`tool_calls` conversion.


## Local Muse text extension (not part of the RenZekta upstream release)

This downloaded checkout includes a local `0.4.1` extension modification for **Muse text conversations**. The upstream project still remains version `0.4.0`; these changes were not published by the author.

- On your Mac, use the existing original local server at `http://127.0.0.1:4320` and reload the unpacked Chrome extension from `~/Downloads/AI-Bridge-Original/extension` in `chrome://extensions`.
- With a signed-in `https://muse.ai/` tab open, choose **Muse** in the extension's default provider menu or send a text completion using model `bridge-muse` to the `http://127.0.0.1:4320/v1` endpoint.
- Leave the Muse input empty before sending. This adapter refuses existing drafts or a busy tab, only clicks a unique send button, and only returns text after observing a matching **new** user turn followed by a **new** assistant turn. It never retries automatically after an uncertain send.
- Because Muse's DOM can change, live browser acceptance is still required. No image/video generation, image uploads or media downloads are implemented in this original text-only bridge.


## MacFlow quản lý AI/tab (mở rộng cục bộ 0.4.2)

Bản cài riêng trong Downloads có thêm giao thức nội bộ cho MacFlow. Sau **một lần tải lại Extension unpacked** từ `chrome://extensions`, bạn không cần chọn model/tab trong popup nữa; MacFlow Cài đặt → AI-Bridge Control Center sẽ tự đọc danh sách các AI và tab qua `GET /api/bridge/status` (yêu cầu Bearer API key). Các model văn bản dùng `bridge-muse`, `bridge-chatgpt`, `bridge-gemini`, `bridge-claude`, `bridge-grok`, `bridge-deepseek`, `bridge-perplexity`, `bridge-qwen`, `bridge-kimi`, `bridge-zai`.

- Mỗi Chrome Profile có ID cố định lưu trong extension storage. Tab được nhận diện theo Profile ID, Chrome tab ID, URL HTTPS của nhà cung cấp và document token phát sinh mới sau F5. Di chuyển thứ tự tab không làm đổi ID; F5/chuyển URL làm thay đổi phiên, danh sách được quét lại tự động.
- Các tác vụ được MacFlow ghim bằng `target:{profileInstanceId,tabId,documentToken,url}`. Server kiểm tra lại và Extension cũng kiểm tra ngay trước khi nhấn gửi. Nếu tab đổi trang/F5/không sẵn sàng, tác vụ bị từ chối; **không tự gửi lại và không tự chuyển sang tab khác**.
- Các website vẫn cần đăng nhập và hỗ trợ DOM thực tế; khả năng gửi văn bản cần nghiệm thu trên từng website. Ở phiên bản 0.4.x chưa có adapter ảnh/video; bản 0.5.0 bổ sung luồng media như mục bên dưới. API key chỉ nằm ở máy người dùng; không đưa vào URL ngoài mạng hay log.
- Chỉ nhận diện các trang thật đã mở, không tự mở/tạo tab hoặc bật quyền website. Chrome Extension cần được cài và ghép nối lần đầu; source `manifest.json` được sửa thì Chrome yêu cầu người dùng **Reload** một lần ở trang quản lý extension để áp dụng.

## Nhận ảnh/video về MacFlow (AI-Bridge 0.5.0)

Trong **MacFlow → Cài đặt → AI-Bridge Control Center**, chọn đúng AI và tab đã được extension xác nhận; chọn **Văn bản**, **Tự động**, **Ảnh** hoặc **Video**, rồi gửi prompt. Server nhận file ảnh/video qua WebSocket theo khối với ACK và mã SHA-256, xác minh định dạng và lưu tạm cục bộ. MacFlow tự tải lại file qua `/api/aiBridge/media/:id` với xác thực nội bộ, đối chiếu SHA-256, xem trước ảnh/video và cung cấp nút tải về. Không lưu API key vào localStorage.

- `media_kind`: `none` (chỉ văn bản; mặc định), `auto` (văn bản hoặc media), `image` (phải nhận được ảnh), `video` (phải nhận được video). Chỉ hai định dạng video MP4/WebM và ba định dạng ảnh PNG/JPEG/WebP được chấp nhận. Nếu yêu cầu ảnh/video không có file hợp lệ, trả lỗi thay vì báo thành công.
- Dung lượng: tối đa 4 file/tác vụ, 16 MiB/ảnh, 64 MiB/video, tổng 64 MiB; media hết hạn sau 1 giờ. Server không tải URL media từ client; nội dung được xác thực theo từng khối. API `GET /v1/media/:id` bắt buộc Bearer API key.
- Media chỉ được dò trong phản hồi mới của AI sau khi gửi; không nhận lại gallery hoặc ảnh cũ. Media URL không thể đọc, tải về từ CDN bị chặn bởi CORS hoặc video không có metadata hợp lệ sẽ bị báo lỗi, không thay thế bằng ảnh poster. Chỉ những dịch vụ/trang có adapter và khả năng truy cập media thực tế mới hoạt động; cần kiểm thử trực tiếp từng site.
- Extension phải được tải lại **một lần** sau khi cập nhật mã nguồn lên 0.5.0 để Chrome nạp script mới; không cần ghép nối lại bằng key và không cần thao tác popup để chọn tab. MacFlow và server từ chối gửi media khi Chrome còn extension cũ.
- Từ extension **0.5.2**, ngay sau khi ghép nối thành công, extension tự quét các tab AI đã mở. Nếu tab chưa có adapter, Chrome tự chèn content script trong đúng tab (quyền `scripting`) để nhận diện mà **không tải lại trang**, không mất draft, không đổi tab đang hiển thị và không gửi prompt. Các tab đang chạy tác vụ, đang tải trang hoặc không thuộc dịch vụ được hỗ trợ không bị can thiệp. Nút **Quét lại tất cả tab AI** trong popup dành cho trường hợp cần quét lại thủ công. Khi cài bản có quyền `scripting` mới, Chrome có thể yêu cầu chấp nhận quyền và Reload extension một lần; từ đó các lần kết nối sau tự quét.
- Luồng này hiển thị/tải media tại Control Center; việc tự ghi trực tiếp vào output của node Canvas thuộc luồng `aiChrome` riêng, chưa được tự động nối sang AI-Bridge.
