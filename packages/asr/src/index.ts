export type BrowserAsrState = "idle" | "starting" | "listening" | "stopping" | "destroyed";

export interface BrowserAsrResult {
  text: string;
  finalText: string;
  interimText: string;
}

export interface BrowserAsrError {
  code: string;
  message: string;
}

export interface BrowserAsrOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onStateChange?: (state: BrowserAsrState) => void;
  onResult?: (result: BrowserAsrResult) => void;
  onError?: (error: BrowserAsrError) => void;
}

export type BrowserAudioAsrOptions = {
  lang?: string;
  signal?: AbortSignal;
};

interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(audioTrack?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
}

function getRecognitionConstructor() {
  if (typeof window === "undefined") return;
  const browserWindow = window as Window & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}

export function isBrowserAsrSupported() {
  return typeof getRecognitionConstructor() === "function";
}

export function isBrowserAudioAsrSupported() {
  if (!isBrowserAsrSupported() || typeof window.AudioContext !== "function") return false;
  const userAgent = window.navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return false;
  const version = userAgent.match(/(?:Chrome|Chromium)\/(\d+)/)?.[1];
  // ACT: Chromium 135 门槛仅防止旧实现忽略轨道后录麦克风，不保证宿主识别服务可用；后续有原生能力检测时替换 UA 判断。
  return !!version && Number(version) >= 135;
}

export function createBrowserAsr(options: BrowserAsrOptions = {}) {
  const recognitionConstructor = getRecognitionConstructor();
  if (!recognitionConstructor) throw new DOMException("Trình duyệt hoặc WebView hiện tại không hỗ trợ nhận dạng giọng nói gốc", "NotSupportedError");

  const recognition = new recognitionConstructor();
  let state: BrowserAsrState = "idle";
  let cancelled = false;

  recognition.lang = options.lang ?? "vi-VN";
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.maxAlternatives = 1;

  function setState(value: BrowserAsrState) {
    state = value;
    options.onStateChange?.(state);
  }

  recognition.onstart = () => {
    if (state === "starting") setState("listening");
  };
  recognition.onend = () => setState("idle");
  recognition.onerror = (event) => {
    if (!cancelled) options.onError?.({ code: event.error, message: event.message || event.error });
  };
  recognition.onresult = (event) => {
    if (cancelled) return;
    let finalText = "";
    let interimText = "";
    // ACT: 每次重建本轮完整结果，避免临时结果修订时重复追加文字。
    for (let index = 0; index < event.results.length; index++) {
      const result = event.results[index];
      if (result.isFinal) finalText += result[0].transcript;
      else interimText += result[0].transcript;
    }
    options.onResult?.({ text: finalText + interimText, finalText, interimText });
  };

  return {
    get state() {
      return state;
    },
    start(audioTrack?: MediaStreamTrack) {
      if (state !== "idle") throw new DOMException("Nhận dạng giọng nói chưa kết thúc hoặc phiên đã bị hủy", "InvalidStateError");
      if (audioTrack && !isBrowserAudioAsrSupported()) throw new DOMException("Trình duyệt hoặc WebView hiện tại không hỗ trợ nhận dạng từ kênh âm thanh", "NotSupportedError");
      if (audioTrack && (audioTrack.kind !== "audio" || audioTrack.readyState !== "live")) {
        throw new DOMException("Cần có kênh âm thanh hợp lệ để nhận dạng", "InvalidStateError");
      }
      cancelled = false;
      if (audioTrack) recognition.start(audioTrack);
      else recognition.start();
      setState("starting");
    },
    stop() {
      if (state !== "starting" && state !== "listening") return;
      recognition.stop();
      setState("stopping");
    },
    cancel() {
      if (state === "idle" || state === "destroyed" || cancelled) return;
      cancelled = true;
      recognition.abort();
      setState("stopping");
    },
    destroy() {
      if (state === "destroyed") return;
      const active = state !== "idle";
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      state = "destroyed";
      if (active) recognition.abort();
      options.onStateChange?.(state);
    },
  };
}

export function transcribeBrowserAudio(src: string, options: BrowserAudioAsrOptions = {}): Promise<string> {
  if (typeof src !== "string" || !src.trim()) return Promise.reject(new TypeError("Vui lòng cung cấp địa chỉ âm thanh hợp lệ"));
  if (options.signal?.aborted) return Promise.reject(new DOMException("Đã hủy chuyển âm thanh thành văn bản", "AbortError"));
  if (!isBrowserAudioAsrSupported()) {
    return Promise.reject(new DOMException("Trình duyệt hiện tại chưa hỗ trợ chuyển âm thanh thành văn bản; hãy thử trình duyệt khác.", "NotSupportedError"));
  }

  return new Promise((resolve, reject) => {
    let audio: HTMLAudioElement | undefined;
    let context: AudioContext | undefined;
    let source: MediaElementAudioSourceNode | undefined;
    let destination: MediaStreamAudioDestinationNode | undefined;
    let asr: ReturnType<typeof createBrowserAsr> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let playbackEnded = false;
    let lastCurrentTime = -1;
    let finalText = "";

    function finish(error?: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
      window.removeEventListener("pagehide", cancel);
      try {
        asr?.destroy();
      } catch {
        // 原生 abort 失败时仍需释放音频和轨道。
      }
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.onplaying = null;
        audio.ontimeupdate = null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      source?.disconnect();
      destination?.disconnect();
      destination?.stream.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") void context.close().catch(() => {});
      if (error) reject(error);
      else resolve(finalText.trim());
    }

    function cancel() {
      finish(new DOMException("Đã hủy chuyển âm thanh thành văn bản", "AbortError"));
    }

    function setTimeoutError(message: string, duration = 30000) {
      clearTimeout(timeout);
      timeout = setTimeout(() => finish(new Error(message)), duration);
    }

    try {
      audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      context = new AudioContext();
      source = context.createMediaElementSource(audio);
      destination = context.createMediaStreamDestination();
      // 音频只送入识别轨道，不连接扬声器，也不请求麦克风。
      source.connect(destination);
      const track = destination.stream.getAudioTracks()[0];
      if (!track) throw new Error("Không thể tạo kênh nhận dạng âm thanh");
      asr = createBrowserAsr({
        lang: options.lang,
        continuous: true,
        interimResults: false,
        onResult: (result) => { finalText = result.finalText; },
        onError: (error) => {
          const messages: Record<string, string> = {
            network: "Tạm thời không thể kết nối dịch vụ nhận dạng giọng nói. Hãy thử lại sau; âm thanh gốc không bị ảnh hưởng.",
            "not-allowed": "Trình duyệt chưa cho phép nhận dạng giọng nói; hãy kiểm tra quyền truy cập của trang rồi thử lại.",
            "service-not-allowed": "Trình duyệt hiện không thể dùng dịch vụ nhận dạng giọng nói; hãy thử lại sau hoặc đổi trình duyệt.",
            "audio-capture": "Tạm thời không thể đọc âm thanh; hãy chọn lại tệp rồi thử lại.",
            "no-speech": "Không phát hiện giọng nói rõ ràng trong đoạn âm thanh này; hãy thử đoạn khác.",
            "language-not-supported": "Dịch vụ nhận dạng của trình duyệt hiện không hỗ trợ ngôn ngữ đã chọn; hãy thử trình duyệt khác.",
            aborted: "Lần nhận dạng này đã bị gián đoạn; có thể thử lại.",
          };
          finish(new Error(messages[error.code] ?? "Không thể hoàn tất lần nhận dạng này. Hãy thử lại sau; âm thanh gốc không bị ảnh hưởng.", { cause: error }));
        },
        onStateChange: (state) => {
          if (settled) return;
          if (state === "listening") void audio!.play().catch(error => finish(new Error("Tạm thời không phát được âm thanh; hãy thử nhấn Chuyển thành văn bản thêm lần nữa.", { cause: error })));
          if (state !== "idle") return;
          if (!playbackEnded) finish(new Error("Lần nhận dạng này kết thúc sớm; có thể thử lại. Âm thanh gốc không bị ảnh hưởng."));
          else if (!finalText.trim()) finish(new Error("Không nhận dạng được lời nói thành văn bản; hãy thử đoạn âm thanh có giọng nói rõ ràng hơn."));
          else finish();
        },
      });
      audio.onended = () => {
        if (settled) return;
        playbackEnded = true;
        setTimeoutError("Chờ kết quả nhận dạng quá lâu. Hãy thử lại sau; âm thanh gốc không bị ảnh hưởng.", 15000);
        try {
          asr!.stop();
        } catch (error) {
          finish(error);
        }
      };
      audio.onerror = () => finish(new Error("Tạm thời không thể đọc đoạn âm thanh này; hãy kiểm tra tệp có phát được không hoặc thử đoạn khác.", { cause: audio?.error }));
      audio.onplaying = audio.ontimeupdate = () => {
        if (settled || playbackEnded || audio!.currentTime <= lastCurrentTime) return;
        lastCurrentTime = audio!.currentTime;
        setTimeoutError("Đọc âm thanh mất quá nhiều thời gian. Hãy thử lại sau; âm thanh gốc không bị ảnh hưởng.");
      };
      options.signal?.addEventListener("abort", cancel, { once: true });
      window.addEventListener("pagehide", cancel, { once: true });
      audio.src = src;
      setTimeoutError("Dịch vụ nhận dạng giọng nói chưa phản hồi. Hãy thử lại sau; âm thanh gốc không bị ảnh hưởng.");
      void context.resume().then(() => {
        if (!settled) asr!.start(track);
      }).catch(finish);
    } catch (error) {
      finish(error);
    }
  });
}
