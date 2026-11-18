// Runs in an isolated content-script world. Refuse image requests unless the
// current composer has a unique file input and the UI confirms new attachments.
(() => {
  if (globalThis.AI_BRIDGE_IMAGE_INPUT) return;

  const supported = new Set(["image/png", "image/jpeg", "image/webp"]);
  const verifiedUploads = new WeakMap();
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isVisible = element => !!element?.getClientRects().length
    && getComputedStyle(element).visibility !== "hidden"
    && getComputedStyle(element).display !== "none";

  function checkImages(images) {
    if (!Array.isArray(images) || images.length < 1 || images.length > 2) throw new Error("Chỉ hỗ trợ 1 hoặc 2 ảnh đầu vào.");
    let total = 0;
    return images.map((image, index) => {
      if (!image || !supported.has(image.mime_type) || typeof image.data !== "string"
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data) || image.data.length % 4 !== 0) {
        throw new Error("Ảnh đính kèm có định dạng hoặc dữ liệu base64 không hợp lệ.");
      }
      const binary = atob(image.data);
      total += binary.length;
      if (!binary.length || total > 3 * 1024 * 1024) throw new Error("Ảnh đính kèm vượt quá 3 MiB.");
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const validHeader = image.mime_type === "image/png"
        ? bytes.length > 8 && [137,80,78,71,13,10,26,10].every((part, at) => bytes[at] === part)
        : image.mime_type === "image/jpeg"
          ? bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
            && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
      if (!validHeader) throw new Error("Nội dung ảnh không khớp với định dạng đã khai báo.");
      const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[image.mime_type];
      const name = typeof image.name === "string" && /^[\w. ()-]{1,90}$/.test(image.name)
        && !/[\\/]/.test(image.name) ? image.name : `bridge-image-${index + 1}.${extension}`;
      return new File([bytes], name, { type: image.mime_type });
    });
  }

  function findUploadControl(composer) {
    // This supports explicit file controls only. Do not click generic plus,
    // avatar, attachment or menu buttons which may open a different picker.
    const form = composer.closest("form");
    // A composer form is an ownership boundary: never traverse beyond it to
    // search for an unrelated profile or avatar image picker.
    const roots = form ? [form] : [];
    let node = composer.parentElement;
    if (!form) for (let depth = 0; node && node !== document.body && depth < 5; depth++, node = node.parentElement) {
      roots.push(node);
    }
    for (const root of roots) {
      // A hidden file input is normal; it must still be inside this composer.
      const eligible = [...root.querySelectorAll('input[type="file"]')].filter(input => {
        if (input.disabled || input.closest('[aria-hidden="true"],[inert]')) return false;
        const accept = (input.accept || "").toLowerCase().replace(/\s/g, "");
        if (!accept || !accept.split(",").some(part => ["image/*", ".png", ".jpg", ".jpeg", ".webp",
          "image/png", "image/jpeg", "image/webp"].includes(part))) return false;
        const labels = [input.id, input.name, input.title, input.getAttribute?.("aria-label"),
          input.getAttribute?.("data-testid"), input.parentElement?.getAttribute?.("aria-label"),
          input.parentElement?.getAttribute?.("data-testid")].filter(Boolean).join(" ");
        // Accepting image/* is not enough: a profile-photo picker does too.
        if (/avatar|profile|user.?photo|profile.?picture|account.?image/i.test(labels)
          || input.closest('[data-testid*="avatar" i],[data-testid*="profile" i],[class*="avatar" i],[class*="profile" i]')) return false;
        // Outside an actual composer form an explicit upload/attach label is
        // required; an unlabeled file input could affect some other UI.
        return !!form || /upload|attach|file|image|chọn tệp|tải ảnh/i.test(labels);
      });
      if (eligible.length === 1) return eligible[0];
      if (eligible.length > 1) throw new Error("Có nhiều ô tải tệp; không thể xác định ô đính kèm an toàn.");
    }
    throw new Error("Không tìm thấy ô tải ảnh thuộc khung chat hiện tại.");
  }

  function attachedEvidence(root) {
    // Count only composer-local preview controls/thumbnail nodes. Never count
    // images in chat history, user avatars or the send button.
    const imageSelector = [
      '[data-testid*="attachment" i] img', '[data-testid*="upload" i] img',
      '[data-testid*="preview" i] img', '[class*="attachment" i] img',
      '[class*="upload-preview" i] img',
    ].join(",");
    const removeSelector = [
      'button[aria-label*="remove attachment" i]', 'button[aria-label*="remove image" i]',
      'button[aria-label*="xóa ảnh" i]', '[data-testid*="remove-attachment" i]',
    ].join(",");
    const isComposerPreview = element => isVisible(element)
      && !element.closest('[data-message-author-role], [data-testid*="conversation-turn" i]');
    const thumbnails = [...root.querySelectorAll(imageSelector)].filter(isComposerPreview);
    const removalControls = [...root.querySelectorAll(removeSelector)].filter(isComposerPreview);
    // A single attachment can have a thumbnail and a remove control.
    return Math.max(thumbnails.length, removalControls.length);
  }

  function assertAttached(composer, expectedCount) {
    const recorded = verifiedUploads.get(composer);
    if (!recorded || !composer?.isConnected || !recorded.root?.isConnected || recorded.count !== expectedCount
      || attachedEvidence(recorded.root) < expectedCount)
      throw new Error("Ảnh đính kèm không còn hiển thị trong ô chat; không gửi prompt.");
    const progress = [...recorded.root.querySelectorAll('[role="progressbar"],[aria-busy="true"],[data-testid*="upload-progress" i]')]
      .some(isVisible);
    if (progress) throw new Error("Ảnh vẫn đang tải lên; chưa thể gửi prompt.");
    return true;
  }

  async function attach(images, composer, provider, verify = () => true) {
    if (provider === "muse") throw new Error("Muse chưa có bộ xác minh ảnh đính kèm; đã dừng trước khi gửi prompt.");
    if (!composer?.isConnected || !verify()) throw new Error("Khung chat đã thay đổi trước khi tải ảnh.");
    const files = checkImages(images);
    const input = findUploadControl(composer);
    let root = input.parentElement;
    while (root && !root.contains(composer)) root = root.parentElement;
    if (!root || root === document.body || root === document.documentElement) {
      throw new Error("Không xác định được khu vực xem trước ảnh.");
    }
    if (input.files?.length || attachedEvidence(root)) throw new Error("Đã có ảnh đính kèm; không được ghi đè hoặc nhập lẫn ảnh.");
    if (files.length > 1 && !input.multiple) throw new Error("Ô tải ảnh không hỗ trợ nhiều ảnh.");
    const accept = (input.accept || "").toLowerCase().replace(/\s/g, "").split(",");
    if (!files.every(file => accept.includes("image/*") || accept.includes(file.type)
      || accept.includes("." + file.name.split(".").at(-1).toLowerCase())))
      throw new Error("Ô tải ảnh hiện tại không chấp nhận định dạng ảnh đã chọn.");
    if (typeof DataTransfer !== "function") throw new Error("Trình duyệt không hỗ trợ xác nhận tệp đính kèm.");
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    // React-based apps generally clear the native input after processing.
    // Native input.files alone is not proof that the site accepted the image.
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await pause(200);
      if (!composer.isConnected || !input.isConnected || !verify()) {
        throw new Error("Khung chat đổi trong quá trình tải ảnh; không gửi prompt.");
      }
      if (attachedEvidence(root) >= files.length) {
        verifiedUploads.set(composer, { root, count: files.length });
        assertAttached(composer, files.length);
        return true;
      }
    }
    throw new Error("Không xác nhận được ảnh xem trước trong khung chat; không gửi prompt.");
  }

  globalThis.AI_BRIDGE_IMAGE_INPUT = Object.freeze({ version: "0.6.0", attach, assertAttached, checkImages });
})();
