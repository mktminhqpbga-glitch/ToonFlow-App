/// <reference types="bun" />

type ModelType = "text" | "image" | "video" | "audio";

type ImageMode = "text" | "singleImage" | "multiReference";
type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`${"video" | "image" | "audio"}Reference:${number}`)[];

interface ProviderModel<TRules extends readonly ProviderFormRule[] = readonly ProviderFormRule[]> {
  id: string;
  label: string;
  type: ModelType;
  think?: boolean;
  mode?: (ImageMode | VideoMode)[];
  associationSkills?: string;
  audio?: "optional" | boolean;
  imageSizes?: string[];
  imageRatios?: string[];
  durationResolutionMap?: { duration: number[]; resolution: string[] }[];
  voices?: { title: string; voice: string }[];
  /** Các rules JSON form-create riêng theo mô hình; giá trị từ biểu mẫu node được truyền vào request.other. */
  rules?: TRules;
}

interface ProviderFormRule {
  field: string;
  value: unknown;
  [key: string]: unknown;
}

type ProviderConfig<TRules extends readonly ProviderFormRule[]> = {
  [TRule in TRules[number] as TRule["field"]]: TRule["value"];
};

type ProviderTaskValue = null | boolean | number | string | ProviderTaskValue[] | { [key: string]: ProviderTaskValue };
/** Dữ liệu khôi phục được lưu bền vững; không chứa khóa, thông tin xác thực, binary hoặc đối tượng runtime. */
type ProviderTaskData = { [key: string]: ProviderTaskValue };

interface ProviderContext<TConfig = Record<string, unknown>> {
  config: TConfig;
  signal?: AbortSignal;
  /** Khi tác vụ bất đồng bộ được nhận, chờ lưu trạng thái ngay; host cũ có thể chưa hỗ trợ nên dùng optional chaining. */
  saveTaskData?: (data: ProviderTaskData) => Promise<void>;
  /** Host cung cấp các công cụ trực tiếp; adapter không cần import. FFmpeg được cài theo nhu cầu. */
  tool: ProviderTools;
}

interface MediaRequest {
  model: string;
  /** Chỉ chứa tham số riêng của nhà cung cấp; nhà cung cấp phải kiểm tra khả năng hỗ trợ và ánh xạ các trường chung. */
  other?: Record<string, unknown>;
}

/** Nguồn media trừu tượng; nhà cung cấp chuyển sang URL, tệp hoặc bytes mà nền tảng yêu cầu. */
type MediaInput =
  | { type: "url"; url: string; mimeType?: string; name?: string }
  | { type: "base64"; data: string; mimeType: string; name?: string }
  | { type: "binary"; data: Uint8Array; mimeType: string; name?: string };

type MediaAsset = MediaInput & { mediaType: "image" | "video" | "audio" };

type MediaImageInfo = { width: number; height: number; format: string };
type MediaImageResizeOptions = { width?: number; height?: number; format?: "jpeg" | "png" | "webp"; quality?: number };

interface AudioConvertOptions {
  format: "wav" | "mp3";
  /** Thời điểm bắt đầu cắt, đơn vị giây, có tính mốc bắt đầu; mặc định 0. */
  startSeconds?: number;
  /** Thời điểm kết thúc cắt, đơn vị giây, không bao gồm mốc cuối; mặc định hết âm thanh. */
  endSeconds?: number;
  /** Tần số lấy mẫu đích; mặc định giữ tần số nguồn. */
  sampleRate?: number;
  /** Bitrate MP3 tính bằng kbps; mặc định 128, chỉ dùng khi format là mp3. */
  bitrateKbps?: number;
}

/** Ném khi không có FFmpeg khả dụng; frontend hỏi người dùng cài đặt, adapter phải ném lỗi tiếp. */
interface FfmpegRequiredError extends Error {
  name: "FfmpegRequiredError";
  code: "FFMPEG_REQUIRED";
  status: 424;
}

interface ProviderTools {
  fetch: typeof globalThis.fetch;
  /** Trích nguyên nhân lỗi dễ đọc từ nội dung nhà cung cấp, đồng thời ẩn khóa và query parameter trong URL cấu hình. */
  errorMessage(value: unknown): string;
  hash: typeof Bun.hash;
  image: typeof Bun.Image;
  /** Công cụ xử lý ảnh chung; adapter có thể dùng trong processMedia theo khả năng thực của mô hình. */
  media: {
    inspectImage(input: MediaInput): Promise<MediaImageInfo>;
    resizeImage(input: MediaInput, options: MediaImageResizeOptions): Promise<MediaInput>;
  };
  /**
   * Cắt/chuyển mã âm thanh; chỉ nhận bytes WAV trong bộ nhớ và trả bytes sau xử lý; không nhận đường dẫn tệp, URL hoặc định dạng nén khác.
   */
  audio: {
    convert(input: Uint8Array, options: AudioConvertOptions): Promise<{ data: Uint8Array; mimeType: string }>;
  };
  /**
   * Lấy factory @renmu/fluent-ffmpeg do host cung cấp gắn với workspace hiện tại; hỗ trợ chuỗi lệnh, sự kiện, stream và callback ffprobe gốc.
   * Chỉ đường dẫn tệp truyền trực tiếp mới được kiểm tra giới hạn workspace; I/O gián tiếp qua tham số, bộ lọc hoặc danh sách tệp không phải sandbox.
   * Host luôn cung cấp hàm này; khi gọi mới kiểm tra FFmpeg/FFprobe. Không dùng ở ngữ cảnh debug thiếu workspace.
   * Nếu chưa cài, ném FfmpegRequiredError và nhờ frontend hỏi có tải hay không; không tự cài ngầm.
   * Sau cài đặt, người dùng tự khởi chạy lại; adapter không được bắt lỗi rồi tự gửi lại toàn bộ tác vụ.
   * Quy tắc ghi đè đầu ra theo thư viện gốc; bên gọi quản lý tên tệp, sự kiện end/error và hủy bằng command.kill.
   * @throws {FfmpegRequiredError} Chưa cài hoặc chưa tìm thấy FFmpeg khả dụng trong cấu hình hiện tại.
   * @example const ffmpeg = await this.tool.ffmpeg(); const command = ffmpeg("assets/input.mp4").videoCodec("libx264");
   */
  ffmpeg(): Promise<import("@toonflow/ffmpeg/types").FfmpegFactory>;
}

interface ImageRequest extends MediaRequest {
  prompt: string;
  /** Ảnh tham chiếu. */
  images?: MediaInput[];
  mask?: MediaInput;
  /** Số lượng kết quả tạo. */
  n?: number;
  /** Tỉ lệ khung hình, ví dụ 16:9. */
  ratio?: string;
  /** Kích thước đầu ra, ví dụ 1K, 2K, 4K hoặc 1024x1024; nhà cung cấp tự chuyển đổi định dạng. */
  size?: string;
  /** Mức chất lượng, ví dụ low, medium, high; do nhà cung cấp ánh xạ. */
  quality?: string;
  /** Định dạng mã hóa đầu ra, ví dụ png, jpeg, webp. */
  outputFormat?: string;
}

interface VideoRequest extends MediaRequest {
  prompt: string;
  /** Chế độ tạo hiện tại; mảng chế độ tham chiếu khai báo giới hạn số media tham chiếu từng loại. */
  mode?: VideoMode;
  /** Ảnh tham chiếu; khung đầu và cuối được truyền riêng qua firstFrame, lastFrame. */
  images?: MediaInput[];
  videos?: MediaInput[];
  audios?: MediaInput[];
  firstFrame?: MediaInput;
  lastFrame?: MediaInput;
  /** Thời lượng đầu ra tính bằng giây; nhà cung cấp phải kiểm tra giới hạn mô hình. */
  duration?: number;
  /** Tỉ lệ khung hình, ví dụ 16:9. */
  ratio?: string;
  /** Mức độ phân giải, ví dụ 720p, 1080p. */
  resolution?: string;
  generateAudio?: boolean;
  watermark?: boolean;
}

/** Tham số tạo âm thanh cơ bản; phải có text hoặc prompt, nhà cung cấp tự kiểm tra giá trị không rỗng và khả năng mô hình. */
type AudioRequest = MediaRequest & {
  /** Văn bản cần đọc trong text-to-speech. */
  text?: string;
  /** Prompt sáng tác âm thanh hoặc kiểu giọng nói, có thể tách riêng khỏi text cần đọc. */
  prompt?: string;
  /** Âm thanh tham chiếu; có thể kèm bản phiên âm chính xác. Nhà cung cấp xử lý upload hoặc sao chép giọng. */
  audios?: (MediaInput & { text?: string })[];
  /** Ảnh tham chiếu để tạo âm thanh; nhà cung cấp kiểm tra số lượng và khả năng dùng cùng audio tham chiếu. */
  images?: MediaInput[];
  /** ID giọng có sẵn hoặc được sao chép, do nhà cung cấp ánh xạ sang tham số giọng của nền tảng. */
  voice?: string;
  /** Hệ số tốc độ đọc, 1 là bình thường; nhà cung cấp chuyển thành mức tốc độ của nền tảng. */
  speed?: number;
  /** Độ tăng âm lượng tính bằng dB; 0 là âm lượng gốc; nhà cung cấp chuyển đổi theo nền tảng. */
  volume?: number;
  /** Độ lệch cao độ tính theo bán âm; 0 là cao độ gốc; nhà cung cấp ánh xạ và kiểm tra giới hạn nền tảng. */
  pitch?: number;
  /** Cảm xúc, ví dụ happy, sad, angry; nhà cung cấp ánh xạ và kiểm tra model/giọng có hỗ trợ không. */
  emotion?: string;
  /** Ngôn ngữ/giọng địa phương, ví dụ zh-CN, en, yue; nhà cung cấp ánh xạ, mặc định theo model. */
  language?: string;
  /** Có chuẩn hóa cách đọc số và văn bản hay không; nhà cung cấp kiểm tra ngôn ngữ và quy tắc hỗ trợ. */
  normalizeText?: boolean;
  /** Định dạng đầu ra, ví dụ mp3, wav, pcm, flac, opus; nhà cung cấp ánh xạ tên định dạng. */
  format?: string;
  /** Tần số lấy mẫu đầu ra (Hz). */
  sampleRate?: number;
  /** Bitrate đầu ra (kbps); chỉ áp dụng định dạng cho phép chỉnh bitrate, do nhà cung cấp chuyển đơn vị. */
  bitrateKbps?: number;
} & ({ text: string } | { prompt: string });

/**
 * Ba hàm tạo media đều trả mảng media cuối cùng, không trả riêng task ID hoặc response thô từ nền tảng.
 * ACT: Giữ tương thích với kết quả tổng hợp cũ; adapter bất đồng bộ có thể thêm lưu và khôi phục qua saveTaskData và resumeTask.
 */
type GenerateMedia<TRequest, TConfig = Record<string, unknown>> = (
  this: ProviderContext<TConfig>,
  request: TRequest,
) => Promise<MediaAsset[]>;

interface ProviderUpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  notice: string;
}

interface ProviderDefinition<TRules extends readonly ProviderFormRule[] = readonly ProviderFormRule[]> {
  id: string;
  label: string;
  /** Biểu tượng thương hiệu của nhà cung cấp, có thể là URL ảnh hoặc data:image/...;base64,... */
  icon?: string;
  /** Phiên bản adapter độc lập với phiên bản model; nên khai báo khi thêm mới, bỏ trống chỉ để tương thích tệp cũ. */
  version?: string;
  apiUrl?: string;
  /**
   * URL GET danh sách mô hình media; dùng apiKey cấu hình làm Bearer, trả { data: mảng mô hình }.
   * Mỗi mô hình phải có id; type có thể bổ sung từ tham số type trong URL hoặc mô hình cùng ID đang có.
   * Đối tượng modelInfo tùy chọn cung cấp khả năng (mode, audio, durationResolutionMap, imageSizes, imageRatios), được gộp vào mô hình khi lấy.
   * Khi có trường này, người dùng có thể tự tải danh sách mô hình.
   */
  modelsUrl?: string;
  protocol?: "openai-completions" | "openai-responses" | "anthropic-messages";
  /** Mô tả nhà cung cấp dạng Markdown. */
  readme?: string;
  rules: TRules;
  models: ProviderModel[];
  /** Kiểm tra tệp adapter nhà cung cấp có cập nhật hay không. */
  checkForUpdates?: (this: ProviderContext<ProviderConfig<TRules>>) => Promise<ProviderUpdateInfo>;
  /** Lấy mã nguồn đầy đủ của tệp cập nhật; host chịu trách nhiệm ghi và áp dụng. */
  updateVendor?: (this: ProviderContext<ProviderConfig<TRules>>) => Promise<string>;
  /**
   * Chỉ tra giá, không tạo tác vụ hay tính phí. request.type phân biệt ảnh, video, âm thanh.
   * Tài nguyên tham chiếu chỉ truyền metadata, không truyền nội dung tệp hoặc địa chỉ; tham số khác giống request tạo tương ứng.
   * Trả { price, tips }; nhà cung cấp tự đưa văn bản báo giá và nhắc nhở; null nghĩa chưa thể báo giá cho cấu hình này, node hiển thị chỗ trống.
   */
  getPrice?: (this: ProviderContext<ProviderConfig<TRules>>, request: ProviderPriceRequest) => Promise<ProviderPrice | null>;
  /** Tra số dư tài khoản nhà cung cấp đang cấu hình; đơn vị do nhà cung cấp trả về. */
  getBalance?: (this: ProviderContext<ProviderConfig<TRules>>) => Promise<ProviderBalance>;
  /** Phương thức chưa triển khai để trống; bên gọi căn cứ vào đó xác định chức năng có sẵn. */
  generateImage?: GenerateMedia<ImageRequest, ProviderConfig<TRules>>;
  generateVideo?: GenerateMedia<VideoRequest, ProviderConfig<TRules>>;
  generateAudio?: GenerateMedia<AudioRequest, ProviderConfig<TRules>>;
  /** Tiếp tục chờ tác vụ gốc, thứ tự kết quả giống generate; không gửi lại giai đoạn đã được tiếp nhận. Có thể ném lỗi code MEDIA_TASK_FAILED nếu trạng thái thất bại chắc chắn. */
  resumeTask?: (this: ProviderContext<ProviderConfig<TRules>>, data: ProviderTaskData) => Promise<MediaAsset[]>;
  /** Tiền xử lý media của nhà cung cấp (tùy chọn); nếu không triển khai thì giữ request gốc. */
  processMedia?: (this: ProviderContext<ProviderConfig<TRules>>, request: ImageRequest | VideoRequest | AudioRequest) => Promise<ImageRequest | VideoRequest | AudioRequest>;
}

/** Chỉ dùng hiển thị, không tham gia tính số dư; tips là chuỗi rỗng nếu không có lời nhắc. */
interface ProviderPrice {
  price: string;
  tips: string;
}

/** Metadata tài nguyên phục vụ báo giá; không có base64, binary, URL hay đường dẫn cục bộ. Bỏ trường chưa biết thay vì coi là 0. */
interface ProviderPriceReference {
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  /** Thời lượng video hoặc audio tham chiếu, tính bằng giây; không phải thời lượng đầu ra. */
  duration?: number;
  frameRate?: number;
}

/** Định giá theo loại, số lượng và metadata thật của tài nguyên tham chiếu; mode chỉ mô tả chế độ, không thay dữ liệu tham chiếu. */
type ProviderPriceRequest =
  | ({ type: "image"; images?: ProviderPriceReference[]; mask?: ProviderPriceReference } & Omit<ImageRequest, "images" | "mask">)
  | ({ type: "video"; images?: ProviderPriceReference[]; videos?: ProviderPriceReference[]; audios?: ProviderPriceReference[]; firstFrame?: ProviderPriceReference; lastFrame?: ProviderPriceReference } & Omit<VideoRequest, "images" | "videos" | "audios" | "firstFrame" | "lastFrame">)
  | ({ type: "audio"; images?: ProviderPriceReference[]; audios?: (ProviderPriceReference & { text?: string })[] } & Omit<AudioRequest, "images" | "audios">);

interface ProviderBalance {
  balance: number;
  unit: string;
  /** null nghĩa hạn mức khóa không giới hạn; bỏ trống nghĩa nhà cung cấp không cung cấp hạn mức khóa riêng. */
  keyBalance?: number | null;
  totalConsumption?: number;
  totalRecharge?: number;
}
