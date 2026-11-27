import { useQuery } from "@tanstack/react-query";
import { Film, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHead, Skeleton, Spinner } from "../components/ui";
import { API, useBriefs, useKeyframes, useOutputs, usePipeline, useProducts, useVideoInfo } from "../hooks/useStudio";
import { friendlyStep, imagesApproved, productOf, runStopped } from "../lib/studio";
import { pilotApi } from "../services/pilotApi";
import type { BriefRecord, OutputItem, Product } from "../types/studio";

export function HomePage() {
  const briefs = useBriefs();
  const outputs = useOutputs();
  const products = useProducts();
  const rules = useQuery({ queryKey: ["creative-knowledge"], queryFn: ({ signal }) => pilotApi.creativeKnowledge(undefined, signal) });
  if (briefs.isLoading || outputs.isLoading) return <div className="page"><Skeleton /></div>;
  const finished = outputs.data ?? [];
  const finishedIds = new Set(finished.map((item) => item.product_id));
  const working = (briefs.data ?? []).filter((record) => !finishedIds.has(record.product_id));
  const productById = new Map((products.data ?? []).map((product) => [product.product_id, product]));
  const waiting = (rules.data?.items ?? []).filter((item) => item.status === "proposed").length;

  return (
    <div className="page">
      <PageHead
        title="Hôm nay bạn muốn làm video gì?"
        text="Chọn sản phẩm để AI viết kịch bản, tạo ảnh và dựng video. Bạn xem và duyệt từng cảnh."
        actions={<Link className="btn btn-primary btn-lg" to="/products"><Plus size={20} aria-hidden="true" />Tạo video mới</Link>}
      />

      {waiting > 0 && (
        <Link to="/memory" className="card todo">
          <span className="icon"><Sparkles size={20} aria-hidden="true" /></span>
          <div>
            <strong>{waiting === 1 ? "Có 1 quy tắc mới cần duyệt" : `Có ${waiting} quy tắc mới cần duyệt`}</strong>
            <p className="muted">Duyệt quy tắc để AI áp dụng cho các video tiếp theo.</p>
          </div>
        </Link>
      )}

      {working.length > 0 && (
        <section className="stack" aria-labelledby="working">
          <h2 id="working">Đang thực hiện</h2>
          {working.map((record) => <WorkCard key={record.product_id} record={record} product={productById.get(productOf(record.product_id))} />)}
        </section>
      )}

      <section className="stack" aria-labelledby="done">
        <h2 id="done">Video đã hoàn thành</h2>
        {finished.length ? (
          <div className="video-grid">{finished.slice(0, 6).map((item) => <VideoCard key={item.product_id} item={item} />)}</div>
        ) : (
          <div className="card empty">
            <Film size={32} aria-hidden="true" />
            <h2>Chưa có video hoàn thành</h2>
            <p>Video sẽ xuất hiện ở đây khi có thể tải xuống.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function WorkCard({ record, product }: { record: BriefRecord; product: Product | undefined }) {
  const pipeline = usePipeline(record.product_id);
  const keyframes = useKeyframes(record.product_id);
  const video = useVideoInfo(record.product_id);
  const running = pipeline.data?.status === "running";
  const frames = keyframes.data ?? [];
  const total = record.brief.shots?.length ?? 0;
  const approved = frames.filter((frame) => frame.status === "approved").length;
  const allApproved = imagesApproved(record, frames);
  const needsReview = frames.length > 0 && !allApproved;
  const hasVideo = !!video.data?.exists;
  const percent = hasVideo ? 100 : allApproved ? 60 : frames.length ? 40 : 15;
  const status = running
    ? friendlyStep(pipeline.data?.step ?? "")
    : runStopped(pipeline.data)
      ? "Đã dừng, cần kiểm tra"
      : needsReview
        ? `Đã duyệt ${approved}/${total} ảnh`
        : hasVideo
          ? "Video đã sẵn sàng"
          : allApproved
            ? "Sẵn sàng dựng video"
            : "Kịch bản đã sẵn sàng";
  return (
    <div className="card work-card">
      {product?.images[0] && <img src={product.images[0]} alt="" referrerPolicy="no-referrer" />}
      <div className="info">
        <div className="row">
          <strong style={{ fontSize: 18 }}>{record.brief.title}</strong>
          {running ? <span className="pill"><Spinner size={13} />&nbsp;AI đang xử lý</span> : needsReview ? <span className="pill pill-warn">Cần bạn duyệt</span> : null}
        </div>
        <p className="muted">{running ? `${status}. Bạn có thể rời trang. Tác vụ vẫn tiếp tục.` : status}</p>
        <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ"><div style={{ width: `${percent}%` }} /></div>
      </div>
      <Link className="btn btn-primary" to={`/studio/${record.product_id}`}>{needsReview ? "Duyệt ảnh" : "Mở"}</Link>
    </div>
  );
}

export function VideoCard({ item }: { item: OutputItem }) {
  return (
    <Link to={`/studio/${item.product_id}`} className="video-card">
      <div className="cover">
        <img src={item.has_cover ? `${API}/${item.product_id}/cover` : (item.image ?? "")} alt="" loading="lazy" referrerPolicy="no-referrer" />
        {item.seconds ? <span className="badge">{`${Math.round(item.seconds)} sec`}</span> : null}
      </div>
      <div>
        <strong>{item.title ?? item.product_title ?? item.product_id}</strong>
        <span className="muted small">{`${item.shots} cảnh${item.built_at ? `, ${new Date(item.built_at).toLocaleDateString("vi-VN")}` : ""}`}</span>
      </div>
    </Link>
  );
}
