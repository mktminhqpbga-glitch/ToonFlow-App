import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Empty, ErrorNote, PageHead, Skeleton } from "../components/ui";
import { pilotApi } from "../services/pilotApi";

const titles: Record<string, string> = {
  "The script is ready to read": "Kịch bản đã sẵn sàng",
  "The images are ready to review": "Ảnh đã sẵn sàng để duyệt",
  "The video is ready": "Video đã sẵn sàng",
  "The video needs a look": "Video cần bạn kiểm tra",
  "The video could not be made": "Chưa tạo được video",
};

export function NotificationsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["notifications"], queryFn: ({ signal }) => pilotApi.notifications(false, signal), refetchInterval: 15000 });
  const markRead = useMutation({ mutationFn: pilotApi.markNotificationRead, onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }) });
  if (query.isLoading) return <div className="page"><Skeleton /></div>;
  if (query.error || !query.data) return <div className="page"><ErrorNote error={query.error ?? new Error("Chưa có dữ liệu")} /></div>;
  return (
    <div className="page">
      <PageHead title="Thông báo" text="Xem các mục cần bạn duyệt và video đã hoàn thành." actions={query.data.unread > 0 ? <span className="pill pill-warn">{`${query.data.unread} chưa đọc`}</span> : undefined} />
      {query.data.items.length === 0 && <Empty icon={<Bell size={32} aria-hidden="true" />} title="Chưa có thông báo mới" text="Các cập nhật về tiến độ và mục cần duyệt sẽ xuất hiện ở đây." />}
      <div className="stack">
        {query.data.items.map((item) => (
          <div key={item.notification_id} className={`card note-row${item.read_at ? "" : " unread"}`}>
            <div className="copy">
              <strong>{titles[item.title] ?? item.title}</strong>
              {["pipeline_paused", "pipeline_failed"].includes(item.kind) ? <details className="muted"><summary>Chi tiết</summary>{item.detail}</details> : <p className="muted">{item.detail}</p>}
              <span className="muted small">{new Date(item.created_at).toLocaleString("vi-VN")}</span>
            </div>
            {!item.read_at && <button className="btn btn-sm" disabled={markRead.isPending} onClick={() => markRead.mutate(item.notification_id)}><Check size={14} aria-hidden="true" />Đánh dấu đã đọc</button>}
            {item.action_path && <Link className="btn btn-primary btn-sm" to={item.action_path}>Mở</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
