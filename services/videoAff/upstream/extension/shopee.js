// Executed on the active tab when the user requests a capture.
(() => {
  if (!["https://shopee.vn", "https://www.shopee.vn"].includes(location.origin)
    || !/^\/(?:product\/\d{1,20}\/\d{1,20}|[^/]*[/-]i\.\d{1,20}\.\d{1,20})\/?$/.test(location.pathname)) return null;

  const meta = (key) => document.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.content;
  const text = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
  function findProduct(value) {
    const nodes = Array.isArray(value) ? value : [value, value?.mainEntity, ...(Array.isArray(value?.["@graph"]) ? value["@graph"] : [])];
    return nodes.find((node) => [].concat(node?.["@type"] || []).some((type) => /^Product$|^https?:\/\/schema\.org\/Product$/.test(type)));
  }
  let product;
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    if (script.textContent.length > 250_000) continue;
    try { product = findProduct(JSON.parse(script.textContent)); }
    catch { continue; }
    if (product) break;
  }

  const heading = document.querySelector("main h1, h1") || document.querySelector("[itemprop=name]");
  const title = text(product?.name || heading?.textContent || meta("og:title"), 500);
  if (!title || /^(shopee(?: việt nam)?|xác minh bảo mật|security verification)$/i.test(title)) return null;

  const images = new Set();
  function addImage(value) {
    if (typeof value !== "string") return;
    try {
      const url = new URL(value, location.href);
      if (url.protocol !== "https:" || url.port || url.username || url.password
        || !/^(?:[a-z0-9-]+\.)+img\.susercontent\.com$|^cf\.shopee\.vn$/i.test(url.hostname)
        || !/^\/file\/[A-Za-z0-9_.@-]{1,256}$/.test(url.pathname)) return;
      images.add(url.origin + url.pathname);
    } catch { /* Ignore unsupported image URLs. */ }
  }
  for (const image of [].concat(product?.image || [])) addImage(typeof image === "string" ? image : image?.contentUrl || image?.url);
  for (const image of document.querySelectorAll('meta[property="og:image"], [itemprop=image], img[alt]')) {
    if (image.matches("meta, [itemprop=image]") || image.alt === title) addImage(image.content || image.currentSrc || image.src || image.href);
    if (images.size >= 12) break;
  }
  if (!images.size) return null;

  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  const currency = offers?.priceCurrency || meta("product:price:currency") || document.querySelector('[itemprop="priceCurrency"]')?.content;
  const priceValue = offers?.price ?? offers?.lowPrice ?? meta("product:price:amount") ?? document.querySelector('[itemprop="price"]')?.content;
  const sale = currency === "VND" && /^\d{1,12}(?:\.0{1,2})?$/.test(String(priceValue)) ? String(priceValue).split(".")[0] : null;
  return {
    kind: "shopee",
    url: location.origin + location.pathname,
    product: {
      title,
      images: [...images].slice(0, 12),
      description: text(product?.description || document.querySelector('[itemprop="description"]')?.textContent || meta("og:description"), 5000),
      seller: text(offers?.seller?.name, 160),
      sale,
    },
  };
})();
