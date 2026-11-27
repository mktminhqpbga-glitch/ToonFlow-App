import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Images, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, ErrorNote, Spinner } from "../../components/ui";
import { useLightbox } from "../../hooks/useLightbox";
import { API } from "../../hooks/useStudio";
import { deleteJson, getJson, postJson, putJson } from "../../services/http";

type Profile = { product_type: string; keywords: string[]; status: string };
type Screening = { usable: boolean; score?: number; reject_reason?: string | null; description?: string; scene_description?: string };
type ReviewRun = { status: "idle" | "running" | "done" | "stopped" | "failed"; total: number; reviewed: number; usable: number; rejected: number; failed: number; message: string };
type SceneImage = { image_id: string; product_type: string; query: string; image_url: string; pin_url: string; title: string; status: string; screening: Screening | null };

export function ScenesTab() {
  const client = useQueryClient();
  const lightbox = useLightbox();
  const [productType, setProductType] = useState("");
  const [status, setStatus] = useState("live");
  const profiles = useQuery({ queryKey: ["reference-profiles"], queryFn: ({ signal }) => getJson<Profile[]>(`${API}/reference-profiles`, signal) });
  const params = new URLSearchParams();
  if (productType) params.set("product_type", productType);
  if (status) params.set("status", status);
  const images = useQuery({
    queryKey: ["reference-images", productType, status],
    queryFn: ({ signal }) => getJson<SceneImage[]>(`${API}/reference-images?${params}`, signal),
    refetchInterval: 15000,
  });
  const run = useQuery({
    queryKey: ["reference-review"],
    queryFn: ({ signal }) => getJson<ReviewRun>(`${API}/reference-images/screen`, signal),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });
  const running = run.data?.status === "running";
  const pending = useQuery({
    queryKey: ["reference-images", "pending"],
    queryFn: ({ signal }) => getJson<SceneImage[]>(`${API}/reference-images?status=pending`, signal),
    refetchInterval: running ? 3000 : 15000,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["reference-images"] });
  const remove = useMutation({ mutationFn: (id: string) => deleteJson(`${API}/reference-images/${id}`), onSuccess: refresh });
  const review = useMutation({
    mutationFn: () => postJson<ReviewRun>(`${API}/reference-images/screen`),
    onSuccess: (started) => {
      client.setQueryData(["reference-review"], started);
      void client.invalidateQueries({ queryKey: ["reference-review"] });
    },
  });
  const runStatus = run.data?.status;
  useEffect(() => {
    if (runStatus && runStatus !== "running" && runStatus !== "idle") void client.invalidateQueries({ queryKey: ["reference-images"] });
  }, [runStatus, client]);
  const saveKeywords = useMutation({
    mutationFn: (profile: Profile) => putJson<Profile>(`${API}/reference-profiles/${encodeURIComponent(profile.product_type)}`, profile),
    onSuccess: () => client.invalidateQueries({ queryKey: ["reference-profiles"] }),
  });

  if (!profiles.data?.length) {
    return <Empty icon={<Images size={32} aria-hidden="true" />} title="Chưa có ảnh bối cảnh" text="Dùng tiện ích Chrome để lưu ảnh bối cảnh từ Pinterest. Bạn có thể dùng lại kho ảnh này cho nhiều sản phẩm." />;
  }
  const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <div className="stack-lg">
      <p className="muted">AI tham khảo không gian, ánh sáng và phong cách từ các ảnh này. Bạn có thể bỏ ảnh không phù hợp.</p>

      <div className="row">
        <button className="btn btn-primary" disabled={review.isPending || running || !pending.data?.length} onClick={() => review.mutate()}>
          {running ? <><Spinner size={14} />Đang kiểm tra…</> : `Kiểm tra ảnh mới (${pending.data?.length ?? 0})`}
        </button>
        <select className="input" style={{ width: "auto" }} value={productType} onChange={(event) => setProductType(event.target.value)} aria-label="Loại sản phẩm">
          <option value="">Tất cả loại sản phẩm</option>
          {profiles.data.map((profile) => <option key={profile.product_type} value={profile.product_type}>{profile.product_type}</option>)}
        </select>
        <select className="input" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Hiển thị">
          <option value="live">Đang dùng</option>
          <option value="rejected">AI đã loại</option>
          <option value="removed">Bạn đã bỏ</option>
          <option value="duplicate">Ảnh trùng</option>
          <option value="">Tất cả</option>
        </select>
        <span className="muted small">{`${images.data?.length ?? 0} ảnh`}</span>
      </div>
      {run.data && run.data.status !== "idle" && (
        <div className="stack" role="status">
          <div className="progress ok" role="progressbar" aria-valuenow={run.data.reviewed + run.data.failed} aria-valuemin={0} aria-valuemax={run.data.total} aria-label="Ảnh đã kiểm tra"><div style={{ width: `${run.data.total ? ((run.data.reviewed + run.data.failed) / run.data.total) * 100 : 0}%` }} /></div>
          <span className="muted small">{`Đã kiểm tra ${run.data.reviewed + run.data.failed}/${run.data.total} ảnh · ${run.data.usable} ảnh dùng được · ${run.data.rejected} ảnh bị loại${run.data.failed ? ` · ${run.data.failed} ảnh chưa có phản hồi` : ""}`}</span>
          {run.data.status === "stopped" && <div className="notice notice-warn">AI đã ngừng phản hồi. Hãy kiểm tra hạn mức rồi thử lại.<details><summary>Chi tiết</summary>{run.data.message}</details></div>}
          {run.data.status === "failed" && <div className="notice notice-warn">Chưa kiểm tra được ảnh. Hãy thử lại.<details><summary>Chi tiết</summary>{run.data.message}</details></div>}
          {run.data.status === "done" && <span className="muted small">Đã xong.</span>}
        </div>
      )}
      <ErrorNote error={review.error ?? remove.error ?? images.error} />

      {images.data?.length ? (
        <div className="scene-grid">
          {images.data.map((image, index) => (
            <figure key={image.image_id} className="card scene">
              <img
                src={image.image_url}
                alt={image.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                {...lightbox.zoom(images.data.map((item) => ({ src: item.image_url, label: item.title, href: `https://www.pinterest.com${item.pin_url}` })), index)}
              />
              {image.status !== "removed" && (
                <button type="button" className="icon-button remove" style={{ background: "var(--paper)" }} aria-label="Bỏ ảnh này" disabled={remove.isPending} onClick={() => remove.mutate(image.image_id)}><X size={14} /></button>
              )}
              <figcaption>{image.status === "rejected" && image.screening?.reject_reason ? `Đã loại (${image.screening.reject_reason}): ` : ""}{image.screening?.description ?? image.screening?.scene_description ?? image.query}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <Empty icon={<Images size={32} aria-hidden="true" />} title="Không có ảnh để hiển thị" text="Dùng tiện ích Chrome để lưu ảnh từ Pinterest." />
      )}

      <details>
        <summary className="muted small" style={{ cursor: "pointer" }}>Từ khóa tìm ảnh bối cảnh</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          {profiles.data.map((profile) => (
            <form
              key={`${profile.product_type}-${profile.keywords.join("|")}-${profile.status}`}
              className="card pad stack"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                saveKeywords.mutate({ product_type: profile.product_type, keywords: lines(String(data.get("keywords"))), status: "approved" });
              }}
            >
              <div className="row"><strong>{profile.product_type}</strong><span className={`pill ${profile.status === "approved" ? "pill-ok" : "pill-warn"}`}>{profile.status === "approved" ? "Đã duyệt" : "Chờ bạn duyệt"}</span></div>
              <label className="field">Mỗi dòng một từ khóa<textarea name="keywords" rows={Math.min(Math.max(profile.keywords.length + 1, 4), 9)} defaultValue={profile.keywords.join("\n")} /></label>
              <div><button className="btn btn-primary btn-sm" type="submit" disabled={saveKeywords.isPending}>Lưu và duyệt</button></div>
            </form>
          ))}
        </div>
      </details>
      {lightbox.node}
    </div>
  );
}
