import { useQuery } from "@tanstack/react-query";
import { Bell, Film, FolderOpen, Home, Menu, Moon, Package, Sparkles, Sun, Users } from "lucide-react";
import { Suspense, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";
import { useTheme } from "../hooks/useTheme";
import { pilotApi } from "../services/pilotApi";
import { Skeleton } from "./ui";

const NAV = [
  { to: "/", label: "Tổng quan", icon: Home, end: true },
  { to: "/products", label: "Sản phẩm", icon: Package, end: false },
  { to: "/videos", label: "Video của tôi", icon: Film, end: false },
  { to: "/memory", label: "Bộ nhớ AI", icon: Sparkles, end: false },
];
const embedded = window.parent !== window && import.meta.env.BASE_URL !== "/dashboard/";

export function Shell() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const rules = useQuery({ queryKey: ["creative-knowledge"], queryFn: ({ signal }) => pilotApi.creativeKnowledge(undefined, signal) });
  const learned = (rules.data?.items ?? []).filter((item) => item.status === "approved").length;
  return (
    <div className={`app${embedded ? " inMacFlow" : ""}`}>
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Menu chính">
        {!embedded && <div className="brand"><span className="brand-mark" aria-hidden="true">VA</span>VideoAFF</div>}
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
              <Icon size={20} aria-hidden="true" />{label}
            </NavLink>
          ))}
          {embedded && <NavLink to="/notifications"><Bell size={20} aria-hidden="true" />Thông báo
            {Boolean(notifications.data?.unread) && <span className="navCount" aria-label="Thông báo chưa đọc">{notifications.data?.unread}</span>}
          </NavLink>}
          {embedded && <button className="libraryAction" type="button" onClick={() => window.parent.postMessage({ type: "macflow:videoAff/openLibrary" }, window.location.origin)}>
            <FolderOpen size={20} aria-hidden="true" />Kho tài nguyên
          </button>}
          {embedded && <button className="libraryAction" type="button" aria-label="Kho nhân vật tham chiếu" onClick={() => window.parent.postMessage({ type: "macflow:videoAff/openCharacters" }, window.location.origin)}>
            <Users size={20} aria-hidden="true" />Kho nhân vật
          </button>}
        </nav>
        <div className="side-note">
          <strong>{learned === 1 ? "AI áp dụng 1 quy tắc" : `AI áp dụng ${learned} quy tắc`}</strong>
          AI dùng góp ý của bạn để tránh lặp lại lỗi trong video sau.
        </div>
      </aside>
      <div className="main">
        {!embedded && <header className="topbar">
          <button className="icon-button menu-button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(!open)}><Menu size={22} /></button>
          <button className="icon-button" aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <NavLink to="/notifications" className="icon-button" aria-label="Thông báo">
            <Bell size={20} />{(notifications.data?.unread ?? 0) > 0 && <span className="dot" />}
          </NavLink>
        </header>}
        <Suspense fallback={<div className="page"><Skeleton /></div>}><Outlet /></Suspense>
      </div>
    </div>
  );
}
