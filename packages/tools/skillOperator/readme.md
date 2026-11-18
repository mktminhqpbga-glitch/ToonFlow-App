# Quản lý kỹ năng

Dùng công cụ `skillOperator` để liệt kê, đọc, tạo và sửa kỹ năng. Tài liệu mô tả được nhúng vào gói .tool.js khi build, nên khi cài chỉ cần tệp JS này.

Ba công tắc cấu hình Đọc, Tạo, Sửa mặc định bật. Khi tắt, thao tác tương ứng bị bỏ khỏi tham số và bị từ chối khi gọi. Danh sách kỹ năng vẫn đọc được; các công tắc chỉ áp dụng cho công cụ này, không thay quyền tệp của công cụ khác.

| action | Mục đích | Tham số |
| --- | --- | --- |
| `list` | Liệt kê tên, mô tả, nguồn và đường dẫn kỹ năng hiện tại | `scope` tùy chọn |
| `read` | Đọc nội dung kỹ năng hoặc tài liệu tham chiếu | `name`, tùy chọn `scope` và `path` |
| `create` | Tạo kỹ năng/tài liệu mới, không ghi đè | `name`, `content`; `scope`, `path` tùy chọn |
| `update` | Thay toàn bộ nội dung tệp hiện có | `name`, `content`; `scope`, `path` tùy chọn |

`scope` có thể là `workspace` (thư mục skill/ trong dự án) hoặc `global` (thư mục data/skills/). Nếu không chỉ định phạm vi khi đọc hoặc sửa, kỹ năng trong workspace được ưu tiên khi trùng tên; tạo mới mặc định trong workspace. Dùng phạm vi toàn cục để truy cập bản bị che bởi kỹ năng cùng tên.

`path` tương đối từ thư mục kỹ năng, mặc định `SKILL.md`. Có thể dùng `references/example.md` để thao tác tài liệu kèm theo, không cho phép ra ngoài thư mục kỹ năng. Khi tạo kỹ năng mới phải tạo SKILL.md trước, tên theo camelCase; nội dung phải có YAML frontmatter hợp lệ với `name` đúng và `description` không rỗng. Trước khi cập nhật phải đọc bản hiện tại.

Danh mục được quét trực tiếp mỗi lần gọi; vừa tạo có thể tra cứu hoặc đọc ngay. Có thể gọi thủ công bằng cú pháp /skill:tên. Cờ `disableModelInvocation` cho biết kỹ năng chỉ được gọi khi người dùng chỉ định rõ hay không.
