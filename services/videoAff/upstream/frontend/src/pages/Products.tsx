import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Chrome, Download, Package, Search, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Empty, ErrorNote, PageHead, Skeleton } from "../components/ui";
import { API, useBriefs, useProducts } from "../hooks/useStudio";
import { newProjectId, productOf, toNumber, vnd } from "../lib/studio";
import { apiRoot, deleteJson, getJson, postJson } from "../services/http";
import type { Product } from "../types/studio";

const SORTS = {
  sold: (product: Product) => toNumber(product.sold_count),
  rating: (product: Product) => Number(product.rating) || 0,
} as const;
type SortKey = keyof typeof SORTS;
const marketplaceName = { shopee_vn: "Shopee", tiktok_shop_vn: "TikTok Shop" } as const;
const marketplaceOf = (product: Product) => product.source === "shopee_vn" ? "shopee_vn" : "tiktok_shop_vn";

export function ProductsPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("sold");
  const [category, setCategory] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const products = useProducts();
  const briefs = useBriefs();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["product-selections"] });
  };
  const start = useMutation({
    mutationFn: (productId: string) => postJson(`${API}/${productId}/select`),
    onSuccess: (_data, productId) => {
      refresh();
      navigate(`/studio/${newProjectId(productId)}`);
    },
  });
  const remove = useMutation({
    mutationFn: (productId: string) => deleteJson(`${API}/${productId}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["products"] });
      refresh();
    },
  });
  const waiting = useQuery({
    queryKey: ["products-waiting"],
    queryFn: ({ signal }) => getJson<string[]>(`${API}/queue?limit=100000`, signal),
    refetchInterval: 15000,
  });
  const media = useMutation({ mutationFn: () => postJson<{ downloaded: number }>(`${API}/media/download`) });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (products.data ?? [])
      .filter((product) => !marketplace || marketplaceOf(product) === marketplace)
      .filter((product) => !category || product.category === category)
      .filter((product) => !needle || `${product.title} ${product.seller?.name}`.toLowerCase().includes(needle))
      .sort((a, b) => SORTS[sort](b) - SORTS[sort](a));
  }, [products.data, search, sort, category, marketplace]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products.data ?? []) if (product.category) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [products.data]);

  if (products.isLoading) return <div className="page"><Skeleton /></div>;
  if (products.error || !products.data) {
    return <div className="page"><ErrorNote error={products.error ?? new Error("Chưa có dữ liệu")} /></div>;
  }
  const briefIds = new Set((briefs.data ?? []).map((record) => productOf(record.product_id)));

  return (
    <div className="page page-wide">
      <PageHead
        title="Sản phẩm"
        text="Chọn sản phẩm từ Shopee hoặc TikTok Shop để tạo video."
        actions={
          <>
            <a className="btn btn-primary" href={`${apiRoot}/extension/download`} download>
              <Download size={16} aria-hidden="true" />Tải tiện ích Chrome
            </a>
            <a className="btn" href={`${API}/export?format=xlsx`}>
              <Download size={16} aria-hidden="true" />Tải Excel
            </a>
          </>
        }
      />
      <ErrorNote error={start.error ?? remove.error} />

      {products.data.length > 0 && (
        <div className="toolbar">
          <label className="sr-only" htmlFor="product-search">Tìm sản phẩm</label>
          <div style={{ position: "relative" }}>
            <Search size={16} aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
            <input id="product-search" className="input" style={{ paddingLeft: 36 }} type="search" placeholder="Tìm theo tên sản phẩm hoặc cửa hàng" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <label className="row">
            <span className="muted small">Nguồn sản phẩm</span>
            <select className="input" style={{ width: "auto" }} value={marketplace} onChange={(event) => setMarketplace(event.target.value)}>
              <option value="">Tất cả nguồn</option>
              {Object.entries(marketplaceName).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          {categories.length > 0 && (
            <label className="row">
              <span className="muted small">Danh mục</span>
              <select className="input" style={{ width: "auto" }} value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{`Tất cả (${products.data.length})`}</option>
                {categories.map(([name, count]) => <option key={name} value={name}>{`${name} (${count})`}</option>)}
              </select>
            </label>
          )}
          <label className="row">
            <span className="muted small">Sắp xếp</span>
            <select className="input" style={{ width: "auto" }} value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="sold">Bán chạy nhất</option>
              <option value="rating">Đánh giá cao nhất</option>
            </select>
          </label>
          <span className="muted small">{`${rows.length}/${products.data.length} sản phẩm`}</span>
          {!!waiting.data?.length && <span className="muted small">{`${waiting.data.length} sản phẩm đang chờ lấy thông tin`}</span>}
        </div>
      )}

      {rows.length ? (
        <div className="product-grid">
          {rows.map((product) => {
            const hasVideoWork = briefIds.has(product.product_id);
            return (
              <article className="card product-card" key={product.product_id}>
                <div className="thumb">
                  {product.images[0] ? <img src={product.images[0]} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Package size={28} />}
                  {product.price.sale && <span className="price">{vnd(product.price.sale)}</span>}
                </div>
                <div className="body">
                  <a className="title" href={product.url.split("?")[0]} target="_blank" rel="noreferrer" title={product.title ?? ""}>{product.title}</a>
                  <span className="muted small">{[marketplaceName[marketplaceOf(product)], product.seller?.name].filter(Boolean).join(" · ")}</span>
                  {(product.sold_count != null || product.rating) && <span className="small">{[
                    product.sold_count != null && `${toNumber(product.sold_count).toLocaleString("vi-VN")} lượt bán`,
                    product.rating && `★ ${product.rating}`,
                  ].filter(Boolean).join(" · ")}</span>}
                  <div className="foot">
                    <button className="btn btn-primary btn-block" disabled={start.isPending} onClick={() => start.mutate(product.product_id)}>
                      <Sparkles size={16} aria-hidden="true" />{hasVideoWork ? "Tạo video khác" : "Tạo video"}
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Xóa sản phẩm"
                      title="Xóa sản phẩm"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm("Xóa sản phẩm và mọi nội dung đã tạo từ sản phẩm này? VideoAFF sẽ bỏ qua sản phẩm này trong những lần thu thập sau.")) remove.mutate(product.product_id);
                      }}
                    ><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon={<Package size={32} aria-hidden="true" />} title={products.data.length ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm"} text={products.data.length ? "Thử từ khóa hoặc bộ lọc khác." : "Thêm sản phẩm từ Shopee hoặc TikTok Shop qua ba bước."}>
          {!products.data.length && (
            <div className="steps-3">
              <div className="card"><span className="num">1</span><Chrome size={20} aria-hidden="true" /><strong>Cài tiện ích Chrome</strong><span className="muted small">Tải và giải nén tệp ZIP. Mở <code>chrome://extensions</code>, bật Chế độ dành cho nhà phát triển rồi chọn Tải tiện ích đã giải nén. Chọn thư mục <strong>VideoAFF-Collector</strong>.</span></div>
              <div className="card"><span className="num">2</span><ShoppingBag size={20} aria-hidden="true" /><strong>Mở Shopee hoặc TikTok Shop</strong><span className="muted small">Mở trang chi tiết sản phẩm bạn muốn quảng bá và chờ ảnh tải xong.</span></div>
              <div className="card"><span className="num">3</span><Sparkles size={20} aria-hidden="true" /><strong>Gửi sản phẩm vào VideoAFF</strong><span className="muted small">Mở tiện ích, bấm Gửi sản phẩm này rồi quay lại trang Sản phẩm.</span></div>
            </div>
          )}
        </Empty>
      )}

      <details>
        <summary className="muted small" style={{ cursor: "pointer" }}>Công cụ khác</summary>
        <div className="row" style={{ marginTop: 12 }}>
          <a className="btn btn-sm" href={`${API}/export?format=json`}>Tải JSON</a>
          <button className="btn btn-sm" disabled={media.isPending} onClick={() => media.mutate()}>{media.isPending ? "Đang lưu ảnh…" : "Lưu ảnh sản phẩm vào VideoAFF"}</button>
          {media.data && <span className="muted small">{`Đã lưu ${media.data.downloaded} ảnh mới`}</span>}
        </div>
      </details>
    </div>
  );
}
