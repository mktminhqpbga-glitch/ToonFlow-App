import { describe, expect, test } from "bun:test";
import { readFile } from "@toonflow/file";
import { fileURLToPath } from "node:url";

// Source-contract regression only; actual Vue click/workspace E2E requires browser.
async function source(relative: string) {
  return readFile(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

describe("workspace toolbar and Batch routing source contracts", () => {
  test("primary toolbar has unique material/character triggers in the requested order", async () => {
    const workspace = await source("../src/pages/workspace/index.vue");
    const controls = await source("../src/pages/workspace/panels/canvas/components/canvasControls.vue");
    const toolbar = workspace.split('class="toolMenuContent"')[1]?.split("</div>")[0] ?? "";
    const sequence = ["addNodeAtPointer()", "selectedTool = selectedTool", "openNodeSearch()", "openMaterialPresets()", "openCharacterStudio()", 'aria-label="帮助"'];
    let position = -1;
    for (const action of sequence) {
      const next = toolbar.indexOf(action);
      expect(next).toBeGreaterThan(position);
      position = next;
    }
    expect(toolbar).toContain("<icon-shape ");
    expect(toolbar).toContain("<icon-mood-smile ");
    expect(workspace.match(/aria-label="Thư viện vật liệu"/g)?.length).toBe(1);
    expect(workspace.match(/aria-label="Studio nhân vật"/g)?.length).toBe(1);
    expect(controls).not.toContain('aria-label="Thư viện vật liệu"');
    expect(controls).not.toContain('aria-label="Studio nhân vật"');
  });

  test("both dialogs remain bound to the live canvas instance, not duplicated", async () => {
    const controls = await source("../src/pages/workspace/panels/canvas/components/canvasControls.vue");
    const canvas = await source("../src/pages/workspace/panels/canvas/index.vue");
    const host = await source("../src/pages/workspace/panels/canvas/canvasHost.vue");
    expect(controls).toContain('<materialPresets v-model="materialPresetsVisible"');
    expect(controls).toContain('<characterStudio v-model="characterStudioVisible"');
    expect(controls).toContain(':createNode="createPresetNode"');
    expect(controls).toContain(':addCharacter="addCharacterToCanvas"');
    for (const name of ["openMaterialPresets", "openCharacterStudio"]) {
      expect(controls).toContain(name + ": () =>");
      expect(canvas).toContain("canvasControlsRef.value?." + name + "()");
      expect(host).toContain("activeInstance.value?." + name + "()");
    }
  });

  test("Home Batch actions select a project and preserve the target panel route", async () => {
    const home = await source("../src/pages/home/index.vue");
    const workspace = await source("../src/pages/workspace/index.vue");
    const image = home.indexOf('openBatch(\'batchImage\')');
    const video = home.indexOf('openBatch(\'batchVideo\')');
    const library = home.indexOf('translate("素材库")');
    expect(library).toBeGreaterThan(0);
    expect(image).toBeGreaterThan(library);
    expect(video).toBeGreaterThan(image);
    expect(home).toContain("if (sortedProjects.value.length === 1)");
    expect(home).toContain("batchProjectPickerVisible.value = true");
    expect(home).toContain("void openProject(selected, kind)");
    expect(home).toContain('query: { panel: targetPanel }');
    expect(workspace).toContain('requestedPanel === "batchImage" || requestedPanel === "batchVideo"');
    expect(workspace).toContain(':directory="workspaceStore.project?.directory"');
  });

  test("stale AI model fetch cannot overwrite the next workspace selection", async () => {
    const page = await source("../src/pages/workspace/components/batchPage.vue");
    expect(page).toContain("let modelsRunToken = 0");
    expect(page).toContain("const token = ++modelsRunToken");
    expect(page).toContain("if (token !== modelsRunToken || !props.active) return");
    expect(page).toContain("if (token === modelsRunToken) modelsLoading.value = false");
    expect(page).toContain("models.value = []");
    expect(page).toContain('modelKey.value = ""');
    expect(page.match(/\+\+modelsRunToken/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test("Batch operations remain scoped to the active workspace", async () => {
    const page = await source("../src/pages/workspace/components/batchPage.vue");
    expect(page).toContain('"/api/ai/media/batches/list", { directory }');
    expect(page).toContain('"/api/ai/media/batches/create", { directory, kind: props.kind, requests }');
    expect(page).toContain('"/api/ai/media/batches/control", { directory: props.directory, id: batch.id, action }');
    expect(page).toContain("if (directory !== props.directory)");
    expect(page).toContain("++runToken");
    expect(page).toContain("batches.value = []");
  });
});
