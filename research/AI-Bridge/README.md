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

### Experimental image/video recognition (local fork)

This fork adds **opt-in** media capture to the existing chat-completions endpoint.
The Chrome content script snapshots all media URLs inside visible assistant-response
containers **before** pressing Send, then watches for newly rendered `img`,
`video` and explicit media-download links in those containers. It does not
search the entire web page. Captured bytes are MIME/signature checked, images
are decoded and videos must expose valid duration/dimensions; then SHA-256 and
sequenced, acknowledged WebSocket chunks are checked again by the local server.
Old media, thumbnails masquerading as video, and incomplete uploads are rejected.

Start the local server with a **non-empty** `BRIDGE_API_KEY` (media mode is
disabled when this is unset). The extension still pairs using its separate
`BRIDGE_TOKEN`. The existing text-only API remains unchanged:

```sh
BRIDGE_API_KEY=your-private-local-key npm start
```

Call `POST /v1/chat/completions` with `Authorization: Bearer your-private-local-key`,
the usual `messages`, and one additional optional field:

- `"media_kind": "image"` — image output **required**; fail rather than
  accept a text-only completion or video poster.
- `"media_kind": "video"` — video output **required**.
- `"media_kind": "auto"` — detect an image/video when one appears, but
  permit a plain-text answer.
- Omitted or `"none"` — original text-only behavior.

On success, the standard response may contain an additional top-level `media`
array (also at `choices[0].message.media`), with entries shaped like:

```json
{
  "id": "a-file-uuid",
  "kind": "image",
  "mime_type": "image/png",
  "size": 12345,
  "sha256": "hex-sha256",
  "url": "http://127.0.0.1:4317/v1/media/a-file-uuid"
}
```

Fetch that URL with the **same Authorization header**. A stream-mode response
emits the extra metadata in a final SSE `delta.media` message. These extra
fields are a bridge-specific extension of OpenAI's chat format.
Artifacts are stored in the ignored `.ai-bridge-media/` directory, restricted
to localhost, require the configured bearer key, and expire after an hour
(cleanup occurs on subsequent media operations). Override the location with
`BRIDGE_MEDIA_DIR`. Files are limited to 4 per request, 16 MiB per image,
64 MiB per video and 64 MiB combined. MIME types: PNG, JPEG, WebP, MP4, WebM.
There is no remote-media URL downloader in the server.

**Important current limitations:** capture recognizes only media whose actual
bytes are available through a same-origin HTTPS, same-origin blob, or supported
data URL in a known assistant response container. Signed files hosted on
different CDN domains, streamed `MediaSource` video, `m3u8` or `DASH` manifests,
media hidden behind a separate download button, and provider-specific file
flows are **not implemented**. DOM selectors may change. The browser integration
is not yet validated against live ChatGPT/Gemini/Grok or other providers;
the automated tests use synthetic media. No claim is made that all nine
providers support image/video generation. Do not use with valuable active
tasks until manually tested on the desired website.

- This uses the visible web UI, not a provider's private or undocumented network API. UI changes can require selector updates in `extension/content.js`.
- You are responsible for the terms, plan limits, and acceptable-use rules of every provider you choose to connect.
- File uploads, images, provider-specific citations, and native tool execution are outside the first version. When the IDE sends a `tools` array, the bridge best-effort detects JSON tool-call text from the chat tab (bare, fenced, or prose-wrapped) and returns OpenAI `tool_calls` for both streaming and non-streaming requests.
- Claude responses are intentionally emitted once its final response block is stable, rather than streaming its intermediate thinking/status blocks into the IDE.
- Keep the requested provider page fully loaded. If a request says the content script is not ready, reload that tab.
- The extension has permissions only for the nine named chat websites and localhost; it does not have broad `<all_urls>` access.

## Development

```powershell
npm test
```

The tests cover the local health endpoint, model list, title-request interception, bridge relay, streaming, heartbeats, token persistence, prompt-instruction injection, and text-to-`tool_calls` conversion.
