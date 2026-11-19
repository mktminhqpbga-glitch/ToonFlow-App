export type StudioMediaTransfer = {
  directory: string;
  path: string;
  mimeType: string;
  mediaType: "image" | "video";
};

let pendingMedia: StudioMediaTransfer | undefined;

export function queueStudioMediaForCanvas(media: StudioMediaTransfer) {
  pendingMedia = media;
}

export function pendingStudioMediaForCanvas() {
  return pendingMedia;
}

export function clearStudioMediaForCanvas(media: StudioMediaTransfer) {
  if (pendingMedia === media) pendingMedia = undefined;
}
