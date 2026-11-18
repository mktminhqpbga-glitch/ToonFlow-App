# @toonflow/asr

Nhận dạng giọng nói gốc của trình duyệt, tương thích `SpeechRecognition` và `webkitSpeechRecognition`, không phụ thuộc Vue và không gọi thêm `getUserMedia`. Gói sử dụng cần khai báo phụ thuộc `"@toonflow/asr": "workspace:*"`.

## Cách sử dụng

```ts
import { createBrowserAsr, isBrowserAsrSupported } from "@toonflow/asr";

if (!isBrowserAsrSupported()) throw new Error("Trình duyệt hoặc WebView hiện tại chưa cung cấp API nhận dạng giọng nói");

const asr = createBrowserAsr({
  lang: "vi-VN",
  onStateChange: (state) => console.log("Trạng thái nhận dạng giọng nói", state),
  onResult: ({ text, finalText, interimText }) => console.log({ text, finalText, interimText }),
  onError: ({ code, message }) => console.error(code, message),
});

// Gọi trong sự kiện nhấp của người dùng; mỗi lần start là một lượt nhận dạng độc lập.
asr.start();
// Dừng thu âm và chờ kết quả cuối cùng cùng trạng thái idle.
// asr.stop();
// Hủy lượt hiện tại và không nhận kết quả tiếp theo; phải về idle mới bắt đầu lại.
// asr.cancel();
// Khi component bị gỡ hoặc không còn dùng, hủy đăng ký callback và ngắt nhận dạng; không tái sử dụng sau khi destroy.
// asr.destroy();
```

Mặc định `lang: "vi-VN"`, `continuous: false`, `interimResults: true` theo API gốc của gói; ứng dụng cần truyền ngôn ngữ muốn nhận dạng rõ ràng. `onResult` trả về toàn bộ trạng thái của lượt hiện tại: khi cập nhật ô nhập, hãy thay phần văn bản nhận dạng của lượt này, không nối thêm `text` mỗi lần. `finalText` là phần đã được xác nhận, còn `interimText` có thể tiếp tục thay đổi.

`state` theo thứ tự `idle → starting → listening → stopping → idle`; trình duyệt có thể tự kết thúc rồi trở về `idle`. Chỉ được bắt đầu lại ở `idle`. Lỗi đồng bộ của `start()` được ném trực tiếp; lỗi khi nhận dạng được gửi qua `onError`, giữ nguyên mã và thông điệp gốc của trình duyệt. Khi chủ động hủy, không gửi callback lỗi `aborted` dự kiến.

`start(audioTrack?: MediaStreamTrack)` cũng nhận một kênh âm thanh hợp lệ; bên gọi tự giải phóng kênh đã truyền. Phải kiểm tra `isBrowserAudioAsrSupported()` trước khi dùng hình thức này.

## Chuyển tệp âm thanh thành văn bản

```ts
import { isBrowserAudioAsrSupported, transcribeBrowserAudio } from "@toonflow/asr";

if (!isBrowserAudioAsrSupported()) throw new Error("Trình duyệt hoặc WebView hiện tại không hỗ trợ nhận dạng tệp âm thanh");
const controller = new AbortController();
const text = await transcribeBrowserAudio(audioUrl, { lang: "vi-VN", signal: controller.signal });
// Khi component bị gỡ hoặc người dùng hủy, gọi controller.abort().
```

`transcribeBrowserAudio(src, options?)` trả về `Promise<string>`; `BrowserAudioAsrOptions` là `{ lang?: string; signal?: AbortSignal }`, ngôn ngữ mặc định của API là tiếng Việt. Âm thanh được đưa vào kênh nhận dạng bằng Web Audio, không kết nối loa và không thu micrô; nhận dạng theo thời lượng thực của âm thanh. Chỉ trả thành công khi tệp đã phát hết và trình duyệt trả văn bản cuối cùng; nếu không có lời nói, nhận dạng kết thúc sớm, lỗi đọc tệp/dịch vụ, hủy hoặc hết hạn thì đều từ chối, không coi bản chép một phần là kết quả đầy đủ. Hết hạn nếu sau 30 giây chưa bắt đầu hoặc không có tiến triển phát, hoặc sau khi phát hết 15 giây vẫn chưa có kết quả.

Khi hoàn tất, thất bại, hủy hoặc thoát trang, gói giải phóng phiên nhận dạng, phần tử âm thanh, kết nối Web Audio và kênh âm thanh. `src` do bên gọi truyền không bị tự hủy; bên tạo Object URL chịu trách nhiệm giải phóng URL.

Thông báo lỗi chuyển âm thanh thành văn bản hiện đã được Việt hóa; mã, thông điệp gốc của trình duyệt và lỗi media vẫn giữ trong `Error.cause` để lập trình viên chẩn đoán, không hiển thị trực tiếp cho người dùng.

## Giới hạn môi trường chạy

Nhận dạng tệp âm thanh được giới hạn thận trọng ở Chromium trên desktop từ phiên bản 135, có API nhận dạng và `AudioContext`; Android, iOS và Safari không hỗ trợ đường này. Điều kiện phiên bản nhằm tránh trình duyệt cũ bỏ qua tham số kênh âm thanh rồi ghi âm micrô; nó không bảo đảm WebView hoặc dịch vụ nhận dạng thực sự hoạt động. Âm thanh dài hoặc im lặng có thể khiến trình duyệt kết thúc sớm; gói báo lỗi rõ ràng, không tự khởi động lại hoặc nối các kết quả một phần. Âm thanh phải được trình duyệt giải mã, URL từ xa phải cho phép đọc qua CORS.

Nhận dạng gốc của trình duyệt có thể gửi âm thanh đến dịch vụ trực tuyến của nhà cung cấp trình duyệt, không phải mô hình offline. Nên dùng localhost hoặc HTTPS. Hãy kiểm chứng dịch vụ, quyền truy cập và âm thanh thật trong ứng dụng/WebView đích; kiểm tra có API và biên dịch thành công không thay thế được kiểm thử runtime.

Tham khảo: [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [tính tương thích của kênh âm thanh](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json) và [dịch vụ nhận dạng giọng nói Edge](https://github.com/MicrosoftDocs/edge-developer/blob/main/microsoft-edge/web-platform/speech-recognition-api.md).
