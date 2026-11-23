import { computed, nextTick } from "vue";
import { useVueFlow, type GraphNode } from "@vue-flow/core";
import { useNodeEvent, useNodeToolsContext, type NodeData } from "@toonflow/nodes-scaffold/runtime";

const textNodeType = "remote-textNode";
const scriptSeparator = "\n\n---\n\n";

export function useScriptTextNote(source: GraphNode<NodeData>) {
  const flow = useVueFlow();
  const getNodeTools = useNodeToolsContext();
  const connectedText = computed(() => {
    for (const edge of flow.getEdges.value) {
      if (edge.source !== source.id || edge.sourceHandle !== "script" || edge.targetHandle !== "in") continue;
      const target = flow.findNode<NodeData>(edge.target);
      if (target?.type === textNodeType) return target;
    }
  });

  async function publish(script: string, previousScript: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const target = connectedText.value;
    if (target) {
      await useNodeEvent(target.id, flow).emit("save");
      signal?.throwIfAborted();
      if (connectedText.value !== target) throw new Error("Node Text đã đổi kết nối. Hãy gửi lại kịch bản.");
      const output = target.data.outputs?.text;
      const current = output?.dataType === "STRING" ? output.value : "";
      if (current === script || current.endsWith(scriptSeparator + script)) return target.id;
      const text = !current.trim() || current === previousScript ? script : current + scriptSeparator + script;
      await getNodeTools().call({ nodeId: target.id, name: "node:setText", args: { text } }, signal);
      return target.id;
    }

    if (!flow.getNodeTypes.value[textNodeType]) throw new Error("Hãy bật node Văn bản trong Chợ plugin rồi gửi lại kịch bản.");
    const id = crypto.randomUUID();
    const x = source.computedPosition.x + Math.max(source.dimensions.width, 360) + 72;
    const y = source.computedPosition.y;
    flow.addNodes({ id, type: textNodeType, position: { x, y }, data: { label: "Kịch bản", textSnapshot: script } });
    flow.addEdges({ id: crypto.randomUUID(), source: source.id, sourceHandle: "script", target: id, targetHandle: "in" });
    await nextTick();
    await useNodeEvent(id, flow).emit("save");
    return id;
  }

  function showText() {
    const target = connectedText.value;
    if (target) void flow.fitView({ nodes: [target.id], maxZoom: 1, duration: 250 });
  }

  return { connectedText, publish, showText };
}
