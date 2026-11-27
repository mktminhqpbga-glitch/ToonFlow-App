import axios from "axios";
import type { Project } from "@/stores/workspace";
import saveFile from "./saveFile";
import useWorkspaceFiles from "./workspaceFiles";

export async function exportWorkspace(project: Project, signal?: AbortSignal) {
  let name = project.name.replace(/[<>:"/\\|?*\x00-\x1f\x7f-\x9f]/g, "_").slice(0, 120).replace(/[. ]+$/, "");
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = "MacFlow";
  try {
    return await saveFile(() => useWorkspaceFiles(project.directory).exportZip(signal), `${name}.zip`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const body = error.response?.data;
      const data = body instanceof Blob ? await body.text().then(JSON.parse).catch(() => null) : body;
      if (typeof data?.message === "string") throw new Error(data.message);
    }
    throw error;
  }
}
