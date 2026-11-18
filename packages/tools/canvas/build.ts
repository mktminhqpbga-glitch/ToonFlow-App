import { createToolConfig } from "@toonflow/tools-scaffold";

await createToolConfig({
  name: "canvas",
  displayName: "Thao tác Canvas",
  description: "Tạo, chuyển, đổi tên và tự sắp xếp Canvas, thao tác node/dây nối/viewport và gọi các hàm node đã đăng ký.",
  author: "Toonflow",
  github: "https://github.com/HBAI-Ltd/Toonflow-app",
  prompt: `getCanvas mặc định chỉ đọc tổng quan Canvas, dùng include để lấy danh sách Canvas hoặc loại node khi cần. findCanvasNodes tìm node theo tên, ID, loại hoặc trạng thái chọn. Khi biết ID, dùng getCanvasNodes đọc trường cần thiết, getCanvasEdges tra dây nối gần node và getNodeTools tra hàm. Vì người dùng có thể đang sửa Canvas, phải truy vấn lại khi trạng thái đổi, không dùng snapshot cũ như trạng thái hiện tại.
Mọi lần đọc đều có giới hạn số mục/dung lượng. Kiểm tra hasMore, nextCursor và thông tin cắt ngắn; nếu danh sách rỗng nhưng hasMore true vẫn phải đọc tiếp. Khi phân trang giữ tham số, chỉ thay cursor; nếu cursor hết hạn, truy vấn lại. Công việc toàn Canvas chia nhóm, chỉ giữ tóm tắt và cursor, không tích lũy toàn bộ chi tiết node.
Sửa Canvas bằng công cụ thực được cấp, không ghi JSON trực tiếp để thay thao tác UI. Sau tạo/chuyển Canvas, các thao tác sau phải dùng Canvas mới được trả về.
Tham số và chức năng node được thao tác qua nodeTools đã đăng ký; nodeId, node:functionName và schema lấy theo getNodeTools thực, args theo yêu cầu, không đoán hàm/trường chưa đăng ký.
Nếu kiểm tra tham số node thất bại thì lệnh chưa chạy; sửa args theo parameters trả về rồi mới gọi lại, không gửi lại y nguyên. Tham số thuộc hàm khác nhau phải gọi đúng hàm tương ứng.
Trước khi nối, kiểm tra cổng ra/vào và loại dữ liệu tương thích; dùng tọa độ Canvas và chừa chỗ cho nội dung/dây. Tái sử dụng node có sẵn khi được, không tạo trùng.
deleteNodes, moveNodes, renameNodes, connectNodes, deleteEdges đều hỗ trợ nhiều mục tiêu mỗi lần. Gộp thao tác cùng loại vào một lệnh, không gọi riêng từng node/dây; nếu một mục không hợp lệ cả lô không chạy, sửa theo lỗi rồi gửi lại toàn lô.
Chờ kết quả mỗi thao tác, chỉ dùng getCanvasNodes/getCanvasEdges kiểm tra node/dây/đầu ra thực bị ảnh hưởng; nếu thiếu hàm hoặc Canvas ngoại tuyến, nêu vấn đề cụ thể.`,
  configRules: [],
  components: Object.fromEntries([
    "addNode", "moveNodes", "renameNodes", "nodeTools", "connectNodes",
    "deleteEdges", "selectNodes", "arrangeCanvas", "fitCanvas",
  ].map(name => [name, "src/nodeFocusCard.vue"])),
}, import.meta.url);
