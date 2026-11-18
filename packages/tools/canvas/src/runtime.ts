import { z } from "zod";
export type { CanvasToolCall, CanvasInfo, CanvasContext } from "@toonflow/tools-scaffold/runtime";

const additionalNodeToolNames = z.array(z.string().regex(/^[a-z][a-zA-Z0-9]{0,63}$/, "Tên phải bắt đầu bằng chữ thường, chỉ có chữ và số, tối đa 64 ký tự")).max(100, "Mỗi loại tối đa 100 tên công cụ thêm vào").default([]);
export const nodeToolPermissionsSchema = z.strictObject({
  allowImage: z.boolean().default(true),
  allowVideo: z.boolean().default(true),
  allowAudio: z.boolean().default(true),
  imageToolNames: additionalNodeToolNames,
  videoToolNames: additionalNodeToolNames,
  audioToolNames: additionalNodeToolNames,
});
export type NodeToolPermissions = z.output<typeof nodeToolPermissionsSchema>;

export function isNodeToolAllowed(name: string, permissions: NodeToolPermissions) {
  const toolName = name.startsWith("node:") ? name.slice(5) : name;
  return (permissions.allowImage || (toolName !== "generateImage" && !permissions.imageToolNames.includes(toolName)))
    && (permissions.allowVideo || (toolName !== "generateVideo" && !permissions.videoToolNames.includes(toolName)))
    && (permissions.allowAudio || (toolName !== "generateAudio" && !permissions.audioToolNames.includes(toolName)));
}

const nodeId = z.string().min(1).max(256);
const position = z.strictObject({ x: z.number().finite(), y: z.number().finite() });
const canvasId = nodeId.optional();
const cursor = z.string().min(1).max(4096).optional();
const nodeIds = z.array(nodeId).min(1).max(20);

export const canvasSchemas = {
  getCanvas: z.strictObject({
    canvasId,
    include: z.array(z.enum(["canvases", "nodeTypes"])).max(2).optional(),
    cursor,
    limit: z.number().int().min(1).max(100).default(30),
  }),
  findCanvasNodes: z.strictObject({
    canvasId,
    query: z.string().max(200).optional(),
    types: z.array(nodeId).max(20).optional(),
    selectedOnly: z.boolean().optional(),
    cursor,
    limit: z.number().int().min(1).max(100).default(30),
  }),
  getCanvasNodes: z.strictObject({
    canvasId,
    nodeIds: nodeIds.refine(value => new Set(value).size === value.length, "nodeIds không được trùng, hãy loại trùng trước"),
    fields: z.array(z.enum(["label", "type", "position", "ports", "data", "outputs"])).max(6).default(["label", "type", "position"]),
    dataKeys: z.array(nodeId).min(1).max(20).optional(),
    path: z.array(z.string().max(256)).min(1).max(64)
      .refine(value => ["label", "type", "position", "ports", "data", "outputs"].includes(value[0]!), "path phải bắt đầu từ trường kết quả node")
      .refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 2048, "JSON UTF-8 của path không được vượt 2048 byte").optional(),
    valueOffset: z.number().int().min(0).default(0),
    valueLimit: z.number().int().min(1).max(100).default(30),
    textOffset: z.number().int().min(0).default(0),
    textLimit: z.number().int().min(1).max(4000).default(1000),
    cursor,
  }).refine(value => Boolean(value.path) || (value.textOffset === 0 && value.valueOffset === 0), "Khi textOffset hoặc valueOffset lớn hơn 0 phải có path"),
  getCanvasEdges: z.strictObject({
    canvasId,
    nodeIds: nodeIds.optional(),
    direction: z.enum(["incoming", "outgoing", "both"]).default("both"),
    cursor,
    limit: z.number().int().min(1).max(200).default(100),
  }),
  getNodeTools: z.strictObject({
    canvasId,
    nodeIds: nodeIds.refine(value => new Set(value).size === value.length, "nodeIds không được trùng, hãy loại trùng trước"),
    names: z.array(nodeId).min(1).max(20).optional(),
    cursor,
    limit: z.number().int().min(1).max(50).default(20),
  }),
  addCanvas: z.strictObject({ name: z.string().trim().min(1).max(120).optional() }),
  switchCanvas: z.strictObject({ canvasId: z.string().min(1).max(256) }),
  renameCanvas: z.strictObject({ canvasId: z.string().min(1).max(256).optional(), name: z.string().trim().min(1).max(120) }),
  addNode: z.strictObject({ type: z.string().min(1), position, label: z.string().trim().min(1).max(200).optional() }),
  deleteNodes: z.strictObject({ nodeIds: z.array(nodeId).min(1).max(64) }),
  moveNodes: z.strictObject({ moves: z.array(z.strictObject({ nodeId, position })).min(1).max(64) }),
  renameNodes: z.strictObject({ renames: z.array(z.strictObject({ nodeId, label: z.string().trim().min(1).max(200) })).min(1).max(64) }),
  connectNodes: z.strictObject({
    connections: z.array(z.strictObject({ source: nodeId, sourceHandle: z.string().min(1), target: nodeId, targetHandle: z.string().min(1) })).min(1).max(64),
  }),
  deleteEdges: z.strictObject({ edgeIds: z.array(z.string().min(1).max(256)).min(1).max(64) }),
  selectNodes: z.strictObject({ nodeIds: z.array(nodeId) }),
  arrangeCanvas: z.strictObject({}),
  fitCanvas: z.strictObject({ nodeIds: z.array(nodeId).optional() }),
  nodeTools: z.strictObject({ nodeId, name: z.templateLiteral(["node:", z.string().regex(/^[a-z][a-zA-Z0-9]{0,63}$/)]), args: z.record(z.string(), z.json()) }),
};

export type CanvasOperationName = keyof typeof canvasSchemas;
export type CanvasRequest = {
  [Name in CanvasOperationName]: { name: Name; args: z.output<(typeof canvasSchemas)[Name]> };
}[CanvasOperationName];

export const canvasOperations = [
  { name: "getCanvas", label: "Tổng quan Canvas", description: "Đọc ID, số node, số dây nối, số mục chọn và viewport của Canvas đang mở; không trả toàn bộ node, dây hoặc công cụ. include cho phép chọn canvases (danh sách Canvas) hoặc nodeTypes (availableNodeTypes), dùng chung cursor/limit phân trang. Nếu biết ID node, có thể đọc thẳng node. Mỗi lượt đọc tối đa 64 KiB và trả hasMore/nextCursor; khi đọc tiếp giữ nguyên tham số, chỉ thay cursor. Cursor hết hạn thì truy vấn lại. canvasId tùy chọn để xác nhận Canvas đang mở. Không sửa trực tiếp JSON Canvas.", parameters: canvasSchemas.getCanvas },
  { name: "findCanvasNodes", label: "Tìm node Canvas", description: "Lọc node theo query (ID hoặc tên đầy đủ), types và selectedOnly; bỏ lọc để liệt kê phân trang. Trả tóm tắt nodes, xem trước tên tối đa 512 ký tự, không trả nội dung hay định nghĩa hàm. limit mặc định 30, tối đa 100; quét tối đa 2.000 node/lượt. totalNodes là tổng node toàn Canvas, không phải số khớp. selectedOnly dựa trên trạng thái chọn tại lúc đọc mỗi trang, không phải snapshot cố định. Nếu nodes rỗng nhưng hasMore true, tiếp tục bằng nextCursor. Xử lý theo từng nhóm, giữ tóm tắt và cursor để tránh nhồi toàn bộ dữ liệu vào ngữ cảnh.", parameters: canvasSchemas.findCanvasNodes },
  { name: "getCanvasNodes", label: "Đọc chi tiết node", description: "Đọc tối đa 20 node theo nodeIds đã biết và không trùng; fields mặc định label/type/position, tùy chọn ports/data/outputs. dataKeys chỉ chọn trường sở hữu trực tiếp của data. path truy cập giá trị lồng nhau trong trường trả về như ['data','promptModel'], chỉ cho thuộc tính riêng; ports ánh xạ data.handles. Khi có path trả value; array/object phân trang bằng valueOffset/valueLimit (mặc định 30, tối đa 100); string chia đoạn theo textOffset/textLimit (mặc định 1.000, tối đa 4.000 ký tự). Offset lớn hơn 0 phải có path. Kiểm tra truncated, total, nextOffset của mỗi node và đọc tiếp theo đường dẫn, không coi dữ liệu đã cắt là hoàn chỉnh. Đường dẫn tới tệp chữ phải dùng công cụ đọc tệp. Mỗi response giới hạn 64 KiB; nếu hasMore, đọc tiếp bằng nextCursor và giữ tham số.", parameters: canvasSchemas.getCanvasNodes },
  { name: "getCanvasEdges", label: "Đọc dây nối Canvas", description: "Đọc dây nối cục bộ liên quan nodeIds theo phân trang; direction nhận incoming/outgoing/both, mặc định both. Bỏ nodeIds để liệt kê dây toàn Canvas, limit mặc định 100, tối đa 200; quét tối đa 2.000 dây/lượt. totalEdges là tổng dây toàn Canvas, không phải kết quả khớp. Trả edges và thông tin trang; nếu edges rỗng nhưng hasMore true, tiếp tục nextCursor. Tìm dây đầu vào theo từng cấp, không tải toàn sơ đồ một lần.", parameters: canvasSchemas.getCanvasEdges },
  { name: "getNodeTools", label: "Tra cứu hàm node", description: "Tra cứu các hàm thực tế đã đăng ký của tối đa 20 nodeIds không trùng; names lọc tên đầy đủ node:functionName, limit mặc định 20, tối đa 50. Trả nodeTools gồm nodeId/name/description/parameters; giữ nguyên schema, nếu một mục quá lớn thì báo lỗi. Chỉ tạo args theo schema đọc được rồi gọi nodeTools, không đoán tên hàm hoặc tham số. hasMore thì đọc tiếp bằng nextCursor.", parameters: canvasSchemas.getNodeTools },
  { name: "addCanvas", label: "Tạo Canvas", description: "Tạo JSON Canvas trống trong workspace hiện tại và chuyển sang Canvas mới. name tùy chọn, không kèm .json; nếu bỏ sẽ tạo tên Canvas N chưa dùng. Không ghi đè tệp trùng tên. Trả trạng thái Canvas mới để thêm node tiếp trong cùng lượt.", parameters: canvasSchemas.addCanvas },
  { name: "switchCanvas", label: "Chuyển Canvas", description: "Lấy canvasId từ getCanvas({include:['canvases']}) có phân trang, rồi chuyển Canvas đang mở. Chờ lưu các chỉnh sửa hiện tại; trả tổng quan Canvas mới và thao tác sau áp dụng vào Canvas đó.", parameters: canvasSchemas.switchCanvas },
  { name: "renameCanvas", label: "Đổi tên Canvas", description: "Đổi tên Canvas trong workspace và tên file JSON tương ứng. Bỏ canvasId để đổi Canvas hiện tại; name không có .json. Không ghi đè tệp có sẵn; trả tổng quan Canvas đang mở sau đổi tên.", parameters: canvasSchemas.renameCanvas },
  { name: "addNode", label: "Thêm node", description: "Thêm node tại tọa độ Canvas position trên Canvas đang mở; type phải lấy từ availableNodeTypes của getCanvas({include:['nodeTypes']}). Trả thông tin node mới; dùng getNodeTools để truy vấn hàm khi cần.", parameters: canvasSchemas.addNode },
  { name: "deleteNodes", label: "Xóa node", description: "Xóa hàng loạt các node theo nodeIds cùng dây nối của chúng trên Canvas đang mở. Node cha/con có thể xóa cùng lô; nếu một mục không hợp lệ, không thực hiện cả lô. Trả removedEdgeCount, tối đa 100 removedEdgeIds và truncated; cờ truncated chỉ là phản hồi ID được rút gọn, không phải xóa một phần dây nối.", parameters: canvasSchemas.deleteNodes },
  { name: "moveNodes", label: "Di chuyển node", description: "Di chuyển nhiều node theo tọa độ position riêng trên Canvas đang mở; nếu một mục không hợp lệ, không thực hiện cả lô.", parameters: canvasSchemas.moveNodes },
  { name: "renameNodes", label: "Đổi tên node", description: "Đổi tên hiển thị hàng loạt node được chỉ định trên Canvas đang mở; nếu một mục không hợp lệ, không thực hiện cả lô.", parameters: canvasSchemas.renameNodes },
  { name: "connectNodes", label: "Nối node", description: "Nối hàng loạt đầu ra sourceHandle với đầu vào targetHandle trên Canvas đang mở. Trước đó đọc ports bằng getCanvasNodes để xác nhận node và cổng; tuân kiểm tra kết nối của Canvas và node. Nếu một liên kết lỗi, không thực hiện cả lô.", parameters: canvasSchemas.connectNodes },
  { name: "deleteEdges", label: "Xóa dây nối", description: "Xóa hàng loạt dây nối theo edgeIds trên Canvas đang mở; nếu một mục không hợp lệ, không thực hiện cả lô.", parameters: canvasSchemas.deleteEdges },
  { name: "selectNodes", label: "Chọn node", description: "Chọn các node theo nodeIds trên Canvas đang mở; mảng rỗng sẽ bỏ chọn.", parameters: canvasSchemas.selectNodes },
  { name: "arrangeCanvas", label: "Sắp xếp Canvas", description: "Dựa trên kích thước node thực và dây nối để tự sắp xếp mọi node cấp cao của Canvas từ trái sang phải và fit vào viewport. Node con giữ tọa độ tương đối; không đổi nội dung, dây, trạng thái chọn hoặc tạo media. Trả arrangedCount, tối đa 100 arrangedNodeIds, truncated và viewport; truncated chỉ rút gọn phản hồi ID, không có nghĩa chỉ sắp xếp một phần. Từ chối nếu kích thước node chưa sẵn sàng hoặc có node không thể di chuyển. Chỉ dùng để sắp xếp toàn Canvas; chỉnh cục bộ dùng moveNodes, chỉ xem dùng fitCanvas.", parameters: canvasSchemas.arrangeCanvas },
  { name: "fitCanvas", label: "Đưa Canvas vừa màn hình", description: "Chỉnh viewport để hiện các node theo nodeIds hoặc tất cả nếu không cung cấp. Trả fitted, viewport, nodeCount; khi cung cấp nodeIds còn trả tối đa 100 nodeIds và truncated (chỉ rút gọn phản hồi).", parameters: canvasSchemas.fitCanvas },
  { name: "nodeTools", label: "Gọi hàm node", description: "Gọi node:functionName đã đăng ký trên Canvas đang mở. Trước tiên dùng getNodeTools đọc parameters thực của node, rồi tạo args đúng schema. Node mới tạo có thể truy vấn/gọi hàm ngay trong cùng lượt; không sửa JSON Canvas để thay thế hàm. Dữ liệu trả về do hàm thực quyết định; giới hạn 64 KiB của năm công cụ đọc Canvas không áp dụng ở đây.", parameters: canvasSchemas.nodeTools },
] as const;
