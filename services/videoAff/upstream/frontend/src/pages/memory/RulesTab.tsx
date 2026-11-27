import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Power, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ErrorNote, Skeleton, Spinner } from "../../components/ui";
import { useWorkspace } from "../../hooks/useWorkspace";
import { pilotApi } from "../../services/pilotApi";
import type { CreativeKnowledge, CreativeKnowledgeStage } from "../../types/pilotApi";

const REVIEWER = "user";
const MANIFEST = "product_ad";
type Asset = "brief" | "keyframe";

const GROUPS = [
  { asset: "brief", title: "Kịch bản và lời đọc" },
  { asset: "keyframe", title: "Ảnh" },
  { asset: "", title: "Khác" },
];
const STAGES: Record<Asset, CreativeKnowledgeStage[]> = {
  brief: ["preparation", "review"],
  keyframe: ["orchestration", "review"],
};

function plain(content: string) {
  const match = /^WHEN:\s*(.*?)\s*DO:\s*(.*?)(?:\s*DO NOT:\s*(.*))?$/s.exec(content);
  return match ? { when: match[1], doText: match[2], dont: match[3] } : null;
}

export function RulesTab() {
  const { notify } = useWorkspace();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [asset, setAsset] = useState<Asset>("keyframe");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const knowledge = useQuery({ queryKey: ["creative-knowledge"], queryFn: ({ signal }) => pilotApi.creativeKnowledge(undefined, signal) });
  const refresh = () => client.invalidateQueries({ queryKey: ["creative-knowledge"] });

  useEffect(() => {
    // The server loads them when it starts; this does nothing when they are already there.
    pilotApi
      .bootstrapCreativeKnowledge("system", MANIFEST)
      .then(() => client.invalidateQueries({ queryKey: ["creative-knowledge"] }))
      .catch(() => notify("Không tải được quy tắc mặc định. Hãy thử tải lại trang.", "error"));
  }, [client, notify]);

  const { pending, active } = useMemo(() => {
    const items = knowledge.data?.items ?? [];
    return {
      pending: items.filter((item) => item.status === "proposed" || item.status === "draft"),
      active: items.filter((item) => item.status === "approved"),
    };
  }, [knowledge.data?.items]);

  const decide = useMutation({
    mutationFn: async ({ ids, value }: { ids: string[]; value: "approved" | "rejected" }) => {
      for (const id of ids) await pilotApi.decideCreativeKnowledge(id, value, REVIEWER);
    },
    onSuccess: refresh,
  });
  const turnOff = useMutation({ mutationFn: (id: string) => pilotApi.retireCreativeKnowledge(id), onSuccess: refresh });
  const save = useMutation({
    mutationFn: async (body: { item?: CreativeKnowledge; content: string; asset: Asset }) => {
      const saved = await pilotApi.proposeCreativeKnowledge({
        knowledge_id: body.item?.knowledge_id,
        knowledge_type: body.item?.knowledge_type ?? "lesson",
        title: body.item?.title ?? body.content.slice(0, 80),
        content: body.content,
        scope: body.item?.scope ?? { task_type: "product_ad", asset_type: body.asset },
        authority: body.item?.authority ?? "individual",
        source_refs: body.item?.source_refs ?? ["feedback:manual"],
        evidence_refs: [],
        applies_to: body.item?.applies_to ?? STAGES[body.asset],
        contributor: REVIEWER,
        non_conclusions: [],
      });
      await pilotApi.decideCreativeKnowledge(saved.knowledge_id, "approved", REVIEWER);
    },
    onSuccess: () => {
      setText("");
      setEditing(null);
      notify("Đã lưu. AI sẽ áp dụng từ video tiếp theo.", "success");
      return refresh();
    },
  });

  const learn = useMutation({
    mutationFn: (file: File) => pilotApi.learnFromExampleAd(file),
    onSuccess: ({ rules }) => {
      notify(`AI đề xuất ${rules.length} quy tắc. Xem và duyệt những quy tắc phù hợp ở bên dưới.`, "success");
      return refresh();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) save.mutate({ content: text.trim(), asset });
  };

  const card = (item: CreativeKnowledge, waiting: boolean) => {
    const parts = plain(item.content);
    const isEditing = editing?.id === item.knowledge_id;
    return (
      <article className="card rule" key={item.knowledge_id}>
        <h3>{item.title}</h3>
        {isEditing ? (
          <>
            <textarea aria-label="Nội dung quy tắc" value={editing.text} rows={5} onChange={(event) => setEditing({ id: editing.id, text: event.target.value })} />
            <div className="row">
              <button className="btn btn-primary btn-sm" disabled={!editing.text.trim() || save.isPending} onClick={() => save.mutate({ item, content: editing.text.trim(), asset: "keyframe" })}>Lưu</button>
              <button className="btn btn-sm" onClick={() => setEditing(null)}>Hủy</button>
            </div>
          </>
        ) : (
          <>
            {parts ? (
              <ul>
                <li><span className="muted">Khi</span> {parts.when}</li>
                <li className="do"><Check size={14} aria-hidden="true" /> {parts.doText}</li>
                {parts.dont && <li className="dont"><X size={14} aria-hidden="true" /> {parts.dont}</li>}
              </ul>
            ) : <p className="small">{item.content}</p>}
            <div className="row">
              {waiting ? (
                <>
                  <button className="btn btn-ok btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ ids: [item.knowledge_id], value: "approved" })}><Check size={14} aria-hidden="true" />Duyệt</button>
                  <button className="btn btn-sm" disabled={decide.isPending} onClick={() => decide.mutate({ ids: [item.knowledge_id], value: "rejected" })}><X size={14} aria-hidden="true" />Từ chối</button>
                </>
              ) : (
                <>
                  <button className="btn btn-sm" onClick={() => setEditing({ id: item.knowledge_id, text: item.content })}><Pencil size={14} aria-hidden="true" />Sửa</button>
                  <button className="btn btn-sm" disabled={turnOff.isPending} onClick={() => turnOff.mutate(item.knowledge_id)}><Power size={14} aria-hidden="true" />Tắt</button>
                </>
              )}
            </div>
          </>
        )}
      </article>
    );
  };

  return (
    <div className="stack-lg">
      <form className="card pad stack" onSubmit={submit}>
        <label className="field">
          Thêm quy tắc
          <textarea value={text} rows={3} onChange={(event) => setText(event.target.value)} placeholder="Ví dụ: Làm sáng nhẹ khuôn mặt khi quay thiếu sáng." />
        </label>
        <div className="row">
          <select className="input" style={{ width: "auto" }} value={asset} onChange={(event) => setAsset(event.target.value as Asset)} aria-label="Áp dụng quy tắc cho">
            <option value="keyframe">Cho ảnh</option>
            <option value="brief">Cho kịch bản và lời đọc</option>
          </select>
          <button className="btn btn-primary" type="submit" disabled={!text.trim() || save.isPending}>{save.isPending ? <><Spinner size={14} />Đang lưu…</> : "Thêm quy tắc"}</button>
        </div>
      </form>
      <section className="card pad stack">
        <h2>Học từ video quảng cáo mẫu</h2>
        <p className="small muted">
          Chọn video quảng cáo mẫu (MP4, tối đa 100 MB và 3 phút). AI sẽ phân tích cách mở đầu, nhịp dựng, vị trí chữ và cách kết thúc.
          Bạn có thể duyệt từng đề xuất bên dưới trước khi áp dụng. Video mẫu chỉ dùng để phân tích.
        </p>
        <label className="btn" style={{ width: "fit-content" }}>
          {learn.isPending ? <><Spinner size={14} />Đang phân tích…</> : <><Upload size={14} aria-hidden="true" />Chọn video</>}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            hidden
            disabled={learn.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) learn.mutate(file);
            }}
          />
        </label>
      </section>
      <ErrorNote error={decide.error ?? turnOff.error ?? save.error ?? learn.error} />

      {pending.length > 0 && (
        <section className="card pad stack" style={{ borderColor: "var(--brand)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>{pending.length === 1 ? "1 quy tắc chờ duyệt" : `${pending.length} quy tắc chờ duyệt`}</h2>
            <button className="btn btn-primary" disabled={decide.isPending} onClick={() => decide.mutate({ ids: pending.map((item) => item.knowledge_id), value: "approved" })}>
              <Check size={15} aria-hidden="true" />{decide.isPending ? "Đang duyệt…" : "Duyệt tất cả"}
            </button>
          </div>
          <div className="rule-grid">{pending.map((item) => card(item, true))}</div>
        </section>
      )}

      {knowledge.isLoading && <Skeleton />}
      {knowledge.isError && <ErrorNote error={knowledge.error} />}
      {GROUPS.map(({ asset: key, title }) => {
        const rows = active.filter((item) => (item.scope.asset_type ?? "") === key);
        if (!rows.length) return null;
        return (
          <section key={key || "other"} className="stack">
            <h2>{title}</h2>
            <div className="rule-grid">{rows.map((item) => card(item, false))}</div>
          </section>
        );
      })}
      {!knowledge.isLoading && pending.length === 0 && active.length === 0 && <p className="muted">Chưa có quy tắc. Bạn có thể thêm quy tắc ở trên.</p>}
    </div>
  );
}
