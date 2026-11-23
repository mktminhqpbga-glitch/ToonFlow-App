function waitForVideo(video: HTMLVideoElement, event: "loadeddata" | "seeked", signal: AbortSignal, start: () => void) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Không đọc được định dạng video này. Thử video MP4 hoặc chế độ Video gốc.")); };
    const aborted = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(failed, 15000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    try { start(); } catch (error) { cleanup(); reject(error); }
  });
}

export async function sampleVideo(url: string, signal: AbortSignal) {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  try {
    await waitForVideo(video, "loadeddata", signal, () => { video.src = url; });
    const { duration, videoWidth, videoHeight } = video;
    if (!Number.isFinite(duration) || duration <= 0 || !videoWidth || !videoHeight) {
      throw new Error("Video cần có thời lượng và khung hình hợp lệ.");
    }
    const count = duration <= 6 ? 6 : duration <= 30 ? 9 : 12;
    const columns = videoWidth < videoHeight ? 4 : 3;
    const width = videoWidth < videoHeight ? 290 : 400;
    const height = videoWidth < videoHeight ? 340 : 240;
    const caption = 26;
    const canvas = document.createElement("canvas");
    canvas.width = columns * width;
    canvas.height = Math.ceil(count / columns) * height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt chưa hỗ trợ trích khung hình.");
    context.fillStyle = "#181927";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min((width - 8) / videoWidth, (height - caption - 4) / videoHeight);
    const drawWidth = videoWidth * scale;
    const drawHeight = videoHeight * scale;
    const times = Array.from({ length: count }, (_, index) => (index + 0.5) * duration / count);
    for (const [index, time] of times.entries()) {
      signal.throwIfAborted();
      await waitForVideo(video, "seeked", signal, () => { video.currentTime = time; });
      const x = index % columns * width;
      const y = Math.floor(index / columns) * height;
      context.drawImage(video, x + (width - drawWidth) / 2, y + (height - caption - drawHeight) / 2, drawWidth, drawHeight);
      context.fillStyle = "#fff";
      context.font = "15px sans-serif";
      context.fillText(`${index + 1}  |  ${time.toFixed(2)} s`, x + 12, y + height - 8);
    }
    const image = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Không kết xuất được khung hình.")), "image/jpeg", .83);
    });
    signal.throwIfAborted();
    return { image, duration, times };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
