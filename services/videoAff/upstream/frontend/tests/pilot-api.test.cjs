const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = (...parts) => fs.readFileSync(path.resolve(__dirname, "../src", ...parts), "utf8");

const sourceFiles = () => {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(target);
    }
  };
  visit(path.resolve(__dirname, "../src"));
  return files;
};

test("only the http service talks to the backend", () => {
  const http = src("services", "http.ts");
  assert.match(http, /response = await fetch\(path, init\)/);
  for (const file of sourceFiles().filter((item) => !item.endsWith(path.join("services", "http.ts")))) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /\bfetch\(/, file);
  }
});

test("the app has four menu pages, the studio and redirects for old links", () => {
  const app = src("App.tsx");
  const shell = src("components", "Shell.tsx");
  for (const route of ["products", "videos", "studio/:productId", "memory", "notifications"]) {
    assert.match(app, new RegExp(`path="${route}"`));
  }
  for (const [from, to] of [["briefs", "/videos"], ["outputs", "/videos"], ["second-brain", "/memory"]]) {
    assert.match(app, new RegExp(`path="${from}" element=\\{<Navigate replace to="${to}" />`));
  }
  for (const label of ["Tổng quan", "Sản phẩm", "Video của tôi", "Bộ nhớ AI"]) assert.match(shell, new RegExp(`label: "${label}"`));
});

test("the dashboard declares Vietnamese and Products links to the Chrome extension", () => {
  assert.match(fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8"), /<html lang="vi">/);
  assert.match(src("pages", "Products.tsx"), /href="\/api\/v1\/extension\/download" download/);
});

test("a rule the AI proposes waits for a human before it is used", () => {
  const rules = src("pages", "memory", "RulesTab.tsx");
  const api = src("services", "pilotApi.ts");
  assert.match(api, /creative-knowledge\/bootstrap/);
  assert.match(api, /retireCreativeKnowledge/);
  assert.match(rules, /Duyệt tất cả/);
  assert.match(rules, /decideCreativeKnowledge\(saved\.knowledge_id, "approved"/);
  assert.doesNotMatch(rules, /autoApprove|auto_approve/);
});

test("the studio pauses for image review before the video is paid for", () => {
  const idea = src("pages", "studio", "IdeaStep.tsx");
  const images = src("pages", "studio", "ImagesStep.tsx");
  const hook = src("hooks", "useStudio.ts");
  assert.match(idea, /until: "images"/);
  assert.match(images, /until: "images"/);
  assert.match(images, /until: "video"/);
  assert.match(images, /Duyệt tất cả cảnh để tiếp tục/);
  assert.match(hook, /pipeline/);
});
