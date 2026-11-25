type StudioPrompt = { directory: string; kind: "image" | "video"; prompt: string };

let pending: StudioPrompt | undefined;

export function queueStudioPrompt(draft: StudioPrompt) {
  pending = draft;
}

export function takeStudioPrompt(directory: string, kind: StudioPrompt["kind"]) {
  const draft = pending;
  pending = undefined;
  if (draft?.directory === directory && draft.kind === kind) return draft.prompt;
}
