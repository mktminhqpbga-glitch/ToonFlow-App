import type { GraphNode } from "@vue-flow/core";

export function availableCanvasPosition(position: { x: number; y: number }, nodes: readonly GraphNode[]) {
  const { x } = position;
  let { y } = position;
  const width = 260, height = 360, gap = 40;
  const below = nodes.filter(node => !node.hidden
    && node.computedPosition.x < x + width + gap
    && node.computedPosition.x + (node.dimensions.width || width) > x - gap)
    .sort((a, b) => a.computedPosition.y - b.computedPosition.y);
  for (const node of below) {
    if (y + height + gap <= node.computedPosition.y) break;
    y = Math.max(y, node.computedPosition.y + (node.dimensions.height || height) + gap);
  }
  return { x, y };
}

export function availableCanvasLabel(label: string, nodes: readonly GraphNode[]) {
  const labels = new Set(nodes.map(node => node.data?.label));
  if (!labels.has(label)) return label;
  const suffix = /\.md$/i.exec(label)?.[0] ?? "";
  const title = suffix ? label.slice(0, -suffix.length) : label;
  let index = 2;
  while (labels.has(`${title} (${index})${suffix}`)) index++;
  return `${title} (${index})${suffix}`;
}
