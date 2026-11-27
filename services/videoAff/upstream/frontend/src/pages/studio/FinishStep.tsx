import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import { useState } from "react";
import { ErrorNote } from "../../components/ui";
import { API } from "../../hooks/useStudio";
import { getJson, postJson } from "../../services/http";
import type { BriefRecord, PostPackage } from "../../types/studio";

type Usage = { by_operation: { key: string; request_count: number }[] };
const USED = { keyframe: "images", clip: "clips", voiceover: "bản thu lời đọc" } as Record<string, string>;
const linkKey = (productId: string) => `aic-affiliate-${productId}`;
const readLink = (productId: string) => {
  try {
    return window.localStorage.getItem(linkKey(productId)) ?? "";
  } catch {
    return "";
  }
};

export function FinishStep({ productId, record, hasVideo }: { productId: string; record: BriefRecord; hasVideo: boolean }) {
  const client = useQueryClient();
  const [copied, setCopied] = useState("");
  const [link, setLink] = useState(() => readLink(productId));
  const [review, setReview] = useState("");
  const pack = record.brief.post_package;
  const usage = useQuery({ queryKey: ["usage", productId], queryFn: ({ signal }) => getJson<Usage>(`/api/v1/ai-usage/summary?correlation_id=${productId}`, signal) });
  const used = (usage.data?.by_operation ?? []).filter((item) => USED[item.key]);

  const writePack = useMutation({
    mutationFn: () => postJson<PostPackage>(`${API}/${productId}/post-package`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["brief", productId] }),
  });
  const sendReview = useMutation({
    mutationFn: () => postJson<{ status: string }>(`${API}/${productId}/feedback`, { text: review.trim(), asset_type: "brief" }),
    onSuccess: () => setReview(""),
  });

  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1800);
    });
  };
  const saveLink = (value: string) => {
    setLink(value);
    try {
      window.localStorage.setItem(linkKey(productId), value);
    } catch {
      /* the link is just not remembered */
    }
  };

  // Before the video exists, everything is on the scenes page above
  if (!hasVideo) return null;

  const withLink = (text: string) => (link.trim() ? `${text}\n${link.trim()}` : text);
  return (
    <>
      <header className="page-head"><div><h1>Video của bạn đã sẵn sàng</h1><p>Xem trước và tải video để đăng lên TikTok.</p></div></header>
      <div className="finish">
        <div className="stack" style={{ alignItems: "center", flex: "0 0 300px" }}>
          <div className="phone"><div className="screen"><video src={`${API}/${productId}/video`} poster={`${API}/${productId}/cover`} controls playsInline /></div></div>
        </div>

        <div className="right">
          <div className="card pad stack">
            <div className="row">
              <span className="pill">{`${record.brief.shots?.length ?? 0} scenes`}</span>
              <span className="pill">Có lời đọc</span>
            </div>
            {used.length > 0 && <p className="muted small">{`Tạo bằng ${used.map((item) => `${item.request_count} ${USED[item.key]}`).join(", ")}`}</p>}
            <div className="row">
              <a className="btn btn-primary btn-lg" href={`${API}/${productId}/video?download=true`}><Download size={18} aria-hidden="true" />Tải video</a>
              <a className="btn btn-lg" href={`${API}/${productId}/cover?download=true`}>Tải ảnh bìa</a>
            </div>
            <div className="stack">
              <label className="field">
                <span className="small">Bạn muốn cải thiện điều gì ở video sau?</span>
                <textarea rows={2} value={review} onChange={(event) => setReview(event.target.value)} placeholder="Ví dụ: Mở đầu hơi chậm. Hãy bắt đầu bằng một câu hỏi." />
              </label>
              <div className="row">
                <button className="btn btn-sm" disabled={!review.trim() || sendReview.isPending} onClick={() => sendReview.mutate()}>Gửi vào Bộ nhớ AI</button>
                {sendReview.isSuccess && <span className="muted small">{sendReview.data?.status === "approved" ? "Đã lưu quy tắc. AI sẽ áp dụng từ video tiếp theo." : "Đã gửi vào Bộ nhớ AI để chuyển thành quy tắc."}</span>}
              </div>
              <ErrorNote error={sendReview.error} />
            </div>
          </div>

          <div className="card pad stack">
            <h2>Mô tả bài đăng và hashtag</h2>
            {pack ? (
              <>
                {pack.captions.map((caption, index) => (
                  <div className="caption-box" key={index}>
                    <p>{caption}</p>
                    <button className="btn btn-sm" onClick={() => copy(`c${index}`, withLink(caption))}><Copy size={14} aria-hidden="true" />{copied === `c${index}` ? "Đã chép" : link.trim() ? "Sao chép kèm liên kết" : "Sao chép"}</button>
                  </div>
                ))}
                <div className="caption-box">
                  <p>{pack.hashtags.join(" ")}</p>
                  <button className="btn btn-sm" onClick={() => copy("tags", pack.hashtags.join(" "))}><Copy size={14} aria-hidden="true" />{copied === "tags" ? "Đã chép" : "Sao chép"}</button>
                </div>
                <label className="field">Liên kết tiếp thị của bạn<input type="text" value={link} onChange={(event) => saveLink(event.target.value)} placeholder="Dán liên kết ở đây" /></label>
              </>
            ) : (
              <>
                <p className="muted">AI sẽ viết mô tả bài đăng và hashtag phù hợp với video.</p>
                <div><button className="btn btn-primary" disabled={writePack.isPending} onClick={() => writePack.mutate()}>{writePack.isPending ? "Đang viết…" : "Viết mô tả bài đăng và hashtag"}</button></div>
              </>
            )}
            <ErrorNote error={writePack.error} />
          </div>
        </div>
      </div>
    </>
  );
}
