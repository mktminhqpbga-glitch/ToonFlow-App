const retiredProviderIds = new Set(["aibr", "aibridge", "aibridgelocal"]);

export function isRetiredProvider(id: string) {
  return retiredProviderIds.has(id.toLowerCase());
}

export function assertProviderAvailable(id: string) {
  if (isRetiredProvider(id)) {
    throw Object.assign(new Error("Nhà cung cấp này đã ngừng hỗ trợ. Hãy chọn mô hình từ nhà cung cấp khác."), { status: 410 });
  }
}
