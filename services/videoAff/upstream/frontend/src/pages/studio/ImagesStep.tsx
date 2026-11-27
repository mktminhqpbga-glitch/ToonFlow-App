import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorNote, Spinner } from "../../components/ui";
import { useLightbox } from "../../hooks/useLightbox";
import { API, useClips, useStartPipeline } from "../../hooks/useStudio";
import { checkNote, friendlyStep, imagesApproved, isUnchecked, runStopped, runStoppedMessage } from "../../lib/studio";
import { pilotApi } from "../../services/pilotApi";
import { postJson, putJson } from "../../services/http";
import type { BriefRecord, Keyframe, PipelineRun } from "../../types/studio";

const ROLE_LABEL: Record<string, string> = {
  hook: "Mở đầu",
  problem: "Vấn đề",
  demo: "Giới thiệu sản phẩm",
  benefit: "Lợi ích",
  call_to_action: "Kêu gọi mua hàng",
};

export function ImagesStep({ productId, record, frames, run, hasVideo = false, making = false, makingVideo = false }: { productId: string; record: BriefRecord; frames: Keyframe[]; run: PipelineRun | undefined; hasVideo?: boolean; making?: boolean; makingVideo?: boolean }) {
  const client = useQueryClient();
  const lightbox = useLightbox();
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [learned, setLearned] = useState<number[]>([]);
  const shots = record.brief.shots ?? [];
  const byShot = new Map(frames.map((frame) => [frame.shot_index, frame]));
  const approved = shots.filter((_, index) => byShot.get(index)?.status === "approved").length;
  const masterApproved = byShot.get(0)?.status === "approved";
  const refresh = () => client.invalidateQueries({ queryKey: ["keyframes", productId] });

  const review = useMutation({
    mutationFn: ({ index, status }: { index: number; status: "approved" | "ready" }) => putJson(`${API}/${productId}/keyframes/${index}`, { status }),
    onSuccess: refresh,
  });
  const redo = useMutation({
    mutationFn: async ({ index, text }: { index: number; text: string }) => {
      const rule = text ? await postJson<{ status: string }>(`${API}/${productId}/feedback`, { text, asset_type: "keyframe" }) : null;
      await postJson<Keyframe[]>(`${API}/${productId}/keyframes`, { shot_index: index, note: text });
      return rule?.status === "approved";
    },
    onSuccess: (saved, { index }) => {
      if (saved) setLearned((list) => [...list, index]);
      void refresh();
    },
  });
  const recheck = useMutation({ mutationFn: (index: number) => postJson(`${API}/${productId}/keyframes/${index}/check`), onSuccess: refresh });
  const clips = useClips(productId);
  const clipOf = new Map((clips.data ?? []).map((clip) => [clip.shot_index, clip]));
  const refreshClips = () => client.invalidateQueries({ queryKey: ["clips", productId] });
  const remakeClip = useMutation({ mutationFn: (index: number) => postJson(`${API}/${productId}/clips`, { shot_index: index }), onSuccess: refreshClips });
  const acceptClip = useMutation({ mutationFn: (index: number) => putJson(`${API}/${productId}/clips/${index}/review`, {}), onSuccess: refreshClips });
  const recheckClip = useMutation({ mutationFn: (index: number) => postJson(`${API}/${productId}/clips/${index}/check`), onSuccess: refreshClips });
  const clipNeedsLook = (index: number) => {
    const clip = clipOf.get(index);
    return !!clip && (clip.status === "failed" || (clip.status === "ready" && !!clip.qa_problem));
  };
  const needsLook = shots.map((_, index) => index).filter(clipNeedsLook);
  const start = useStartPipeline(productId);
  const rules = useQuery({ queryKey: ["creative-knowledge"], queryFn: ({ signal }) => pilotApi.creativeKnowledge(undefined, signal) });
  const imageRules = (rules.data?.items ?? []).filter((item) => item.status === "approved" && item.scope.asset_type === "keyframe");
  const all = imagesApproved(record, frames);
  const locked = making || makingVideo;

  if (frames.length === 0) {
    return (
      <div className="card pad stack" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 24 }}>Chưa có ảnh</h1>
        <ol className="stack" style={{ margin: 0, paddingLeft: 18, gap: 6 }}>{shots.map((shot, index) => <li key={index} className="small">{shot.voiceover}</li>)}</ol>
        <p className="muted">AI tạo một ảnh cho mỗi cảnh. Tác vụ mất khoảng 8 phút và vẫn tiếp tục nếu bạn rời trang.</p>
        {run && runStopped(run) && <ErrorNote error={run.message || new Error("Lần chạy trước đã dừng.")} message={runStoppedMessage(run)} />}
        <button className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start" }} disabled={start.isPending} onClick={() => start.mutate({ until: "images" })}>{start.isPending ? "Đang bắt đầu…" : "Tạo ảnh"}</button>
        <ErrorNote error={start.error} />
      </div>
    );
  }

  const lightboxImages = shots.flatMap((shot, index) => {
    const frame = byShot.get(index);
    return frame && frame.status !== "failed" ? [{ index, src: `${API}/${productId}/keyframes/${index}/image?v=${frame.attempts}`, label: `Cảnh ${index + 1}` }] : [];
  });

  return (
    <>
      <header className="page-head"><div><h1>Xem và duyệt từng cảnh</h1><p>Duyệt các cảnh bạn thấy phù hợp. Nếu cần chỉnh, hãy mô tả điểm cần sửa để AI tạo lại cảnh và ghi nhớ cho lần sau.</p></div></header>
      <div className="studio-cols">
        <div className="studio-main">
          {!masterApproved && byShot.has(0) && <div className="notice"><div>Duyệt cảnh 1 trước. VideoAFF dùng cảnh này làm mẫu cho các cảnh còn lại.</div></div>}
          <ErrorNote error={review.error ?? redo.error ?? recheck.error ?? remakeClip.error ?? acceptClip.error ?? recheckClip.error} />
          <div className="shot-grid">
            {shots.map((shot, index) => {
              const frame = byShot.get(index);
              const clip = clipOf.get(index);
              const filming = clip?.status === "processing";
              const clipBusy = (remakeClip.isPending && remakeClip.variables === index) || (acceptClip.isPending && acceptClip.variables === index);
              const waiting = making && index > 0 && !frame; // being made right now
              const busy = (redo.isPending && redo.variables?.index === index) || waiting;
              const isApproved = frame?.status === "approved";
              const open = noteFor === index && !busy;
              const src = frame && frame.status !== "failed" ? `${API}/${productId}/keyframes/${index}/image?v=${frame.attempts}` : null;
              return (
                <article key={index} className={`card shot-card${isApproved ? " approved" : ""}`}>
                  <div className="media">
                    {clip?.status === "ready" ? <video src={`${API}/${productId}/clips/${index}/video?v=${clip.attempts}`} poster={src ?? undefined} controls playsInline preload="metadata" aria-label={`Đoạn phim cảnh ${index + 1}`} /> : src ? <img src={src} alt={`Cảnh ${index + 1}`} {...lightbox.zoom(lightboxImages, lightboxImages.findIndex((item) => item.index === index))} /> : <div className="empty">{frame?.error ? "Chưa tạo được ảnh này." : "Chưa có ảnh"}</div>}
                    {filming && !busy && <div className="over"><Spinner size={28} />Đang tạo đoạn phim cho cảnh này, khoảng 4 phút</div>}
                    {busy && <div className="over"><Spinner size={28} />{waiting ? "Đang tạo ảnh cho cảnh này, khoảng 2 phút" : "AI đang chỉnh cảnh này, khoảng 2 phút"}</div>}
                    {isApproved && !busy && !clip && <span className="tag"><Check size={13} aria-hidden="true" />Đã duyệt</span>}
                  </div>
                  <div className="body">
                    <strong>{`Cảnh ${index + 1} · ${ROLE_LABEL[shot.role] ?? shot.role.replaceAll("_", " ")}`}</strong>
                    <p className="line">{`"${shot.voiceover}"`}</p>
                    {frame && !clip && <p className={frame.qa_problem ? "check-warn" : "check-ok"}>{checkNote(frame.qa_problem)}</p>}
                    {clip?.status === "ready" && !clip.qa_problem && <p className="check-ok">Đoạn phim đã sẵn sàng.</p>}
                    {clip?.status === "failed" && <ErrorNote error={clip.error || new Error("Tác vụ gặp sự cố.")} message="Chưa tạo được đoạn phim cho cảnh này. Bạn có thể bấm Tạo lại đoạn phim." />}
                    {clip?.status === "ready" && clip.qa_problem && <p className="check-warn">{isUnchecked(clip.qa_problem) ? clip.qa_problem : `AI đề nghị kiểm tra lại: ${clip.qa_problem}`}</p>}
                    {clipNeedsLook(index) && (
                      <div className="stack" style={{ gap: 8 }}>
                        <span className="muted small">Tạo lại cảnh dùng thêm một lượt tạo đoạn phim.</span>
                        <div className="row">
                          <button className="btn btn-sm" style={{ flex: 1 }} disabled={clipBusy} onClick={() => remakeClip.mutate(index)}>{remakeClip.isPending && remakeClip.variables === index ? <><Spinner size={14} />Đang bắt đầu…</> : "Tạo lại đoạn phim"}</button>
                          {clip?.status === "ready" && <button className="btn btn-ok btn-sm" style={{ flex: 1 }} disabled={clipBusy} onClick={() => acceptClip.mutate(index)}>Dùng bản hiện tại</button>}
                        </div>
                        {clip?.status === "ready" && isUnchecked(clip.qa_problem) && <button className="btn btn-sm" disabled={recheckClip.isPending} onClick={() => recheckClip.mutate(index)}>Kiểm tra lại</button>}
                      </div>
                    )}
                    {frame && isUnchecked(frame.qa_problem) && !busy && <button className="btn btn-sm" disabled={recheck.isPending} onClick={() => recheck.mutate(index)}>{recheck.isPending && recheck.variables === index ? <><Spinner size={14} />Đang kiểm tra…</> : "Kiểm tra lại"}</button>}
                    {open ? (
                      <div className="stack" style={{ gap: 8 }}>
                        <label className="field" htmlFor={`note-${index}`}>Điểm nào cần chỉnh?</label>
                        <textarea id={`note-${index}`} className="input" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Có vệt mờ trên má, cánh tay trông quá dài." />
                        <div className="row">
                          <button className="btn btn-primary btn-sm" disabled={!note.trim() || redo.isPending} onClick={() => { redo.mutate({ index, text: note.trim() }); setNoteFor(null); setNote(""); }}>Chỉnh cảnh này</button>
                          <button className="btn btn-sm" onClick={() => setNoteFor(null)}>Hủy</button>
                        </div>
                        <span className="muted small">AI dùng góp ý này để tạo quy tắc cho các video tiếp theo.</span>
                      </div>
                    ) : clip ? null : frame && frame.status !== "failed" && !busy ? (
                      <div className="row">
                        <button className={isApproved ? "btn btn-sm" : "btn btn-ok btn-sm"} style={{ flex: 1 }} disabled={locked || review.isPending || (index > 0 && !masterApproved && !isApproved)} onClick={() => review.mutate({ index, status: isApproved ? "ready" : "approved" })}>{isApproved ? "Bỏ duyệt" : "Duyệt"}</button>
                        <button className="btn btn-sm" style={{ flex: 1 }} disabled={locked || (index > 0 && !masterApproved)} onClick={() => { setNoteFor(index); setNote(""); }}>Cần chỉnh</button>
                      </div>
                    ) : !busy && (
                      <button className="btn btn-sm" disabled={redo.isPending || (index > 0 && !masterApproved)} onClick={() => redo.mutate({ index, text: "" })}><RefreshCw size={14} aria-hidden="true" />Thử lại</button>
                    )}
                    {learned.includes(index) && !busy && <span className="check-ok">Đã lưu quy tắc để AI áp dụng cho các video sau.</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="studio-side" aria-label="Tiến độ">
          <div className="card pad stack">
            <h2>{record.brief.title}</h2>
            <p><strong>{`${approved}/${shots.length}`}</strong> cảnh đã duyệt</p>
            <div className="progress ok" role="progressbar" aria-valuenow={approved} aria-valuemin={0} aria-valuemax={shots.length} aria-label="Số cảnh đã duyệt"><div style={{ width: `${shots.length ? (approved / shots.length) * 100 : 0}%` }} /></div>
            {making ? (
              <div className="row" role="status" aria-live="polite" style={{ gap: 10 }}><Spinner size={18} /><strong>Đang tạo các cảnh còn lại…</strong></div>
            ) : makingVideo ? (
              <div className="row" role="status" aria-live="polite" style={{ gap: 10 }}><Spinner size={18} /><strong>{`${friendlyStep(run?.step ?? "")}…`}</strong></div>
            ) : masterApproved && frames.length < shots.length && (
              <button className="btn btn-primary btn-lg btn-block" disabled={start.isPending} onClick={() => start.mutate({ until: "images" })}>{start.isPending ? "Đang bắt đầu…" : "Tạo các cảnh còn lại"}</button>
            )}
            {making ? (
              <span className="muted small">Quá trình mất khoảng 8 phút. Bạn có thể rời trang và sẽ nhận thông báo khi hoàn tất.</span>
            ) : makingVideo ? (
              <span className="muted small">Quá trình mất khoảng 10 phút. Bạn có thể rời trang và sẽ nhận thông báo khi hoàn tất.</span>
            ) : hasVideo ? (
              <span className="muted small">Video đã sẵn sàng bên dưới.</span>
            ) : all && needsLook.length > 0 ? (
              <button className="btn btn-lg btn-block" disabled>{`Kiểm tra cảnh ${needsLook[0] + 1} trước`}</button>
            ) : all ? (
              <>
                <button className="btn btn-primary btn-lg btn-block" disabled={start.isPending} onClick={() => start.mutate({ until: "video" })}>{start.isPending ? "Đang bắt đầu…" : "Dựng video từ các cảnh này"}</button>
                <span className="muted small">Video thường mất khoảng 10 phút để dựng. Bạn có thể rời trang trong lúc chờ.</span>
              </>
            ) : (
              <button className="btn btn-lg btn-block" disabled>Duyệt tất cả cảnh để tiếp tục</button>
            )}
            <ErrorNote error={start.error} />
            {run && runStopped(run) && needsLook.length === 0 && <ErrorNote error={run.message || new Error("Lần chạy trước đã dừng.")} message={runStoppedMessage(run)} />}
          </div>
          {imageRules.length > 0 && (
            <div className="card pad stack">
              <h3>Quy tắc AI đang dùng khi tạo ảnh</h3>
              <ul className="stack" style={{ margin: 0, paddingLeft: 18, gap: 6 }}>{imageRules.map((rule) => <li key={rule.knowledge_id} className="small">{rule.title}</li>)}</ul>
              <Link className="link" to="/memory">Xem và chỉnh trong Bộ nhớ AI</Link>
            </div>
          )}
        </aside>
      </div>
      {lightbox.node}
    </>
  );
}
