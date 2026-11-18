# Team Scaffold

`@toonflow/teams-scaffold` phụ trách kiểm tra manifest của nhóm, đóng gói thư mục và tích hợp A2A tiêu chuẩn. Ứng dụng chủ cung cấp mô hình, phiên làm việc, quyền truy cập workspace và việc thực thi của thành viên; gói nhóm không khởi động dịch vụ và không chứa khóa mô hình.

## Phát triển nhóm Agent

Đặt nhóm tại `packages/teams/<teamName>`; có thể tham khảo `storyboardTeam`:

```text
package.json
build.ts
team.json
readme.md
members/director.md
members/writer.md
skills/storyboard/SKILL.md
knowledge/continuity.md
tools/example.tool.js
```

Có thể bỏ qua thư mục `tools`. Thư mục này chỉ chấp nhận các công cụ dạng một tệp được xây dựng bằng toolScaffold hiện có; không đóng gói lại cả bộ SDK hoặc runtime mô hình.

```ts
import { createTeamConfig } from "@toonflow/teams-scaffold";

await createTeamConfig(import.meta.url, {
  sync: process.argv.includes("--sync") ? "replace" : "missing",
});
```

`createTeamConfig` đọc `team.json` và `package.json` trong cùng thư mục với `build.ts`, dùng `package.json.version` làm phiên bản phát hành; tạo đầu ra tại `build/agents/<name>/` và `build/agents/<name>.agent.zip` ở thư mục gốc dự án. Quá trình build đồng thời kiểm tra manifest, tham chiếu tài nguyên, vòng lặp ủy quyền và đường dẫn; không phát hành package.json, dependency mã nguồn hoặc script build.

Chỉ khi `NODE_ENV=dev` mới đồng bộ đến `data/agents/<name>`. Mặc định chỉ cài những nhóm còn thiếu, giữ nguyên toàn bộ thư mục đã cài để tránh ghi đè prompt, kỹ năng và kiến thức do người dùng chỉnh sửa. Chỉ khi chỉ định rõ `sync: "replace"` mới thay thế toàn bộ bằng sản phẩm build hiện tại, kể cả xóa các tệp cũ không còn trong mã nguồn; trước khi dùng phải sao lưu những chỉnh sửa cần giữ. Ứng dụng chủ xử lý việc xác nhận cài đặt và nâng cấp chính thức.

Tên nhóm, tên thành viên, tên thư mục kỹ năng và tên plugin công cụ phải dùng camelCase. Điểm vào phải trỏ đến thành viên có thật; quan hệ ủy quyền không được tạo vòng lặp. Đạo diễn có thể gọi từng thành viên nhiều lần nhưng chuỗi gọi giữa các thành viên không được đệ quy.

Các trường của thành viên:

| Trường | Ý nghĩa |
| --- | --- |
| description | Bản tóm tắt trách nhiệm để thành viên điều phối đọc |
| instructions | Đường dẫn Markdown tương đối bên trong `members/` |
| delegates | Tên các thành viên được phép ủy quyền |
| tools | Tên công cụ thực tế; nếu bỏ qua thì kế thừa công cụ của ứng dụng chủ trong lượt này và công cụ riêng của nhóm; mảng rỗng vô hiệu hóa công cụ thông thường; tên chỉ định rõ phải khả dụng trong lượt hiện tại |
| skills | Tên thư mục trong `skills/<name>/SKILL.md` |
| knowledge | Đường dẫn tương đối của tệp trong `knowledge/`, hoặc đường dẫn thư mục chứa tệp |

`tools` ở cấp gốc là ánh xạ từ tên plugin công cụ sang cấu hình, tương ứng `tools/<name>.tool.js`. Nó khác với danh sách tên công cụ thực tế của thành viên; một plugin có thể cung cấp nhiều công cụ. Khi chạy, chỉ đọc tài nguyên đã cấp quyền cho thành viên theo nhu cầu, không nhét toàn bộ nội dung vào ngữ cảnh ban đầu. Tài nguyên riêng chỉ biểu thị phạm vi của nhóm, không thể giấu tệp khỏi người dùng máy cục bộ và không phải sandbox cho mã thực thi.

Một tệp riêng lẻ, tổng dung lượng tệp sau giải nén và tệp nén đều không được vượt 20 MiB; tổng số mục thư mục và tệp tối đa 2.000. Từ chối symlink, đường dẫn vượt ra ngoài thư mục, tên tệp dành riêng của Windows và xung đột chữ hoa/chữ thường.

## A2A

Trong Toonflow, cài tệp `.agent.zip` tại “Cài đặt → Chợ plugin → Agent”; có thể bật, tắt, xuất, gỡ cài đặt hoặc sửa hướng dẫn thành viên, kỹ năng, kiến thức và `team.json`. Nhóm được cài vào `data/agents/<name>`; khi cập nhật phát hiện chỉnh sửa cục bộ, ứng dụng yêu cầu xác nhận ghi đè rõ ràng, và bản build dành cho phát triển cũng không tự ghi đè. Công cụ tư liệu nhóm cho phép thành viên đọc/ghi văn bản trong phạm vi manifest cấp quyền; không được dùng để sửa mã công cụ hoặc mở rộng quyền thành viên.

Agent chính gọi nhóm qua công cụ `subAgent` hiện có, ví dụ:

```json
{"tasks":[{"name":"分镜方案","team":"storyboardTeam","task":"根据工作区 story.md 整理文字分镜，先读取原文，不执行消耗算力的媒体生成。"}]}
```

Nếu không truyền `team`, tác vụ vẫn dùng Agent con tạm thời, không cần cài nhóm; tự động kế thừa tất cả công cụ của Agent cha, gồm hỏi người dùng và tiếp tục ủy quyền, không cần chỉ định `tools`. Nhóm dùng mô hình Agent chính đang chọn và công cụ của lượt hiện tại; phạm vi sử dụng của từng thành viên vẫn do manifest nhóm quyết định, ngữ cảnh thành viên độc lập. Các tác vụ cùng lô chạy song song trực tiếp, không đặt số suất đồng thời hoặc hàng đợi. Không có giới hạn cố định về số tác vụ, số vòng thực thi, tổng số lượt gọi thành viên hoặc tổng thời gian; quan hệ ủy quyền vẫn phải vượt qua kiểm tra không có chu trình trong manifest. Thành viên và công cụ được nạp khi bắt đầu tác vụ; chỉnh sửa chỉ áp dụng cho tác vụ sau. Nội dung kiến thức và Skill được đọc khi dùng. Việc tắt plugin không tự kết thúc tác vụ đang chạy; phải hủy tác vụ từ bên gọi.

Dịch vụ truy cập từ bên ngoài được bật trong mục “Dịch vụ A2A” trên cùng trang: chọn workspace và mô hình văn bản đã được cấp phép rõ, lưu rồi sao chép access token và địa chỉ Agent Card trên thẻ nhóm. Mặc định dịch vụ tắt; lời gọi từ xa không được chỉ định thư mục hoặc mô hình cục bộ khác. Triển khai trên Linux chỉ cho phép workspace của máy chủ, trang cấu hình phải được truy cập từ chính máy. Khi có kết nối điều khiển trang, có thể dùng lại công cụ Canvas; nếu trang chưa kết nối, chỉ có các công cụ tệp và server đang khả dụng.

“Kết nối Agent từ xa” lưu địa chỉ Agent Card đầy đủ của dịch vụ ngoài và Bearer token tùy chọn; tên kết nối cũng dùng làm trường `team` của `subAgent`. Chỉ văn bản tác vụ được gửi đến bên ngoài; không truyền khóa mô hình, công cụ của ứng dụng chủ hoặc tự tải tệp workspace lên. Nếu trả về `inputRequired`, gửi nội dung bổ sung cùng `taskId` và `contextId` gốc đến đúng nhóm đó. Mức sử dụng từ xa không được tính vào mức sử dụng mô hình có thể xác minh trên máy cục bộ.

`@toonflow/teams-scaffold/a2a` sử dụng `@a2a-js/sdk` chính thức phiên bản 1.2.0 với giao thức A2A 1.0. Các kiểu `AgentCard`, `Message`, `Task`, `Artifact` được export đều là kiểu gốc của SDK; dùng `fromJSON` / `toJSON` của SDK để chuyển đổi JSON truyền trên mạng, không tự ghép cấu trúc oneof nội bộ.

```ts
import { createTeamAgentCard, createTeamA2aRouter } from "@toonflow/teams-scaffold/a2a";

app.use("/team", createTeamA2aRouter({
  card: createTeamAgentCard(manifest, "https://example.com/team"),
  authenticate: async request => verifyBearerAndGetStableUserId(request),
  execute: async ({ taskId, contextId, message, task, userId, signal, emit }) => {
    emit({ type: "status", text: "正在执行" });
    return runTeam({ taskId, contextId, message, task, userId, signal, emit });
  },
  onCancel: taskId => clearSavedSession(taskId),
}));
```

Callback của ứng dụng chủ trả về `{ status: "completed" | "inputRequired", text, artifacts? }`; ngoại lệ được ghi nhận là thất bại. Dùng `emit` để phát văn bản trạng thái hoặc cập nhật Artifact chuẩn. Nếu cần thông tin bổ sung, trả `inputRequired`, ứng dụng chủ lưu trạng thái phiên của mình; tin nhắn người dùng tiếp theo mang taskId và contextId gốc để gọi lại `execute`, trong đó task chứa lịch sử giao thức đã lưu. Không thể tiếp tục tác vụ gốc sau khi đã hoàn thành hoặc thất bại.

Card nằm tại `/.well-known/agent-card.json` dưới đường dẫn mount, công khai bản tóm tắt năng lực nhóm và khai báo xác thực Bearer nhưng không công khai nội dung riêng. Ứng dụng chủ xác thực Bearer và trả về định danh ổn định; các thao tác đọc, liệt kê, tiếp tục và hủy tác vụ được tách theo định danh đó. Callback thực thi phải xử lý AbortSignal và chờ mọi công việc con kết thúc thì phản hồi hủy mới xác nhận CANCELED; `onCancel` dọn trạng thái ứng dụng chủ sau khi kiểm tra danh tính và hoàn tất hủy. Ngắt SSE không tự hủy tác vụ.

Chỉ mục tác vụ, sự kiện và danh tính dùng kho lưu trữ trong bộ nhớ của SDK, không được phục hồi sau khi dịch vụ khởi động lại; ứng dụng chủ phải tự dọn dẹp phiên mô hình đã lưu. Giai đoạn đầu không cung cấp thông báo push hoặc lớp tương thích phiên bản cũ 0.3.

```ts
import { createTeamA2aClient } from "@toonflow/teams-scaffold/a2a";

const client = await createTeamA2aClient({
  url: "https://example.com/team/.well-known/agent-card.json",
  token: "由宿主读取的密钥",
});
const card = await client.getAgentCard();
```

Client trả về đối tượng Client chính thức, hỗ trợ API tin nhắn, SSE, đọc tác vụ, liệt kê và hủy; có thể khám phá dịch vụ JSON-RPC hoặc HTTP+JSON. URL đầu vào là địa chỉ Card đầy đủ. Khi có token, không cho phép Card chuyển yêu cầu sang origin khác và cấm HTTP redirect, tránh rò rỉ khóa qua Card hoặc đường chuyển hướng. Adapter này không tự tải xuống tệp phương tiện.

## Kiểm tra xác minh

Sau khi sửa bộ khung, chạy `bun run --cwd packages/teamScaffold typecheck`; lệnh build ví dụ là `bun run --cwd packages/teams/storyboardTeam build`. Quá trình build tự kiểm tra mọi tham chiếu thành viên, giới hạn tài nguyên và nội dung phát hành; việc thực thi thành viên, cấp quyền và gọi mô hình thực tế vẫn cần kiểm thử tích hợp với ứng dụng chủ.
