import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, User } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorNote, Spinner } from "../../components/ui";
import { useLightbox } from "../../hooks/useLightbox";
import { API, usePeople, useStartPipeline } from "../../hooks/useStudio";
import { runStopped, runStoppedMessage } from "../../lib/studio";
import { deleteJson, postJson, putFile } from "../../services/http";
import type { BriefRecord, Persona, PipelineRun, Product } from "../../types/studio";

// Every scene is filmed for 15 seconds but plays about 13 in the video, so the length is not exact
const LENGTHS: Record<number, { scenes: number; about: number }> = { 15: { scenes: 1, about: 13 }, 30: { scenes: 2, about: 27 }, 45: { scenes: 3, about: 40 }, 60: { scenes: 4, about: 54 } };
const MINUTES: Record<number, number> = { 15: 5, 30: 8, 45: 11, 60: 14 };
const STYLES = ["Tự nhiên, đời thường", "Đánh giá chân thực", "Trước và sau", "Hướng dẫn nhanh"];

export function IdeaStep({ productId, product, productType, record, run }: { productId: string; product: Product; productType: string | null; record: BriefRecord | null; run: PipelineRun | undefined }) {
  const [, setParams] = useSearchParams();
  const [seconds, setSeconds] = useState(30);
  const [styles, setStyles] = useState<string[]>([STYLES[0]]);
  const [idea, setIdea] = useState(record?.user_idea ?? "");
  const client = useQueryClient();
  const people = usePeople();
  const start = useStartPipeline(productId);
  const startOver = useMutation({
    mutationFn: () => deleteJson(`${API}/${productId}/brief`),
    onSuccess: () => {
      for (const key of ["brief", "briefs", "keyframes", "clips", "video-info", "outputs", "pipeline"]) void client.invalidateQueries({ queryKey: [key] });
      setParams({});
    },
  });
  // every video follows the default person of the library; the user only sees "your photos"
  const chosen = people.data?.find((p) => p.default) ?? people.data?.[0];
  const needsPhoto = people.isSuccess && !(chosen && chosen.photos > 0);

  const begin = () => {
    const prefix = styles.length ? `Style: ${styles.join(", ").toLowerCase()}. ` : "";
    start.mutate({ until: "images", idea: `${prefix}${idea}`.trim(), video_seconds: seconds, persona_id: chosen?.id });
  };

  return (
    <>
      <header className="page-head"><div><h1>Bạn muốn video trông như thế nào?</h1><p>Nhập thông tin cơ bản để AI bắt đầu. Bạn có thể chỉnh từng cảnh ở bước sau.</p></div></header>
      {run && runStopped(run) && (
        <ErrorNote error={run.message || new Error("Lần chạy trước đã dừng.")} message={runStoppedMessage(run)} />
      )}
      <div className="studio-cols">
        <div className="studio-main">
          <section className="card pad product-line" aria-label="Sản phẩm">
            <div className="icon">{product.images[0] ? <img src={product.images[0]} alt="" referrerPolicy="no-referrer" /> : null}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 17 }}>{product.title}</h2>
              <span className="muted small">{product.seller?.name}</span>
            </div>
          </section>

          <PersonPhotos chosen={chosen} />

          <section className="card pad stack" aria-labelledby="len">
            <h2 id="len">Bạn muốn video dài bao lâu?</h2>
            <div className="row" role="group" aria-label="Thời lượng video">
              {Object.entries(LENGTHS).map(([key, { scenes, about }]) => {
                const n = Number(key);
                return <button key={n} type="button" className="chip" aria-pressed={seconds === n} onClick={() => setSeconds(n)}>{`${scenes} cảnh, khoảng ${about} giây`}</button>;
              })}
            </div>
            <p className="muted small">{`VideoAFF mất vài phút để tạo kịch bản và ảnh đầu tiên. Sau khi bạn duyệt các ảnh, thời gian dựng video khoảng ${MINUTES[seconds]} phút. Bạn có thể rời trang trong lúc chờ.`}</p>
          </section>

          <section className="card pad stack" aria-labelledby="idea">
            <h2 id="idea">Phong cách và ý tưởng <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>(không bắt buộc)</span></h2>
            <div className="row" role="group" aria-label="Phong cách">
              {STYLES.map((s) => (
                <button key={s} type="button" className="chip" aria-pressed={styles.includes(s)} onClick={() => setStyles(styles.includes(s) ? styles.filter((x) => x !== s) : [...styles, s])}>{s}</button>
              ))}
            </div>
            <label className="field">
              Bạn muốn bổ sung gì?
              <textarea rows={3} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Ví dụ: Một căn phòng nhỏ, ánh sáng cửa sổ, không khí gần gũi." />
            </label>
          </section>
        </div>

        <aside className="studio-side card pad" aria-label="Tóm tắt">
          <h2>AI sẽ làm gì tiếp theo?</h2>
          <ol className="muted" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Viết kịch bản bán hàng với giọng điệu trẻ trung và chọn ảnh tham khảo cho từng cảnh.</li>
            <li>Tạo ảnh cho cảnh đầu tiên và chờ bạn duyệt.</li>
            <li>Dựa vào ảnh đã duyệt để tạo các cảnh còn lại. Bạn duyệt từng ảnh.</li>
            <li>Dựng video, tạo lời đọc và viết mô tả bài đăng.</li>
          </ol>
          {record ? (
            <>
              <div className="notice"><div>Video này đang thực hiện.</div></div>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => setParams({})}>Tiếp tục phần đang làm</button>
              <button
                className="btn btn-block"
                disabled={startOver.isPending}
                onClick={() => {
                  if (window.confirm("Tạo kịch bản mới sẽ xóa kịch bản, ảnh cảnh, đoạn phim và video hiện có của dự án này. Sản phẩm và ảnh nhân vật vẫn được giữ. Bạn muốn tiếp tục?")) startOver.mutate();
                }}
              >
                {startOver.isPending ? "Đang xóa…" : "Viết kịch bản mới"}
              </button>
              <ErrorNote error={startOver.error} />
            </>
          ) : (
            <button className="btn btn-primary btn-lg btn-block" disabled={start.isPending || !productType || needsPhoto} onClick={begin}>
              {start.isPending ? <><Spinner />Đang bắt đầu…</> : needsPhoto ? "Hãy thêm ảnh nhân vật trước" : productType ? "Bắt đầu tạo video" : "Đang chuẩn bị sản phẩm…"}
            </button>
          )}
          <ErrorNote error={start.error} />
        </aside>
      </div>
    </>
  );
}

const MAX_PHOTOS = 3; // only this many photos of the person reach the image model

function PersonPhotos({ chosen }: { chosen: Persona | undefined }) {
  const client = useQueryClient();
  const lightbox = useLightbox();
  const refresh = () => client.invalidateQueries({ queryKey: ["persona"] });
  const photos = chosen?.photos ?? 0;
  const upload = useMutation({
    // the first person is created on the first upload; "replace" starts the photos over
    mutationFn: async ({ files, replace }: { files: File[]; replace: boolean }) => {
      const person = chosen ?? (await postJson<Persona>(`${API}/persona`, { name: "Tôi" }));
      const room = replace ? MAX_PHOTOS : MAX_PHOTOS - photos;
      for (const [index, file] of files.slice(0, room).entries()) {
        const add = replace ? index > 0 : index > 0 || photos > 0;
        await putFile(`${API}/persona/${person.id}/image?rights=confirmed${add ? "&add=true" : ""}`, file);
      }
    },
    onSuccess: refresh,
  });
  const sources = Array.from({ length: photos }, (_, index) => ({ src: `${API}/persona/${chosen?.id}/image?n=${index}&v=${chosen?.attempts}` }));
  const pick = (replace: boolean) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) upload.mutate({ files, replace });
    event.target.value = "";
  };
  return (
    <section className="card pad stack" aria-labelledby="who">
      <div>
        <h2 id="who">Ai xuất hiện trong video?</h2>
        <p className="muted small">{`Tải 1 đến ${MAX_PHOTOS} ảnh rõ mặt. VideoAFF giữ cùng một nhân vật qua các cảnh và có thể đổi trang phục hoặc bối cảnh.`}</p>
      </div>
      <div className="slots">
        {sources.map((source, index) => (
          <div className="slot" key={source.src}><img src={source.src} alt={`Ảnh ${index + 1}`} {...lightbox.zoom(sources, index)} /></div>
        ))}
        {photos === 0 && <div className="slot" aria-hidden="true"><User size={32} /></div>}
        {photos < MAX_PHOTOS && (
          <label className="slot slot-add">
            {upload.isPending ? <Spinner /> : <Plus size={22} aria-hidden="true" />}
            {upload.isPending ? "Đang tải lên" : "Thêm ảnh"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={upload.isPending} onChange={pick(false)} />
          </label>
        )}
      </div>
      {photos > 0 && (
        <label className="link">
          Đổi ảnh
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={upload.isPending} onChange={pick(true)} />
        </label>
      )}
      <ErrorNote error={upload.error} />
      {lightbox.node}
    </section>
  );
}
