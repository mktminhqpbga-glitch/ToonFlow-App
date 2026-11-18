---
name: workflow
description: Quy trình sản xuất trên Canvas Toonflow từ ý tưởng, truyện hoặc kịch bản thành văn bản, ảnh tài nguyên và video, có thể dùng lại tư liệu, tiếp tục hoặc chỉnh sửa một phần. Áp dụng khi thực sự sản xuất hoặc tiếp tục dự án; không sửa Canvas khi người dùng chỉ muốn trao đổi hay chỉnh chính kỹ năng.
metadata:
  version: "2.7.0"
  displayName: Quy trình sản xuất video
  author: Toonflow
  github: https://github.com/HBAI-Ltd/Toonflow-app
---

# Quy trình sản xuất trên Canvas Toonflow

**Ngôn ngữ sử dụng:** Mặc định toàn bộ câu trả lời, bản tóm tắt, danh sách tài nguyên, mô tả cảnh và prompt tạo media phải bằng tiếng Việt, trừ khi người dùng yêu cầu ngôn ngữ khác. Giữ nguyên lời thoại gốc, ID, nhãn tham chiếu, tên trường API, tiêu đề kỹ thuật cố định và ký hiệu toán học. Những đoạn tiếng Trung còn lại trong tài liệu phương pháp bên dưới là hướng dẫn tham khảo, không phải yêu cầu xuất đầu ra bằng tiếng Trung.

Tiếp tục từ nội dung người dùng đã có và đưa kết quả vào dự án Toonflow hiện tại. Tổ chức sản xuất dựa trên kịch bản và tư liệu thực tế của lượt này; không yêu cầu người dùng phải hoàn thiện trước một bộ tài liệu sản xuất phim. Gói này đã chứa các phương pháp cần thiết, không phụ thuộc nhóm kỹ năng nhiều vai trò của phiên bản cũ.

## Bắt đầu từ đâu

Trước tiên xác định sản phẩm cần bàn giao trong lượt này, tư liệu hiện có và các giới hạn người dùng đã nêu rõ. Kế thừa thời lượng, phong cách, tỷ lệ khung hình, ngôn ngữ và phiên bản đã biết. Chỉ hỏi những thông tin thiếu có ảnh hưởng đến kết quả mà không thể suy ra hợp lý.

| Đầu vào hiện có | Cách xử lý |
|---|---|
| Ý tưởng hoặc một câu mô tả | Bổ sung mục tiêu, trở ngại và kết quả của nhân vật để hình thành câu chuyện có thể duyệt và kịch bản hoàn chỉnh cho lượt này |
| Tiểu thuyết, câu chuyện hoặc đoạn trích tác phẩm gốc | Xác nhận phạm vi chuyển thể, giữ nguyên nguyên tác, theo dõi sự kiện, nhân vật, lời thoại và thông tin chưa biết rồi chuyển thành kịch bản nghe nhìn |
| Kịch bản đã chốt / timeline + mục tiêu hiện tại là sản xuất, tạo, tiếp tục hoặc sửa video | **Dù người dùng có nhắc “Seedance”, “prompt” hoặc mô hình cụ thể hay không, lập tức thực thi phần “SEEDANCE EPISODE DIRECTOR · PART A” tích hợp ngay trong tệp này.** Nếu người dùng chưa chỉ định mô hình, lập tức khóa tuyến Seedance và chỉ hỏi ngắn một lần “Seedance 2.0 hay 2.5?”; nếu đã chỉ định 2.0/2.5 thì đi theo tuyến mô hình tương ứng. Không chuyển sang cấu hình Canvas, quy trình tài nguyên hoặc cách viết prompt khác chỉ để hỏi mô hình. |
| Kịch bản đã chốt / timeline + chỉ yêu cầu tài nguyên, đọc kịch bản, chẩn đoán hoặc tác vụ không phải video | Chỉ xử lý phạm vi ngoài video mà người dùng yêu cầu rõ; không tự tạo prompt video chỉ vì có kịch bản đã chốt. |
| Tác vụ Seedance nhưng chưa chỉ định mô hình | **Bắt buộc xác nhận mô hình đích trước.** Chỉ hỏi một lần “Seedance 2.0 hay 2.5?”; đây là phần xác định đầu vào A0 của PART A, không phải câu hỏi cấu hình thông thường. Sau khi người dùng trả lời, tiếp tục cùng trạng thái thực thi Seedance; cấu hình tỷ lệ khung hình, độ phân giải, chế độ tham chiếu, âm thanh gốc và các thông số thực thi khác không thể thay thế, vượt qua hoặc cắt ngang tuyến này. |
| Tác vụ Seedance đã chỉ định 2.0/2.5 | Thực thi trực tiếp PART A; 2.0 theo A9.1, 2.5 theo A9.2. |
| Tập tiếp theo hoặc dự án đang sản xuất | Đọc lịch sử được chỉ định, các node hiện tại và bản ghi lựa chọn, xác nhận phạm vi lượt này rồi tiếp tục từ tiến độ thực tế |
| Chỉ định một đoạn, tài nguyên hoặc sửa đổi | Chỉ xử lý phạm vi đó và các phần phụ thuộc thực sự bị ảnh hưởng, không chạy lại toàn bộ quy trình |

> **Các quy tắc tạo prompt Seedance được tích hợp trực tiếp trong workflow này; đây không phải Skill bên ngoài và workflow cũng không gọi một Skill khác.** Khi nhiệm vụ bước vào giai đoạn “Kịch bản đã xác nhận → prompt từng đoạn Seedance 2.0/2.5”, phải thực thi trực tiếp **“SEEDANCE EPISODE DIRECTOR · PART A”** bên dưới. Những quy tắc tích hợp này có ưu tiên cao nhất trong giai đoạn viết prompt Seedance của workflow: lấy A0–A12 trong `SKILL-seedance-episode-director.md` do người dùng cung cấp làm cơ sở và bổ sung các yêu cầu kiểm tra tính liên tục, ổn định khi tạo và lỗi xuyên cảnh mà người dùng đã nêu sau đó. Nếu phần khác của workflow, references/methods, storyboard hoặc hướng dẫn cũ mâu thuẫn, PART A tích hợp ở đây được ưu tiên. Trừ khi người dùng sửa đổi rõ sau này, không được dùng phương pháp khác để viết lại, làm yếu hoặc thay thế khóa trung thành cốt truyện, quy tắc xác nhận mô hình, cách chia đoạn và tính thời lượng, Reference binding, mẫu A9, kiểm tra A11 hoặc bước tối ưu A12 thực hiện một lần.

### Khóa tuyến Seedance (quy tắc đầu vào ưu tiên cao nhất)

Khi đồng thời thỏa mãn hai điều kiện sau, **tự động coi đây là tác vụ Seedance**, không yêu cầu người dùng phải nói các từ kích hoạt như “Seedance”, “2.0/2.5” hoặc “tạo prompt”:

1. Hiện đã có kịch bản hoàn chỉnh có thể thực thi, timeline, đoạn nội dung theo góc máy, văn bản đoạn phim đã xác nhận, hoặc người dùng yêu cầu rõ tiếp tục dự án video đã có;
2. Ý định hiện tại là sản xuất, tạo, tiếp tục, sửa video, chuẩn bị tạo video, chuyển tình tiết thành video hoặc cấu hình video sắp được tạo.

Ngay khi thỏa mãn, lập tức khóa **trạng thái thực thi Seedance** và tuân thủ:

- **Vào PART A trước, sau đó mới xử lý cấu hình thực thi Canvas.** Mô hình đích là đầu vào bắt buộc A0, không được coi là cấu hình Canvas. Không được gọi trước các công cụ đọc Canvas (`getCanvas/findCanvasNodes/getCanvasNodes/getCanvasEdges/getNodeTools`) hoặc `node:getConfig` của node; không hỏi trước provider/resolution/ratio/mode, không làm storyboard chung hoặc chuyển sang phương pháp prompt khác rồi mới quyết định có dùng Seedance hay không.
- Nếu người dùng chưa chỉ định 2.0/2.5, **sau khi đã khóa tuyến Seedance, bắt buộc hỏi ngắn đúng một lần “Seedance 2.0 hay 2.5?”**. Sau câu hỏi vẫn giữ trạng thái thực thi Seedance, không thoát hoặc chuyển về workflow thông thường. Khi người dùng chọn mô hình, tiếp tục ngay PART A từ A0.
- Nếu người dùng đã chỉ định 2.0/2.5, đưa thông tin đó trực tiếp vào đầu vào A0; không hỏi lặp lại.
- **Tách biệt việc xác nhận mô hình đích và câu hỏi cấu hình thực thi.** Nếu chưa chỉ định 2.0/2.5, xác nhận mô hình trong A0 trước. Sau đó, nếu lớp thực thi còn cần hỏi tỷ lệ khung hình, độ phân giải, tạo âm thanh, chế độ tham chiếu, nhà cung cấp, v.v., những câu hỏi đó chỉ được bổ sung tham số cho cùng một tác vụ Seedance. Sau khi người dùng trả lời vẫn ở cùng trạng thái thực thi Seedance, không quay về workflow chung, chọn lại phương pháp prompt hoặc bỏ qua A0–A12.
- Khi người dùng chỉ trả lời ngắn “16:9”, “1080p”, “bật âm thanh gốc”, “2.5”, v.v. cho câu hỏi cấu hình, phải xem đó là **thông tin bổ sung cho tác vụ Seedance hiện tại**, không phải tác vụ mới. Không gỡ khóa chỉ vì câu trả lời không lặp lại chữ “Seedance/prompt”.
- Nếu người dùng hỏi “có những cấu hình nào/nên dùng cấu hình nào” rồi mới quyết định, việc trả lời câu hỏi cấu hình không hủy tuyến Seedance. Khi tiếp tục sản xuất video phải trở lại/tiếp tục PART A.
- Chỉ gỡ khóa tuyến Seedance khi người dùng đổi yêu cầu rõ ràng thành “không tạo/sửa prompt video, chỉ làm tài nguyên, sáng tác kịch bản, tư vấn hoặc việc khác không liên quan đến video”.
- Nếu khi tạo phương tiện thực tế, node đang chạy không hỗ trợ mô hình đã chọn ở A0, chỉ được báo xung đột khả năng thực tế và quay về sửa các mục bị ảnh hưởng của PART A. **Không được âm thầm thay tuyến Seedance bằng mô hình mặc định của lớp cấu hình.**

**Cốt lõi: Seedance là bộ quy tắc đạo diễn thực thi trong giai đoạn sản xuất video, không phải plugin tùy chọn chỉ kích hoạt khi người dùng nói một từ khóa cụ thể.**

### Cách ly nghiêm ngặt giai đoạn Seedance (bắt buộc)

Khi thỏa điều kiện “khóa tuyến Seedance” ở trên, tức là đã có nội dung kịch bản có thể thực thi và mục tiêu hiện tại bước vào sản xuất/tạo/sửa video, phải lập tức vào **trạng thái thực thi cách ly nghiêm ngặt**; không yêu cầu người dùng nói thêm “Seedance” hoặc “prompt”:

- Từ lúc vào PART A cho đến khi hoàn tất đầu ra prompt cuối cùng, **chỉ thực thi PART A tích hợp trong tệp này**. Không đọc hoặc áp dụng `references/sourceAndScript.md`, `references/methods/*`, quy tắc storyboard/cảnh quay cũ hoặc tài liệu giảng dạy dành cho con người; cũng không lấy những tài liệu đó để bổ sung hệ quy tắc thứ hai về chia đoạn, thời lượng, góc máy, vị trí nhân vật, diễn xuất, chuyển động camera, tính liên tục, âm thanh, Reference binding, mẫu prompt hoặc QA.
- Kịch bản, timeline, thiết kế nhân vật/bối cảnh/đạo cụ, node tham chiếu thực hoặc mã nhận diện tài nguyên mà người dùng đã cung cấp là đầu vào của PART A, không chịu giới hạn cách ly này.
- **Ngoại lệ duy nhất:** chỉ khi A1.2/A4 của PART A yêu cầu rõ “bổ sung tư liệu tham chiếu/đề xuất thiết kế cần thiết khi chưa có ảnh tham chiếu”, mới được đọc `references/assets.md`, `references/methods/visualDesign.md`, `references/methods/colorAndLight.md` khi cần. Chỉ lấy phần về ngoại hình, không gian, vật liệu và ánh sáng; **không đem cách tính thời lượng, bố trí góc máy, diễn xuất hoặc phương pháp kể chuyện từ các tệp đó trở lại quy tắc prompt Seedance**. Sau khi hoàn tất tài nguyên/đề xuất thiết kế phải quay lại PART A ngay.
- Sau khi prompt cuối cùng của Seedance đã được chốt theo A11/A12, chỉ khi người dùng yêu cầu rõ kết nối tham chiếu thực, ghi vào node tạo hoặc tạo/nghiệm thu phương tiện mới thoát khỏi cách ly prompt và bước vào **lớp thực thi** của `canvasExecution.md` / `stateAndDelivery.md`. Lớp thực thi chỉ được chuyển prompt đã chốt, kết nối tham chiếu thực, đặt tham số mô hình thực tế và kiểm tra kết quả; **không viết lại cách chia đoạn, định dạng, tình tiết, vị trí, diễn xuất, chuyển động camera hoặc tính liên tục đã được PART A quyết định**.
- Nếu lớp thực thi phát hiện xung đột bắt buộc giữa khả năng mô hình thực tế và prompt đã chốt, chỉ báo xung đột cụ thể rồi quay về các mục bị ảnh hưởng của PART A; quy tắc Canvas không được tự tạo một prompt tương thích khác.

**Mục đích: giai đoạn Seedance chỉ có một nguồn quy tắc đạo diễn là PART A tích hợp trong tệp này. Chỉ tuyên bố mức ưu tiên là chưa đủ thay cho cách ly nghiêm ngặt.**

**Chỉ khi kịch bản chưa chốt và thực sự cần sáng tác hoặc chuyển thể**, mới đọc [Đầu vào và kịch bản](references/sourceAndScript.md). Khi đã bước vào cách ly nghiêm ngặt của prompt Seedance, quy tắc này ngừng áp dụng.



## Bộ quy tắc thực thi tích hợp để tạo prompt Seedance

Nội dung sau lấy PART A trong `SKILL-seedance-episode-director.md` do người dùng cung cấp làm cơ sở thực thi, đồng thời tích hợp các yêu cầu bổ sung rõ ràng sau này về tính liên tục, độ ổn định khi tạo và kiểm tra lỗi xuyên cảnh. **Khi chạy, thực thi trực tiếp mục này; không đọc hoặc gọi bất kỳ Skill seedance-episode-director riêng biệt nào.** Nếu có xung đột với phần khác của workflow, mục này được ưu tiên.

# PART A — Quy tắc thực thi
═══════════════════════════════════════════

## A0. Xác định đầu vào

Sau khi nhận đầu vào, trước tiên tự xác định các điểm sau. Nếu có thể suy ra từ văn bản thì thực hiện trực tiếp; không hỏi quá hai câu trừ khi thông tin thiếu có thể làm thay đổi căn bản hướng của thành phẩm:

1. **Mô hình đích** — Nếu người dùng nói 2.5, thời lượng tối đa mỗi đoạn là 30s; nếu nói 2.0, tối đa 15s. **Nếu chưa nói, bắt buộc hỏi ngắn một lần “Seedance 2.0 hay 2.5?” trước khi tiếp tục**. Đây là bước xác định đầu vào A0 của tác vụ Seedance; trước và sau câu hỏi đều phải giữ khóa tuyến Seedance. Không chuyển sang workflow chung, cấu hình Canvas hoặc phương pháp prompt khác chỉ vì cần xác nhận mô hình.
2. **Yêu cầu tổng thời lượng** — Nếu người dùng ấn định thời lượng nghiêm ngặt (ví dụ “55s”), lập ngân sách thời gian theo A3; nếu không, ước tính tổng thời lượng từ nhịp tự nhiên của toàn bộ câu chuyện.
3. **Quy mô tự sự** — Xác định đây là một cảnh, một tập ngắn hay tập hoàn chỉnh dài 2–3 phút hoặc hơn.
   - Dù dài bao nhiêu, **lên kế hoạch toàn bộ phim trước, sau đó mới quyết định chia mấy lô bàn giao**.
   - Chia lô chỉ để quản lý khả năng bàn giao, không có nghĩa cắt bỏ hay chia lại tình tiết.
4. **Mã thời gian gốc** — Nếu người dùng cung cấp những đoạn như 【0–10s】【10–25s】, xem chúng là nhịp gốc của câu chuyện/timeline tham khảo; trừ khi họ yêu cầu “khóa chính xác”, không được mặc định mỗi khối là một đoạn tạo.
5. **Đã có thư viện tham chiếu tài nguyên chưa** (ảnh nhân vật / ảnh bối cảnh / ảnh đạo cụ / nhãn định danh)?
   - Có → **dùng tham chiếu trực tiếp** (theo A1.2).
   - Chưa có → trích tài nguyên từ văn bản kịch bản, chỉ đăng ký những tài nguyên thực sự xuất hiện trong tập này. Nếu mô hình là 2.5 và cần khóa danh tính, có thể tạo ảnh tham chiếu trước theo phần “Bổ sung cho trường hợp hai” của A1.2.
6. **Nguồn gốc chữ trong khung hình** — Phân biệt “phụ đề/tiêu đề thêm hậu kỳ” với “chữ trên vật thể thật trong cảnh/chữ trên bao bì sản phẩm”, xử lý theo A1.3.

**Ràng buộc cốt lõi: đầy đủ, đúng thứ tự, có thể tạo được.**
- Không bỏ tình tiết, không bỏ qua nhịp câu chuyện chỉ vì “khó quay”.
- Không đảo thứ tự sự kiện của câu chuyện gốc.
- Không hy sinh lời thoại tự nhiên, quá trình hành động hay thời gian phản ứng để ép số đoạn xuống mức tối thiểu lý thuyết.
- Với chuyện dài, lập “bảng toàn bộ các đoạn phim” trước, sau đó chia Batch 1 / Batch 2 / Batch 3… theo dung lượng mỗi lô; mọi lô đều giữ số thứ tự đoạn trên toàn phim.

### A0.1 Khóa trung thành cốt truyện (ưu tiên cao nhất · áp dụng toàn quy trình)

**Nguyên tắc chung: chỉ đạo diễn, không tự viết thêm kịch bản.**

Skill này được phép: **chia hoặc ghép đoạn, tính thời gian, chuyển thành các góc máy, xác định vị trí nhân vật, mô tả hành động đã có để có thể nhìn thấy và bổ sung chi tiết thực thi về vật lý/quay phim nếu không thay đổi sự thật của cốt truyện.**

Skill này không được phép: **thêm, xóa hoặc thay thế sự kiện cốt truyện; đổi thứ tự sự kiện; thay người thực hiện/chịu tác động của sự kiện; đổi nguồn gốc hoặc công dụng đạo cụ; bịa quá khứ hoặc quan hệ nhân quả người dùng chưa cung cấp; tự cụ thể hóa nhân vật được giữ mơ hồ.**

#### A0.1.1 Thứ tự ưu tiên nguồn sự thật của cốt truyện

Khi có mâu thuẫn, xác định “điều gì là sự thật trong câu chuyện” theo thứ tự sau:

1. **Chỉ thị chỉnh sửa rõ ràng gần nhất của người dùng**
2. **Tình tiết / kịch bản / timeline gốc mà người dùng hiện đang cung cấp**
3. **Thiết kế tài nguyên nhân vật, bối cảnh và đạo cụ do người dùng cung cấp rõ ràng**
4. **Prompt, bản tóm tắt và phần giải thích bổ sung do AI tạo trước đây**

**Nội dung do AI tự thêm trong lượt trước tuyệt đối không được nâng thành sự thật của cốt truyện.**

Ví dụ: AI ở phiên bản trước tự thêm “Nhân vật A lấy đạo cụ A ra khỏi hộp trước”, nhưng kịch bản gốc của người dùng chỉ ghi “Nhân vật A sử dụng đạo cụ A”. Phiên bản tiếp theo không được giữ lại hành động lấy ra được thêm vào chỉ vì “tính liên tục”.

#### A0.1.2 Năm loại thay đổi tuyệt đối bị cấm

Đối với mỗi sự kiện trong câu chuyện gốc của người dùng, cấm:

1. **Thêm mới:** nếu nguyên tác không có “mở nắp / rút giấy / đứng dậy / đưa cho / quay đầu / cầm bao bì” thì không được tự bổ sung để câu chuyện trôi chảy.
2. **Xóa bỏ:** không được xóa hành động, lời thoại, phản ứng, khoảng dừng hoặc khung hình trống có trong nguyên tác chỉ vì giới hạn thời lượng hay mong muốn diễn xuất tiết chế.
3. **Thay thế:** không được đổi hành động A trong nguyên tác thành hành động B có vẻ hợp lý hơn.
4. **Thay đổi chủ thể:** khi nguyên tác ghi “cha mẹ / phụ huynh / người lớn”, không được tự quyết đó là “bố” hoặc “mẹ”. Phải giữ đúng ai nói, ai làm, ai cầm, ai được lau.
5. **Đổi thứ tự / quan hệ nhân quả:** không đưa hành động ở sau lên trước vì logic sản phẩm, tính liên tục hoặc vẻ đẹp khung hình; cũng không tự thêm hành động chuẩn bị không có trong nguyên tác chỉ để giải thích một trạng thái xuất hiện về sau.

#### A0.1.3 Ranh giới của việc “cụ thể hóa” được phép

Chỉ được mô tả hành động gốc cụ thể hơn khi đáp ứng tất cả điều kiện:

- Chi tiết cụ thể đó **nằm trực tiếp trong quá trình thực hiện vật lý của hành động gốc**;
- Không thêm quyết định cốt truyện, thay đổi trạng thái đạo cụ hoặc quan hệ nhân vật mới;
- Nếu bỏ mô tả cụ thể đó, các sự thật của cốt truyện vẫn hoàn toàn giữ nguyên;
- Không buộc khán giả nhận thêm thông tin mà nguyên tác chưa có.

Ví dụ:
- Nguyên tác “Nhân vật A dùng đạo cụ A lau tay” → có thể viết “Đạo cụ A chạm lòng bàn tay rồi lướt qua các ngón tay” vì đây là cách thể hiện trực quan hành động đã có.
- Nguyên tác “Nhân vật A dùng đạo cụ A lau tay” → **không được** viết “Nhấc hộp → mở hộp → lấy đạo cụ A mới → rồi lau” vì như vậy đã thêm nhiều sự kiện vào cốt truyện.

Chuyển động camera, bố cục, cỡ cảnh, điểm lấy nét, hiệu ứng ánh sáng nhìn thấy và tiếng động mô phỏng tương ứng với va chạm đã có đều là chi tiết thực thi kỹ thuật, không tính là thêm tình tiết; tuy nhiên chúng cũng không được tạo ra sự thật cốt truyện mới.

#### A0.1.4 Không thêm quá khứ hoặc tự truy tìm nguồn gốc

Nếu ở đầu một khối thời gian, nguyên tác đã cho một trạng thái thì coi đó là **trạng thái khởi đầu đã xác định** của nhịp truyện này.

- Nếu nguyên tác ghi “Nhân vật A bước vào khung hình, trong tay đã có đạo cụ A” → bắt đầu trực tiếp ở trạng thái “tay đã cầm đạo cụ A”.
- Không được tự thêm “lấy hộp / mở nắp / lấy ra” chỉ vì “đạo cụ phải có nguồn gốc”.
- Nếu nguyên tác ghi “nhân vật đã đứng tại một vị trí” → có thể bắt đầu tại vị trí đó; trừ khi nguyên tác nói rõ nhân vật đứng lên/đi đến, không được thêm toàn bộ quá trình di chuyển.

**Tính liên tục chỉ duy trì các trạng thái người dùng đã định nghĩa, không có nhiệm vụ tự viết thêm quá khứ chưa được nêu.**

#### A0.1.5 Giữ nguyên thông tin mơ hồ

Với nội dung người dùng chưa xác định rõ, mặc định giữ mức độ trừu tượng ban đầu:

- Các cách gọi chung như “cha mẹ / phụ huynh / người lớn / nhân viên / ai đó” phải giữ nguyên mức độ khái quát; không tự quyết danh tính, giới tính hoặc số lượng người;
- “Một bàn tay” không suy ra là tay trái hay tay phải, trừ khi thực thi góc máy thực sự cần và không tạo thành sự thật mới ở phần tiếp theo;
- “Cầm đạo cụ A” không tự suy thành “lấy một món mới từ trong hộp”;
- “Dùng đạo cụ A để thực hiện hành động” không tự suy ra số lần dùng, số lượng tiêu hao hoặc món thứ mấy;
- “Ở bên cạnh” không tự tạo ra quan hệ không gian chính xác, trừ khi việc tạo góc máy cần tọa độ trung tính và không thay đổi cốt truyện.

#### A0.1.6 Khi cốt truyện nguồn có thiếu sót hoặc mâu thuẫn

- **Khoảng trống:** không tự viết tình tiết nối. Ưu tiên dùng HARD CUT / khối thời gian mới / đoạn mới bắt đầu từ trạng thái đã biết tiếp theo.
- **Mâu thuẫn:** không tự chọn một phiên bản để ghi đè phiên bản khác. Ưu tiên chỉnh sửa rõ ràng gần nhất của người dùng; nếu không có, đánh dấu “Mâu thuẫn trong văn bản nguồn” ở bản tổng quan toàn phim.
- **Tổng thời lượng nghiêm ngặt xung đột với cốt truyện:** được phép tăng số đoạn hoặc đánh dấu xung đột thời lượng; không được giải quyết bằng cách xóa/sửa tình tiết.

---

## A1. Ngôn ngữ đầu ra và tên tài nguyên

### A1.1 Ngôn ngữ đầu ra (bắt buộc)
**Mặc định toàn bộ bằng tiếng Việt.** Prompt chính thức, danh sách tài nguyên, vị trí đứng, diễn xuất và timeline đều dùng tiếng Việt.

**Những phần phải giữ nguyên bản gốc, không dịch:**
- Lời thoại nhân vật (chép đúng nguyên văn, ví dụ 「君は？」「何が？」).
- Giá trị số và đơn vị: `15s` `30s` `24fps` `4K` `2–3mm` `180°` `0:00–0:06`.
- Góc quang học: `29°` `47°` `84°` `107°`.
- Viết tắt kỹ thuật: `HARD CUT`.

**Quy tắc tiêu đề cấu trúc:**
- Seedance 2.0: tiêu đề các phần mặc định bằng tiếng Việt.
- Seedance 2.5: giữ đúng tiêu đề trường tiếng Anh `Objective`, `Reference binding`, `Immutable locks`, `Target duration`, `Timeline`, `Visual direction`, `Audio direction`, `Preserve`, `Avoid`; nội dung từng trường mặc định bằng tiếng Việt.

**Ngoại lệ cho phiên bản tiếng Anh toàn bộ:** chỉ khi người dùng yêu cầu rõ “cho tôi bản tiếng Anh / for an international pipeline” mới chuyển cả nội dung từng trường sang tiếng Anh.

### A1.2 Đặt tên tài nguyên và nhãn tham chiếu

**Chia thành hai trường hợp:**

**Trường hợp một · Người dùng đã có thư viện nhãn tham chiếu**
Người dùng đã sử dụng các nhãn định danh trong quy trình riêng (ví dụ `@HERO1V2`, `@林直人_v2`,
`#老宅客厅`, v.v.) —
- **Tham chiếu trực tiếp và giữ nguyên y hệt:** sao chép đúng nhãn người dùng cung cấp, bao gồm `@` / `#` và bất kỳ ký hiệu nào.
- Các nhãn này là **mã tham chiếu danh tính nhân vật/bối cảnh/đạo cụ**,
  tương ứng ảnh tham chiếu thực hoặc thư viện tài nguyên đã có.
- **Điều bị cấm là dùng khung hình cuối của đoạn trước làm tham chiếu vị trí đứng.**
  Vị trí đứng luôn phải được dựng lại bằng tọa độ tuyệt đối trong văn bản (xem A5).

**Trường hợp hai · Người dùng chưa có thư viện nhãn**
- Tên tài nguyên **không tự thêm @**, dùng tên tiếng Việt; nếu là tên riêng hoặc định danh gốc của người dùng thì giữ nguyên.
- Trong danh sách, dùng: `角色｜林直人` `场景｜老宅客厅` `道具｜梅酒瓶`.
- Trong nội dung, nhắc trực tiếp tên gốc: 「林直人」「老宅客厅」「梅酒瓶」.
- Khi một đoạn có nhiều tài nguyên cùng loại, phân biệt bằng tên sở hữu hoặc ký hiệu rõ ràng, ví dụ "cốc của Naoto / cốc của Sato".

**Bổ sung cho trường hợp hai · Không có thư viện tham chiếu nhưng cần khóa danh tính (Seedance 2.5)**

Khi mô hình đích là 2.5, người dùng chưa có cả thư viện nhãn lẫn ảnh tham chiếu nhưng đoạn hiện tại cần khóa danh tính nhân vật/bối cảnh/đạo cụ:
- Được phép tạo ảnh tham chiếu trước bằng phương pháp tài nguyên Toonflow (bảng bốn góc nhìn nhân vật / góc nhìn chính của bối cảnh / bảng đạo cụ 2×2), sau đó đưa vào Reference binding ở A1.2.1 / A9.2.
- Ảnh tham chiếu tạo ra chỉ khóa những đặc điểm “được người dùng chỉ định hoặc có thể xác định rõ”: khuôn mặt, kiểu tóc, độ tuổi cảm nhận, dáng người, trang phục của nhân vật; cấu trúc và vật liệu của bối cảnh; màu chủ đạo, hình dáng, cấu trúc đóng/mở của đạo cụ.
- Ảnh tham chiếu không được vượt phạm vi để kiểm soát vị trí đứng, ánh sáng, góc máy hay tình tiết bổ sung (tuân theo phân loại vai trò và quy tắc xử lý xung đột của ảnh tham chiếu ở A1.2.1).
- Vẫn phải tuân theo A0.1 về trung thành cốt truyện: mọi ngoại hình được tạo chỉ là “đề xuất thiết kế”, không giả làm sự thật của nguyên tác. Không được vì đó mà thêm sự kiện, nguồn gốc đạo cụ, quan hệ nhân vật hoặc quy tắc thế giới; nhân vật/đạo cụ/chữ xuất hiện trong ảnh tham chiếu mà nguyên tác không nêu không được tự đưa vào cốt truyện.

---

### A1.2.1 Liên kết ảnh tham chiếu Seedance 2.5 (bắt buộc)

Khi mô hình đích là **Seedance 2.5** và người dùng có ảnh nhân vật, bối cảnh, sản phẩm, đạo cụ, sơ đồ vị trí hoặc tham chiếu hình ảnh khác, bắt buộc liên kết các ảnh đó vào mỗi đoạn tạo liên quan như một phần của prompt chính thức.

**Quy tắc bắt buộc:**
- Node ảnh thực/mã tham chiếu do người dùng cung cấp phải được **giữ và trích dẫn nguyên dạng**, ví dụ `{{node/image-xxxx}}`, `@角色名_v2`, `#场景名`. Không tự đổi tên, viết tắt hay bịa Ref không tồn tại.
- Mỗi đoạn tạo 2.5 phải **tự chứa đầy đủ thông tin**: các ảnh tham chiếu cần thiết phải liệt kê lại trong `Reference binding` của chính đoạn đó, không viết “như trên” hoặc “dùng ảnh tham chiếu của đoạn trước”.
- Ảnh nhân vật/sản phẩm dùng xuyên suốt phim vẫn phải được liên kết lại trong từng đoạn thực sự liên quan.
- Chỉ liên kết các ảnh tham chiếu có liên quan thực sự đến đoạn hiện tại; không đưa mọi ảnh của cả tập vào tất cả các đoạn một cách tùy tiện.
- Mỗi ảnh chỉ được kiểm soát những khía cạnh mà người dùng chỉ định hoặc có thể xác định rõ, không được vượt quyền chi phối các khía cạnh khác.

**Trích xuất tài nguyên tham chiếu và đánh dấu ngắn gọn:**
- Trước tiên tự động trích xuất những **tài nguyên tham chiếu thực sự có mặt và cần được gọi trong đoạn này** từ tình tiết, góc máy, hành động và nội dung hình ảnh. Xác định vai trò ảnh nhân vật, bối cảnh, sản phẩm, đạo cụ, vị trí, chuyển động, v.v. theo công dụng thực tế.
- Với mỗi tham chiếu thực, chỉ dùng **nhãn nhận diện ngắn gọn** nêu nó là ai, là gì hoặc dùng vào việc gì; ví dụ “Tham chiếu nhân vật Naoto”, “Tham chiếu bối cảnh phòng khách nhà cũ”, “Tham chiếu đạo cụ chai rượu mơ”, “Tham chiếu vị trí của đoạn này”.
- Không thêm giải thích dài về “kiểm soát gì/không kiểm soát gì” trong `Reference binding` cuối cùng. Giới hạn vai trò của từng ảnh vẫn phải hiểu theo mục đích rõ ràng của người dùng và thông tin xác định được; cấm đưa thêm nhân vật, đạo cụ, phông nền, chữ hoặc tư thế từ ảnh vào cốt truyện vượt quyền.
- Nếu người dùng nói rõ “chỉ tham chiếu vị trí / chỉ trang phục / chỉ sản phẩm”, giữ từ “chỉ” trong nhãn ngắn gọn, ví dụ “Chỉ tham chiếu vị trí đứng”, “Chỉ tham chiếu trang phục”.

**Xử lý xung đột:**
- Nếu thiết kế người dùng viết bằng chữ mâu thuẫn với ảnh tham chiếu, dùng thứ tự ưu tiên nguồn sự thật ở A0.1.1; nội dung sửa bằng chữ rõ ràng gần nhất của người dùng có ưu tiên.
- Nếu nhiều ảnh tham chiếu mâu thuẫn nhau, không tự trộn thành thiết kế mới; dùng riêng từng ảnh theo mục đích người dùng đã nêu.
- Nếu ảnh tham chiếu có nhân vật, đạo cụ, chữ hoặc trang trí bổ sung mà người dùng chưa đề cập, không tự đưa chúng vào cốt truyện.

**Định dạng Reference binding khuyến nghị cho 2.5:**
```text
Reference binding:
- {{node/image-xxxx}}：Tham chiếu nhân vật 林直人
- {{node/image-yyyy}}：Tham chiếu bối cảnh 老宅客厅
- {{node/image-zzzz}}：Tham chiếu đạo cụ 梅酒瓶
- {{node/image-aaaa}}：Chỉ tham chiếu vị trí đứng
```

Các dạng node trong ví dụ trên chỉ minh họa **vị trí theo định dạng**. Khi chạy, bắt buộc thay chúng bằng ID node/mã tài nguyên đầy đủ do người dùng thực sự cung cấp và đoạn này cần dùng; không sao chép nguyên ID minh họa hoặc tự bịa. Nếu đoạn không có ảnh tham chiếu/mã tài nguyên thực nào, bỏ toàn bộ mục này.


### A1.3 Chữ trên hình: phụ đề hậu kỳ và chữ trên tài nguyên thật

Phải phân biệt hai loại chữ:

**A. Chữ thêm ở hậu kỳ (mặc định không giao cho mô hình tạo)**
- Phụ đề, tiêu đề, thẻ giải thích, thẻ lời dẫn, chữ trên nhãn dán, chữ giao diện đè lên hình, hình mờ.
- Mặc định viết: **Không phụ đề, không chữ màn hình bổ sung, không lớp chữ hậu kỳ**.
- Nếu cần những chữ này, mặc định để khâu dựng hậu kỳ bổ sung.

**B. Chữ thực trong cốt truyện / trên sản phẩm (không phải phụ đề)**
- Chữ in sẵn trên bao bì, biển hiệu, thư, trang sách, giao diện điện thoại, v.v.
- Nếu người dùng cung cấp ảnh tham chiếu/ảnh tài nguyên, ưu tiên ghi **“Giữ nguyên nghiêm ngặt hình thức của tài nguyên tham chiếu; không thêm, viết lại hoặc vẽ lại chữ trên bao bì”**. Không buộc mô hình tự tạo chữ sắc nét từ đầu.
- Nếu không có tài nguyên tham chiếu, trừ khi cốt truyện yêu cầu phải đọc được chữ cụ thể, không biến “chữ phải rõ để đọc” thành yêu cầu tạo.
- Chỉ khi người dùng yêu cầu rõ phải đọc được chữ trong đoạn nào đó mới khóa chính xác từng chữ; đồng thời lưu ý đây là hạng mục tạo có rủi ro cao.

**Vì vậy:** “Không phụ đề / không chữ màn hình bổ sung” không mâu thuẫn với “chữ đã in trên bao bì sản phẩm”. Điều bị cấm là AI tự thêm hoặc sửa chữ, chứ không phải biến bao bì thật thành bao bì không chữ.

---

## A2. Phân tích đầy đủ các nhịp truyện và giữ nguyên thứ tự (không loại bỏ tình tiết)

Mục tiêu của A2 không phải “chọn vài điểm quan trọng” mà là chia câu chuyện gốc thành **các nhịp tự sự đầy đủ, liên tục và có thể tính thời lượng**. Năm loại nhịp quan trọng chỉ dùng để đánh dấu, không dùng làm tiêu chí cắt bỏ.

### A2.1 Nhịp nguyên tử: giữ tất cả và lập “sổ cái tình tiết nguồn”

Trước tiên chia thành các nhịp nguyên tử theo đúng thứ tự nguyên tác, gồm những loại thường gặp:

| Nhịp nguyên tử | Định nghĩa | Ví dụ |
|---|---|---|
| **Lời thoại** | Một câu hoàn chỉnh hoặc chuỗi câu liên tiếp nhân vật thực sự nói | Hỏi, đáp, ngắt lời, bổ sung |
| **Hành động** | Hành động làm thay đổi vị trí, đồ vật hoặc trạng thái cơ thể | Nhấc lên, đặt xuống, đứng dậy, đi đến cửa |
| **Phản ứng** | Đáp lại một sự kiện trước đó, có thể không cần lời nói | Dừng chiếc cốc, né lùi, nhìn cổ tay, im lặng |
| **Thông tin** | Khán giả/nhân vật tiếp nhận một sự thật mới | Nhìn thấy vật nào đó, nhận ra sản phẩm, phát hiện vết thương |
| **Chuyển tiếp/khoảng lặng** | Chuyển đổi không gian, thời gian hoặc cảm xúc được người dùng yêu cầu rõ trong nguyên tác | Khung hình không người, tiếng môi trường, khoảng dừng, nối cảnh |

**Phải ghi nhận tất cả nhịp nguyên tử.** Hành động bình thường dù không thuộc “cao trào/cú ngoặt” cũng không được mất đi.

Đánh số nội bộ cho từng nhịp nguồn `E01 / E02 / E03 ...`, ít nhất ghi:
- Ai thực hiện sự kiện / ai nói trong nguyên tác;
- Hành động hoặc lời thoại cụ thể;
- Đối tượng/đạo cụ bị tác động;
- Thứ tự gốc so với sự kiện trước và sau;
- Người dùng có cung cấp rõ các dữ kiện về thời gian, vị trí, số lượng, tay trái/phải, nguồn gốc đạo cụ, v.v. hay không.

Trong mọi Timeline tiếp theo, **mỗi câu làm thay đổi trạng thái cốt truyện** phải ánh xạ được về một `E##`. Nội dung không có `E##` chỉ được phép là chi tiết quay phim, bố cục, kết quả ánh sáng có thể nhìn thấy, chi tiết vật lý/tiếng động trực tiếp của hành động đã có hoặc mô tả thực thi không thay đổi sự thật cốt truyện.

**Nếu một câu làm thay đổi nhân vật, đạo cụ, vị trí, số lượng, quan hệ, thông tin hoặc nhân quả nhưng không tìm được nhịp nguồn tương ứng → xem là tình tiết do AI tự thêm và phải xóa.**

### A2.2 Năm nhãn quan trọng: chỉ đánh dấu mức độ quan trọng, không đổi thứ tự

Gắn thêm nhãn cho các nhịp nguyên tử:
- **Điểm ngoặt:** quan hệ / quyền lực / thông tin đảo chiều.
- **Đỉnh cảm xúc:** cảm xúc bộc lộ mạnh nhất trong đoạn/cảnh.
- **Điểm thông tin mới:** dữ kiện mới làm thay đổi cách hiểu.
- **Điểm quyết định:** nhân vật lựa chọn và chịu hậu quả.
- **Điểm im lặng:** khoảng lặng có dụng ý sau phần dẫn dắt.

**Quy tắc bắt buộc:**
- Nhãn có thể chồng lấp; một nhịp thuộc nhiều loại cùng lúc.
- Nhịp không có nhãn quan trọng nào vẫn phải giữ.
- **Nghiêm cấm “sắp lại tình tiết theo đường cong cảm xúc”.** Đường cong cảm xúc chỉ được ghi chú theo thời gian nguyên tác: thấp → căng thẳng → đỉnh điểm → giải tỏa; đây là sơ đồ phân tích, không phải lệnh dựng lại thứ tự câu chuyện.

### A2.3 Lập ngân sách thời gian cho từng nhịp trước

Ước tính thời lượng tự nhiên tối thiểu của mỗi nhịp nguyên tử:

`Thời lượng tối thiểu của nhịp = thời gian thoại tự nhiên + khoảng dừng cần thiết + thời gian hành động/phản ứng bắt buộc diễn ra tuần tự`

Lưu ý:
- “Nói + cử động nhỏ” có thể tính chồng thời gian nếu tự nhiên diễn ra đồng thời;
- Các hành động nhân quả bắt buộc nối tiếp phải cộng thời lượng;
- Không xử lý thô lời thoại dài bằng quy tắc “câu dài cố định 3–3,5s”; phải ước tính thời gian đọc tự nhiên dựa trên độ dài văn bản thực, khoảng ngắt và ngữ điệu;
- Nếu không chắc, nên dành khoảng 10%–20% thời gian thở thay vì ép thoại vào nhịp nói nhanh bất thường;
- Các khoảng dừng, phản ứng, quay người, di chuyển vị trí quan trọng không được lời thoại chiếm hết thời gian.

### A2.4 Nhịp truyện → góc máy → đoạn tạo

Chỉ ghép các nhịp **liền kề theo thời gian**, không nhảy qua tình tiết ở giữa để ghép. **Ghép đoạn chỉ thay đổi cách chứa nội dung, không thay nội dung, người thực hiện, đối tượng, thứ tự hoặc số lượng của bất kỳ `E##` nào. Một nhịp nguồn có thể được thể hiện qua nhiều góc máy nhưng không được viết lại thành sự kiện khác.**

Một đoạn có thể chứa nhiều nhịp nhưng “1–4 nhịp” chỉ là kinh nghiệm tham khảo, không phải giới hạn cứng. Quyết định có ghép tiếp hay không theo các điều kiện:
1. Tổng thời lượng sau khi ghép ≤ giới hạn mỗi đoạn của mô hình;
2. Tất cả lời thoại có thể nói hết với tốc độ tự nhiên;
3. Hành động nhân quả quan trọng có quá trình hoàn chỉnh;
4. Ít nhất còn đủ thời gian cho phản ứng và nhịp thở cần thiết;
5. Không nhồi đến mức phải cắt góc máy mỗi 1–2 giây;
6. Cuối đoạn có trạng thái rõ ràng, có thể được khai báo lại ở đoạn kế tiếp.

Khi gặp bất kỳ trường hợp nào sau đây, chủ động mở đoạn mới dù về lý thuyết vẫn còn chỗ:
- Lời thoại đã gần chạm ngân sách thời gian;
- Trong cùng đoạn có quá nhiều hành động/phản ứng cạnh tranh;
- Cảm xúc hoặc mục tiêu chuyển giai đoạn rõ rệt;
- Bối cảnh hoặc thời gian thay đổi;
- Ghép thêm sẽ làm mất khả năng tạo độc lập của từng đoạn;
- Phải nói nhanh bất thường, dịch chuyển tức thời hoặc bỏ phản ứng mới nhét vừa.

### A2.5 Cách chia lô câu chuyện dài

**Hoàn tất kế hoạch toàn bộ các đoạn phim trước, sau đó mới chia lô bàn giao.**

Ví dụ một tập dài 180s:
- Seedance 2.0 có số đoạn tối thiểu lý thuyết là 12 nhưng thực tế có thể thành 13, 14, 15… tùy mật độ thoại;
- Trước tiên cố định số thứ tự toàn phim là G01, G02, G03…;
- Sau đó bàn giao tối đa 6 đoạn mỗi lô: Batch 1 = G01–G06, Batch 2 = G07–G12, Batch 3 = các đoạn còn lại;
- Seedance 2.5 làm tương tự, tối đa 3 đoạn mỗi lô.

**Ranh giới giữa các lô chỉ ảnh hưởng số đoạn bàn giao trong một lần, không thay thứ tự toàn phim, số thứ tự đoạn hoặc tính liên tục.**

### A2.6 Phương án dự phòng

Nếu câu chuyện không có điểm ngoặt hoặc đỉnh cảm xúc rõ ràng, không được cố tạo ra năm loại điểm quan trọng. Chỉ cần tiếp tục lên kế hoạch đúng thứ tự nguyên tác, lấy “một đơn vị hành động/lời thoại/phản ứng có thể thực hiện trọn vẹn” làm một nhịp.

---

## A3. Chia đoạn và lập ngân sách thời lượng

### A3.0 Phân biệt “số đoạn tối thiểu lý thuyết” và “số đoạn thực tế” trước

**Giới hạn cứng của mỗi đoạn:**
- Seedance 2.0: mỗi đoạn ≤ 15s.
- Seedance 2.5: mỗi đoạn ≤ 30s.

Khi người dùng đặt tổng thời lượng nghiêm ngặt, có thể tính số đoạn tối thiểu lý thuyết trước:

```text
Số đoạn tối thiểu lý thuyết = ⌈tổng thời lượng / giới hạn mỗi đoạn⌉
```

Công thức này chỉ trả lời “cần ít nhất bao nhiêu đoạn”, **không có nghĩa thực tế bắt buộc chỉ được làm đúng số đó**.

Ví dụ: 55s / Seedance 2.0:
- Tối thiểu lý thuyết = 4 đoạn;
- Nếu lời thoại/hành động ít, có thể chia 15 + 15 + 15 + 10;
- Nếu tình tiết dày, cũng có thể chia 12 + 11 + 11 + 11 + 10 = 55s;
- Miễn mỗi đoạn ≤ 15s, tổng phù hợp thời lượng người dùng yêu cầu và cốt truyện được giữ đầy đủ.

**Nguyên tắc: cân bằng giữa “không quá dày” và “không quá vụn”, thay vì theo đuổi số đoạn ít nhất.**

### A3.1 Trình tự xác định số đoạn thực tế

Quyết định theo thứ tự:
1. Hoàn tất các nhịp đầy đủ và ngân sách thời lượng tối thiểu của A2 trước;
2. Ghép các nhịp liền kề từ đầu đến cuối;
3. Mỗi khi gần chạm giới hạn đoạn, kiểm tra lời thoại, hành động và phản ứng còn tự nhiên không;
4. Nếu không còn tự nhiên, kết thúc sớm và mở đoạn mới;
5. Xác định **số đoạn thực tế của toàn phim**;
6. Cuối cùng chia Batch theo A3.4.

Không quyết trước “phải có 4 đoạn” rồi ép nội dung nhét vào 4 đoạn.

### A3.2 Kiểm tra thời lượng lời thoại (điều kiện cứng)

Mỗi câu thoại phải thực sự nói hết được trong góc máy/khoảng thời gian tương ứng.

Cách thực hiện:
- Đầu tiên ước tính thời gian đọc theo giọng nói tự nhiên;
- Sau đó cộng các khoảng dừng, nói lắp, thở gấp, ngập ngừng đã được kịch bản yêu cầu rõ;
- Nếu trong lúc nói có cử động nhỏ diễn ra đồng thời, có thể tính trùng thời gian;
- Nếu hành động phải hoàn tất trước/sau lời thoại, nó chiếm thời gian riêng;
- **Cấm giải quyết thiếu thời lượng bằng tốc độ nói nhanh bất thường;**
- **Cấm xóa từ, đổi từ hoặc nuốt cuối câu vì không đủ thời lượng.**

Nếu “tổng thời lượng nghiêm ngặt” người dùng đưa ra mâu thuẫn với thời lượng tự nhiên tối thiểu của “toàn bộ lời thoại gốc + hành động bắt buộc”:
- Ưu tiên rút ngắn khung hình trống, khoảng dừng không thêm thông tin và chuyển động camera dư thừa **do AI tự thêm**; các khung hình trống, khoảng dừng và khoảng lặng được người dùng nêu rõ trong nguyên tác không được rút ngắn hoặc xóa;
- Nếu vẫn không đủ, đánh dấu rõ “Xung đột giới hạn thời lượng” trong tổng quan toàn phim;
- Không tự xóa thoại hoặc sửa cốt truyện để giả vờ đáp ứng.

### A3.3 Cách ghi timeline

- Mốc thời gian của từng đoạn bắt đầu lại từ `00:00` để có thể đưa riêng vào mô hình;
- Tổng quan toàn phim phải ghi thêm **khoảng thời gian toàn cục** tương ứng với mỗi đoạn;
- Các mốc thời gian hành động trong cùng đoạn không được mâu thuẫn;
- Hành động song song có thể trùng khoảng thời gian nhưng phải ghi rõ “đồng thời”;
- Hành động tuần tự phải tiếp nối trước/sau, không ép nhiều hành động không thể diễn ra đồng thời vào cùng một giây.

### A3.4 Câu chuyện dài và giới hạn mỗi lô

**Giới hạn bàn giao mỗi lô (giới hạn dung lượng, không phải giới hạn toàn phim):**
- Seedance 2.0: tối đa 6 đoạn/lô;
- Seedance 2.5: tối đa 3 đoạn/lô.

Nếu vượt giới hạn:
- Giữ số thứ tự đoạn liên tục trên toàn phim;
- Chỉ chia thành nhiều Batch;
- Không đánh lại số thứ tự các đoạn trước;
- Không gọi phần chưa bàn giao là “bị cắt bỏ”, thống nhất gọi là “những đoạn chờ bàn giao ở lô tiếp theo”.

Một câu chuyện 2–3 phút hoàn toàn có thể chia thành 2, 3, 4 lô hoặc nhiều hơn.

### A3.5 Mật độ góc máy trong mỗi đoạn (khuyến nghị, không phải giới hạn cứng)

- Seedance 2.0: thường 1–2 góc máy chính; khi nội dung rất nhẹ có thể 3, nhưng tránh dựng vụn;
- Seedance 2.5: thường 2–4 góc máy chính.

Nếu để chứa hết tình tiết trong một đoạn phải liên tục HARD CUT với tần suất cao, ưu tiên chia đoạn thay vì nhồi thêm góc máy.

### A3.6 Các điều cấm chung và quy tắc chữ

Mặc định cấm:
- Không chuyển cảnh chồng mờ, chớp trắng, lia máy giật hoặc thay đổi tốc độ không có căn cứ tình tiết;
- Không thêm VO, lời dẫn hoặc lời thoại người dùng chưa cung cấp;
- Không tự thêm BGM hoặc âm thanh hiệu ứng nhấn cảm xúc;
- Không thêm nhân vật, đạo cụ hoặc hành động tình tiết mới;
- **Không tạo phụ đề hậu kỳ, tiêu đề, thẻ giải thích, chữ giao diện đè lên, watermark hoặc chữ màn hình bổ sung khác.**

Với chữ thực đã có trong cảnh/chữ trên bao bì sản phẩm, áp dụng A1.3:
- Nếu có tài nguyên tham chiếu, giữ nguyên hình thức tham chiếu; không thêm, viết lại hoặc vẽ lại chữ;
- Không hiểu sai “bao bì phải xuất hiện” thành “buộc AI tạo chữ rõ ràng và chính xác”.

---

## A4. Lập kế hoạch tài nguyên và trạng thái xuất hiện trong hình (theo timeline)

A4 là **quy tắc lập kế hoạch nội bộ** dùng chung cho mọi mô hình. Nếu một nhân vật có trạng thái xuất hiện khác nhau ở các khối thời gian/góc máy trong cùng một đoạn, phải ghi riêng theo timeline, không chỉ ghi một trạng thái chung mơ hồ.

**Bổ sung A4 · Đề xuất thiết kế khi thiếu ngoại hình và ánh sáng**

Khi kịch bản/người dùng chưa cung cấp ngoại hình một nhân vật hoặc ánh sáng và sắc thái môi trường một bối cảnh, nhưng hình ảnh của tập này thật sự cần:
- Được phép suy ra một “đề xuất thiết kế” theo phương pháp thiết kế hình ảnh / màu sắc và ánh sáng Toonflow (visualDesign / colorAndLight), điền vào các đặc điểm nhận diện và ngoại hình hoặc ánh sáng bối cảnh của đoạn;
- Mọi đề xuất đều phải ghi rõ “đề xuất thiết kế”, không xem là sự thật cốt truyện; không vì thế thêm tình tiết, nguồn gốc đạo cụ, quan hệ nhân vật hoặc quy tắc thế giới;
- Nếu không ảnh hưởng đến việc tạo đoạn này, giữ nguyên mức độ trừu tượng của nguyên tác, không ép bổ sung thiết kế (theo A0.1.5).

**Ánh xạ vào đầu ra cuối:**
- Seedance 2.0: vẫn xuất riêng mục “Nhận diện tài nguyên” trước nội dung của mỗi đoạn.
- Seedance 2.5: không xuất thêm một khối “Nhận diện tài nguyên” trùng lặp; ánh xạ thông tin A4 vào các trường `Reference binding`, `Immutable locks`, `Timeline` và `Preserve`. Chỉ xuất thêm danh sách tài nguyên riêng khi người dùng yêu cầu rõ.

Để lập kế hoạch nội bộ có thể dùng định dạng sau:

```text
## Nhận diện tài nguyên

### Nhân vật liên quan

Nhân vật A｜Tổng quan trạng thái xuất hiện
- Khối thời gian / Góc máy 1｜00:00–00:XX｜Chỉ tay / Xuất hiện trong hình / Hoàn toàn ngoài khung…｜Có thoại / Không thoại
- Khối thời gian / Góc máy 2｜00:XX–00:XX｜…

Danh tính + đặc điểm ngoại hình: chỉ dùng thông tin người dùng đã cung cấp.
Tọa độ thế giới: chỉ ghi quan hệ không gian đã được nguyên tác xác định hoặc tọa độ trung tính bắt buộc để tạo.
Tọa độ khung hình: mô tả theo vị trí camera hiện tại, không thay đổi sự thật về vị trí thế giới.
Trạng thái đặc biệt: chỉ ghi các trạng thái bẩn / bị thương / ẩm ướt / cầm đồ, v.v. đã có trong nguyên tác.
Diễn xuất trọng tâm của đoạn: làm cho hành động đã có nhìn thấy được, không thêm hành động.
Giữ nguyên chính xác lời thoại đồng bộ theo nguyên tác:
「……」

Nhân vật B｜Tổng quan trạng thái xuất hiện
- Khối thời gian / Góc máy 1｜00:00–00:XX｜Hoàn toàn ngoài khung｜Chỉ có lời thoại đồng bộ
- Khối thời gian / Góc máy 2｜00:XX–00:XX｜Xuất hiện trong hình｜Không thoại
……

### Bối cảnh liên quan
Bối cảnh A｜Thời gian
(Đặc điểm cố định của bối cảnh + vị trí/hướng/độ cao camera + tiền/trung/hậu cảnh + quan hệ không gian)

### Đạo cụ quan trọng
Đạo cụ A
(Trạng thái đầu đoạn do nguyên tác cung cấp + hành động trên timeline đã có trong nguyên tác + trạng thái cuối đoạn + cách xử lý chữ/bao bì; không truy ngược nguồn gốc chưa được nêu)
```

### A4.1 Bảng thuật ngữ trạng thái xuất hiện của nhân vật

Chọn theo vùng thực sự nhìn thấy trong mỗi góc máy:
- Xuất hiện trong hình và đang nói;
- Xuất hiện trong hình nhưng không nói;
- Chỉ một phần khuôn mặt xuất hiện;
- Chỉ bàn tay xuất hiện;
- Chỉ xuất hiện phía sau vai;
- Chỉ thấy lưng;
- Chỉ thấy bàn chân;
- Hoàn toàn ngoài khung｜Chỉ có lời thoại đồng bộ;
- Hoàn toàn ngoài khung｜Không có tiếng.

**Nếu cùng một nhân vật có từ hai trạng thái trở lên trong cùng đoạn → bắt buộc liệt kê theo timeline.**

### A4.2 Mục nhân vật bắt buộc chứa sáu loại thông tin
1. Danh tính + đặc điểm ngoại hình;
2. Timeline trạng thái xuất hiện theo từng góc máy;
3. Tọa độ thế giới + tọa độ khung hình;
4. Trạng thái đặc biệt (những thứ thay đổi trong đoạn: bẩn / vết thương / độ ẩm / cảm xúc biểu lộ, v.v.);
5. Diễn xuất trọng tâm + 3–5 yêu cầu diễn xuất nhìn thấy được;
6. Lời thoại đồng bộ nguyên văn (nếu có).

### A4.3 Mục bối cảnh bắt buộc chứa bốn loại thông tin
1. Đặc điểm cố định của bối cảnh;
2. Vị trí + hướng + độ cao camera;
3. Tiền cảnh / trung cảnh / hậu cảnh;
4. Quan hệ không gian và trục giữa nhân vật/địa vật.

### A4.4 Mục đạo cụ bắt buộc chứa bốn loại thông tin
1. Vị trí tuyệt đối / người sử dụng / trạng thái đầu đoạn;
2. Hành động trên timeline của đoạn này (ai, khi nào, di chuyển thế nào);
3. Trạng thái cuối đoạn;
4. Những điều cấm; nếu có chữ bao bì, ghi rõ theo A1.3 “Giữ nguyên tài nguyên tham chiếu, không thêm/viết lại/vẽ lại chữ”.

### A4.5 Những điều cấm
- Không sao chép cả hồ sơ nhân vật; chỉ giữ đặc điểm cần thiết cho đoạn này;
- Không liệt kê tài nguyên không xuất hiện;
- Không biến phần nhận diện tài nguyên thành bản chép lại toàn bộ tình tiết;
- Không viết tổng quát mâu thuẫn như “nhân vật xuất hiện và nói trong đoạn này (nhưng lại ngoài khung ở góc máy 1)”;
- Không yêu cầu AI tự tạo chữ bao bì chính xác để thay tài nguyên tham chiếu.

---

## A5. Vị trí nhân vật: tọa độ thế giới + tọa độ khung hình (hai lớp · tự chứa đầy đủ)

**Tiền đề cốt lõi: khi tạo từng đoạn, mô hình không nhìn thấy khung hình của bất kỳ đoạn trước nào và không phụ thuộc vào tham chiếu khung hình cuối của đoạn trước.**

### A5.1 Năm nhóm thông tin bắt buộc tự chứa trong từng đoạn

1. **Tọa độ thế giới · trục và địa vật:** vị trí thực của nhân vật so với cửa, bàn, cửa sổ, hành lang, v.v.; độc lập với vị trí camera.
2. **Tọa độ khung hình · trái/phải, trước/sau, che khuất trong góc máy hiện tại:** khai báo lại cho từng vị trí camera.
3. **Hướng nguồn sáng · lớp thế giới + lớp khung hình:** chỉ kế thừa khi điều kiện chiếu sáng liên tục như nhau.
4. **Vị trí và trạng thái tuyệt đối của đạo cụ:** gồm cả quỹ đạo di chuyển trong đoạn.
5. **Trạng thái kết thúc đoạn:** đoạn tiếp theo phải viết lại thành “trạng thái khởi đầu tuyệt đối”, không ghi “tiếp nối đoạn trước”.

### A5.2 Chuỗi trạng thái của cảnh liên tục

Trong cùng địa điểm và dòng thời gian liên tục:

`Trạng thái cuối đoạn trước → Viết lại thành trạng thái khởi đầu tuyệt đối của đoạn sau → Hành động trong đoạn → Trạng thái cuối đoạn`

Nội dung cần kế thừa gồm:
- Vị trí thực của nhân vật trong thế giới và hướng cơ thể;
- Vị trí đạo cụ, người giữ, số lượng, mực chất lỏng, vết bẩn/hao mòn;
- Các trạng thái kéo dài như thương tích, trang phục, độ ẩm, máu, khói bụi;
- Hướng ánh sáng chính, nhiệt độ màu và điều kiện môi trường.

### A5.3 Di chuyển nhân vật chỉ theo nguyên tác, không thêm hành động để nối cảnh

Cấm AI tự tạo thay đổi vị trí không có căn cứ, đồng thời cấm thêm tình tiết chỉ để “giải thích việc đổi vị trí”.

- Nguyên tác ghi rõ “đứng dậy đi đến cửa” → bắt buộc giữ cả quá trình đứng dậy, đi và đến nơi, không dịch chuyển tức thời.
- Nhịp tiếp theo của nguyên tác chỉ ghi “nhân vật đã đứng ở cửa” mà không nói nhân vật đến đó thế nào → coi “đứng ở cửa” là trạng thái khởi đầu đã xác định của nhịp đó; được phép dùng HARD CUT / đoạn mới để bắt đầu; **không tự thêm “đứng dậy, đi đến”.**
- Nếu nguyên tác ghi rõ hai người đổi chỗ → thực hiện theo quá trình đã viết; nếu không ghi đổi chỗ → không được hoán đổi vị trí thế giới của hai người chỉ để đẹp bố cục.
- Trái/phải trong khung hình có thể thay đổi do chuyển vị trí camera hợp lệ, nhưng vị trí thế giới không được tự thay đổi vô cớ.

### A5.4 Quy tắc trục

- Trong cùng cuộc đối thoại liên tục, mặc định giữ trục 180° đã có;
- Nếu người dùng yêu cầu rõ góc phản hồi/đổi qua trục, hoặc cốt truyện cần đổi trục, phải dùng góc máy trung tính, chuyển động vượt trục hoặc góc máy thiết lập để người xem hiểu sự thay đổi không gian;
- Cấm nhảy trục không báo trước;
- **“Không vượt trục” không có nghĩa camera không bao giờ được đổi vị trí.**

### A5.5 Xác lập lại mốc khi đổi cảnh hoặc nhảy thời gian

Khi bối cảnh, thời gian, thời tiết hoặc nguồn sáng chính thay đổi rõ ràng:
- Xác lập lại tọa độ thế giới, tọa độ khung hình, trục và ánh sáng cho cảnh mới;
- Không ép kế thừa vị trí camera hoặc hướng ánh sáng của cảnh trước;
- Quyết định có kế thừa trang phục, thương tích, đạo cụ mang theo, v.v. của nhân vật hay không theo tính liên tục thời gian trong cốt truyện.

Như vậy có thể hỗ trợ chuyện nhiều bối cảnh kéo dài 2–3 phút hoặc hơn mà không khóa cứng quy tắc vị trí của cảnh đầu cho cả tập.

---

## A6. Lớp diễn xuất

### A6.1 Cảm xúc = kết quả phụ của hành vi
Không viết “anh ấy rất buồn”, hãy viết anh ấy **đang làm gì**. Cảm xúc được bộc lộ qua những sai lệch rất nhỏ trong hành động.

### A6.2 Mục tiêu hướng đến đối tượng cụ thể
Chỉ khi nguyên tác của người dùng đã cho thấy rõ mục tiêu của nhân vật mới chuyển nó thành mục tiêu có thể thực hiện và hướng đến người / vật / nhiệm vụ cụ thể. **Không tự suy ra động cơ, mục đích bí mật hoặc ý đồ quan hệ của nhân vật chỉ để diễn xuất đầy đủ hơn.**

### A6.3 Ưu tiên trạng thái, nhưng hành động nhân quả quan trọng phải giữ quá trình
Các hành động nhân quả quan trọng (cầm lấy / đặt xuống / đổ chất lỏng / mở cửa / đổi tay / ngồi xuống / đứng dậy / di chuyển vị trí) không được xảy ra kiểu dịch chuyển tức thời.

### A6.4 Vi biểu cảm phải có căn cứ nguyên tác + trigger
Chỉ khi nguyên tác đã có phản ứng/biểu lộ cảm xúc tương ứng mới được mô tả vi biểu cảm dưới dạng `[Vi biểu cảm nhìn thấy được của phản ứng đã có] + [Điều kiện kích hoạt trong nguyên tác]`. **Không được tự thêm phản ứng như nhíu mày, mím môi, đỏ mặt, nuốt nước bọt, cười gượng, v.v. chỉ vì khung hình cận.**

### A6.5 mask + crack (chỉ khi nguyên tác hỗ trợ)
- **mask:** chỉ tổ chức lại trạng thái bề ngoài mà người dùng đã cho, không tự gán cho nhân vật sự “che giấu”.
- **crack:** chỉ cụ thể hóa phản ứng đã có thành một dấu hiệu lộ ra có thể nhìn thấy, không thêm phản ứng mới.
- Không xếp liên tục nhiều crack trong cùng góc máy; nếu nguyên tác không có crack thì có thể hoàn toàn không dùng.

### A6.6 Chọn kênh diễn xuất theo phần cơ thể nhìn thấy (bắt buộc ghi)

| Phần nhìn thấy trong góc máy | Kênh diễn xuất chính |
|---|---|
| Thấy khuôn mặt | Ánh mắt + thay đổi rất nhỏ trên mặt |
| Chỉ thấy tay | Lực nắm + nhịp cử động + chạm |
| Thấy lưng | Trọng tâm + vai/cổ + hơi thở |
| Thấy bàn chân | Dáng đi + chuyển trọng lượng |
| Toàn thân ở cảnh xa | Tư thế + cách chiếm lĩnh không gian |

**Chỉ mô tả kênh diễn xuất thực sự nhìn thấy trong góc máy này.**

### A6.7 Thời điểm phản ứng so với lời thoại
Phản ứng có thể bắt đầu trước khi đối phương nói xong, nhưng phải có từ ngữ/hành động kích hoạt rõ ràng; không máy móc quy định “mọi phản ứng đều phải đợi hết thoại” hoặc “mọi phản ứng đều phải đến sớm”.

### A6.8 Bùng nổ cảm xúc theo lối tiết chế
Với cảm xúc mạnh, được phép bớt những **chi tiết diễn xuất trang trí do AI tự thêm**, ví dụ bỏ một lần nhíu mày bổ sung hoặc một tiếng thở dài dư thừa; **không được xóa, thay thế hoặc lùi thời điểm hành động/lời thoại/phản ứng trong nguyên tác của người dùng.** Có thể dùng biên độ nhẹ hơn và diễn xuất ngắn hơn để biểu đạt sự tiết chế, nhưng sự kiện cốt truyện phải giữ nguyên.

### A6.9 Số sự kiện vi biểu cảm (tham khảo mức tối đa, không phải chỉ tiêu tối thiểu)
- Đoạn ≤15s: thường không quá 1–2 vi phản ứng đã có trong nguyên tác;
- Đoạn 16–30s: thường không quá 2–3 vi phản ứng đã có trong nguyên tác.

**Hoàn toàn được phép có 0. Không thêm vi biểu cảm để đạt số lượng.** Nếu góc máy chỉ thấy tay/lưng, không cố viết vi biểu cảm trên mặt.

---

## A7. Chuyển động camera và nối giữa các đoạn

### A7.1 Đường cong cảm xúc

```text
Thấp ──→ Trung bình ──→ Cao ──→ Giải tỏa
Mở đầu      Áp lực         Đỉnh điểm    Hạ xuống
```

Đường cong cảm xúc được ghi theo trình tự thời gian của nguyên tác, không được dùng để sắp lại tình tiết.

### A7.2 Vị trí cảm xúc → chuyển động camera
Đỉnh cảm xúc có thể chia thành ba loại: nội tâm, đảo chiều thông tin và hành động bên ngoài. Chuyển động camera phải tuân theo phong cách người dùng chỉ định; không tự động đẩy máy tới gần hoặc dùng đặc tả chỉ vì có “đỉnh cảm xúc”.

### A7.3 Quy tắc nối giữa các đoạn (ưu tiên tạo độc lập)

**Phạm vi đánh giá: chỉ xét “góc máy cuối của đoạn N” và “góc máy đầu của đoạn N+1”.**

Thuộc tính góc máy chia thành ba loại:
- **Chủ thể quay:** hai người / một người / một bộ phận / khung hình không người / nhóm người;
- **Cỡ cảnh:** toàn cảnh / trung cảnh / cận cảnh / đặc tả / siêu đặc tả;
- **Góc nhìn:** chính diện / bên hông / phía sau / qua vai / nhìn từ trên xuống / nhìn từ dưới lên.

Để tránh hai đoạn tạo độc lập trông như khung hình nối sai tại điểm cắt, mặc định phần nối phải đáp ứng ít nhất một điều kiện:
1. Loại chủ thể quay khác nhau;
2. Cỡ cảnh khác ít nhất 2 cấp;
3. Góc quay khác ít nhất 90°.

Nếu cả ba điều kiện đều không đạt, chỉ được điều chỉnh **chủ thể quay/cỡ cảnh/góc quay/bố cục** của góc máy đầu đoạn sau, không được sửa sự kiện nguồn, vị trí thực của nhân vật, hành động, đạo cụ hay lời thoại tương ứng với góc máy đó.

**Khuyến nghị:**
- Trung cảnh hai người → đặc tả một người/một bộ phận;
- Trung cảnh hai người → khung hình không người;
- Trung cảnh một người → trung cảnh hai người;
- Đặc tả một bộ phận → trung cảnh hai người;
- Khung hình không người → trung cảnh hai người;
- Trung cảnh nghiêng một người → đặc tả chính diện một người.

**Rủi ro cao:**
- Cùng chủ thể + cùng cỡ cảnh + góc nhìn gần giống nhau nhưng cắt thẳng sang đoạn khác;
- Nối cứng cùng một động tác tay giữa hai đoạn tạo độc lập.

Lưu ý: không có hệ quy tắc thứ hai như “cấm mọi trường hợp bộ phận → bộ phận” mâu thuẫn với ba điều kiện trên. Nếu chủ thể/cỡ cảnh/góc nhìn đã có đủ khác biệt thì được dùng, nhưng vẫn phải bảo đảm người xem dễ hiểu tính liên tục.

### A7.4 Dựng nối hành động

Với cùng một hành động chưa hoàn tất, kỹ thuật match-on-action **ưu tiên chỉ thực hiện trong cùng một đoạn tạo**:
- Khung cuối của góc máy A: hành động vẫn đang diễn ra;
- HARD CUT;
- Khung đầu góc máy B: tiếp tục và hoàn thành hành động.

Khi nối giữa các đoạn tạo, ưu tiên cho hành động hoàn tất trong đoạn trước và bắt đầu đoạn sau từ “trạng thái ổn định sau khi hành động đã xong” để giảm sai lệch liên tục giữa các lần tạo.

### A7.5 Bảng định tuyến phong cách

| Phong cách | Chuyển động camera | Diễn xuất | Ánh sáng | Âm thanh |
|---|---|---|---|---|
| **Tiết chế** | Chủ yếu máy cố định / có thể đứng yên cả ở đỉnh cảm xúc | Cảm xúc lộ ra qua sai lệch nhỏ của hành động | Ánh sáng tự nhiên / độ tương phản thấp | Âm thanh môi trường chủ đạo |
| **Bí ẩn, hồi hộp** | Chủ yếu góc máy ổn định / bất ngờ đổi góc ngược khi cần | Trọng tâm là chênh lệch thông tin / phản ứng có thể chậm nửa nhịp | Bóng đổ rõ / ánh sáng ngược bên | Im lặng đôi khi hiệu quả hơn nhạc |
| **Hài hước** | Máy cố định / dừng khung hình toàn cảnh thường hiệu quả | Nhân vật diễn nghiêm túc, sự tương phản tạo tiếng cười | Ánh sáng thường, đồng đều | Âm thanh môi trường chủ đạo |

Nếu người dùng đã chỉ định rõ phong cách, phong cách của họ có ưu tiên cao nhất.

---

## A8. Kiểm tra tính liên tục giữa các đoạn (xác định liên hệ trước rồi mới kiểm tra)

A7.3 là **nguồn quy tắc duy nhất cho việc chuyển loại góc máy giữa các đoạn**; A8 chỉ phụ trách tính liên tục của nhân vật, đạo cụ, môi trường và các trạng thái kéo dài. **Không ép mọi đoạn tạo nằm cạnh nhau thành cùng một không gian liên tục. Trước tiên xác định hai đoạn có liên hệ liên tục thực sự hay không, rồi mới quyết định phải kế thừa gì.**

### A8.1 Xác định quan hệ liên tục giữa hai đoạn liền kề trước

Với mỗi cặp `Trạng thái cuối đoạn N → Trạng thái đầu đoạn N+1`, chỉ đánh dấu nội bộ một trong ba loại:

1. **Liên hệ liên tục:** cùng địa điểm, cùng thời gian liên tục, hoặc nguyên tác nêu rõ “tiếp tục / ngay sau đó / nối tiếp / cùng lượt đối thoại / cùng chuỗi hành động”; trạng thái đầu đoạn sau phụ thuộc trạng thái cuối đoạn trước.
2. **Liên hệ trạng thái cục bộ:** bối cảnh hoặc thời gian đã thay đổi nhưng nguyên tác yêu cầu rõ một số trạng thái kéo dài vẫn tồn tại, ví dụ cùng món đạo cụ mang theo, quần áo rách, thương tích, độ ẩm, vết bẩn, lượng sản phẩm còn lại. Khi đó chỉ kế thừa những trạng thái kéo dài này, **không ép kế thừa vị trí nhân vật, vị trí camera hay trái/phải trong khung hình của cảnh trước**.
3. **Không liên hệ liên tục / xác lập mốc mới:** bối cảnh, thời gian hoặc đơn vị tự sự đã chuyển và đoạn sau không phụ thuộc vị trí nhân vật hay trạng thái đạo cụ cuối đoạn trước. Khi đó chỉ kiểm tra trạng thái đầu, hành động và trạng thái cuối của chính đoạn này có hợp lý không; dựng lại vị trí nhân vật, camera và ánh sáng theo đoạn hiện tại.

Chỉ được căn cứ vào chỉ thị rõ ràng gần nhất của người dùng, kịch bản nguồn và trạng thái đã xác nhận. **Không tự tạo quan hệ chỉ để “làm cho chúng nối được với nhau”.** Nếu nguyên tác trực tiếp đưa ra trạng thái mới đã xác định ở đoạn sau mà không mô tả quá trình chuyển tiếp, theo A0.1.4 coi đó là trạng thái đầu mới; có thể vào bằng HARD CUT/khối thời gian mới, không tự thêm lịch sử di chuyển hoặc bàn giao.

### A8.2 Kiểm tra quan hệ vị trí nhân vật (bắt buộc với các đoạn liên tục)

Với mỗi nhân vật thực sự có liên hệ liên tục, duy trì nội bộ một chuỗi trạng thái ngắn gọn:

`Vị trí/tư thế tuyệt đối đầu đoạn → Hành động nguyên tác → Vị trí/tư thế tuyệt đối cuối đoạn → Vị trí/tư thế tuyệt đối đầu đoạn sau`

Ít nhất phải đối chiếu:
1. **Vị trí thế giới:** vị trí so với cửa, bàn, cửa sổ, hành lang, phương tiện, đồ nội thất cố định, v.v. có nhất quán không;
2. **Quan hệ tương đối giữa nhân vật:** ai đứng bên nào của ai, khoảng cách trước/sau, có ngăn cách bởi bàn/cửa/quầy, v.v. có tự thay đổi không;
3. **Trạng thái cơ thể:** đứng / ngồi / ngồi xổm / nằm, hướng cơ thể và đối tượng hướng đến có liên tục không;
4. **Tay đang sử dụng:** nếu nhân vật đang cầm đạo cụ quan trọng, tay nào/hai tay còn đang bận với hành động đó không. Nếu nguyên tác chưa khóa trái/phải và góc máy không cần, không được ép chỉ định; nhưng một khi đã xác định để thực hiện, không được tự đổi tay trong các góc máy liên quan mà thiếu quá trình;
5. **Trong/ngoài khung:** cắt khuôn hình hoặc đổi camera có thể khiến nhân vật từ trong hình thành ngoài hình, nhưng không có nghĩa nhân vật biến mất hoặc đổi vị trí trong không gian thế giới;
6. **Căn cứ di chuyển:** khi vị trí thay đổi phải ánh xạ được với sự kiện di chuyển/đứng dậy/ngồi xuống/quay người đã có trong `E##` nguồn, hoặc trạng thái đầu mới được nguyên tác cung cấp trực tiếp. Không có căn cứ thì không được dùng cắt góc máy để nhân vật dịch chuyển tức thời.

**Trái/phải trong khung hình có thể đổi do thay camera hợp lệ, nhưng vị trí thế giới không được thay đổi vì thế.** Khi quay góc ngược, kiểm tra tọa độ thế giới trước rồi mới tính lại tọa độ khung hình; không lén di chuyển nhân vật để họ “luôn ở bên trái/phải hình”.

### A8.3 Kiểm tra chuỗi trạng thái đạo cụ (bắt buộc trong đoạn và giữa các đoạn liên tục)

Với đạo cụ quan trọng, sản phẩm và đồ vật nhỏ tham gia hành động, duy trì nội bộ:

`Người giữ / Tay sử dụng (nếu đã xác định) / Vị trí tuyệt đối / Nhìn thấy hay bị che / Số lượng / Trạng thái mở-đóng / Nội dung hoặc mức chất lỏng / Vết bẩn, độ ẩm, hao mòn / Hành động của đoạn / Trạng thái cuối đoạn`

Quy tắc cứng:
- Nếu một người đang cầm bút trong các góc máy liên tục và nguyên tác không có sự kiện “đặt xuống / đưa đi / cất / đánh rơi / rời khung hình”, cây bút **không được tự biến mất** ở thời điểm sau;
- Nếu góc máy sau cắt mất tay/đạo cụ hoặc bị cơ thể/đồ nội thất che, có thể “tạm thời không nhìn thấy” nhưng trạng thái thế giới vẫn phải giữ, **không được hiểu “không quay thấy” là “đạo cụ biến mất”**;
- Nếu bàn tay đang cầm đạo cụ vẫn nhìn thấy rõ ở góc máy sau mà không có sự kiện đổi trạng thái, đạo cụ phải tiếp tục nằm trong tay đó;
- Đạo cụ đã đặt xuống không tự quay lại tay khi không có quá trình, đạo cụ đã đưa cho B không được đồng thời xuất hiện trong tay A ở góc máy sau;
- Số lượng, kích thước, hình dáng, màu sắc, cách đóng/mở, mức chất lỏng, hao mòn và vết bẩn không được tự sao chép, phục hồi hoặc thay đổi vô cớ;
- Đạo cụ đi vào/ra mép khung hình không có nghĩa trạng thái đạo cụ thay đổi, trừ khi nguyên tác thực sự có di chuyển.

### A8.4 Tính liên tục của bối cảnh và môi trường vật lý

Chỉ kiểm tra khi có “liên hệ liên tục” hoặc “liên hệ trạng thái cục bộ”:
- Trạng thái mở/đóng cửa, cửa sổ và những thay đổi vị trí đã xảy ra của ghế/bát đĩa/đồ nội thất;
- Các trạng thái kéo dài như vệt nước trên sàn, vết bẩn, hư hỏng, khói, lượng thức ăn còn lại;
- Hướng ánh sáng chính, thời gian, thời tiết và trạng thái bật/tắt nguồn sáng thực;
- Không được có bản sao phản chiếu bổ sung trong gương, kính hoặc mặt phản xạ mâu thuẫn với trạng thái hiện tại của nhân vật/đạo cụ;
- Nhân vật và môi trường cố định không được xuyên vật thể, xuyên tường hoặc vượt qua chướng ngại đóng kín khi thiếu căn cứ.

### A8.5 Ranh giới sửa lỗi giữa các đoạn

Khi phát hiện lỗi liên tục, chỉ được:
- Sửa mâu thuẫn bằng chữ giữa tọa độ thế giới và khung hình;
- Sửa mô tả trong/ngoài khung và che khuất;
- Sửa việc cầm giữ, khả năng nhìn thấy và khóa trạng thái của đạo cụ quan trọng;
- Điều chỉnh góc máy chứa hành động, cỡ cảnh hoặc điểm cắt để thể hiện trọn vẹn hành động đã có;
- Nếu cần, chia lại góc máy/đoạn tại **ranh giới `E##` đã có**.

**Cấm thêm hành động nối “đặt bút xuống / nhặt bút lên lại / đi sang bên kia / lấy thêm một món mới”, v.v. mà người dùng chưa viết chỉ để sửa tính liên tục.** Nếu mâu thuẫn vốn có trong nguyên tác, ghi “Mâu thuẫn văn bản nguồn” theo A0.1.6, không tự sửa thành câu chuyện khác.

**Không viết “như trên”, “tiếp tục vị trí của đoạn trước”.** Đoạn sau cần kế thừa phải ghi lại kết quả kế thừa thành trạng thái đầu tuyệt đối; nếu các đoạn không có quan hệ liên tục thì chỉ kiểm tra chính đoạn đó.

---

## A9. Mẫu prompt từng đoạn (theo mô hình)

A9 chỉ quy định **khung định dạng bàn giao cuối**, không thay đổi bất kỳ logic thực thi nào của A2–A8.

- Seedance 2.0 → dùng A9.1;
- Seedance 2.5 → dùng A9.2.

Nếu cách thể hiện của A9 mâu thuẫn với quy tắc thực thi A2–A8 hoặc A11–A12, ưu tiên quy tắc thực thi.

### A9.1 Mẫu prompt từng đoạn Seedance 2.0 (nhận diện tài nguyên + prompt chính thức)

```text
═══════════════════════════════════════════
G0N｜Batch X / Đoạn N ｜Mô hình mục tiêu: Seedance 2.0 ｜Thời lượng đoạn: Xs ｜Thời gian toàn phim: MM:SS–MM:SS
═══════════════════════════════════════════

## Nhận diện tài nguyên

### Nhân vật liên quan
Tên nhân vật｜Tổng quan trạng thái xuất hiện
- Góc máy N-1｜00:00–00:XX｜Chỉ thấy tay / Xuất hiện trong hình / Hoàn toàn ngoài khung…｜Có thoại / Không thoại
- Góc máy N-2｜00:XX–00:XX｜…
(Danh tính + đặc điểm ngoại hình + tọa độ thế giới + tọa độ khung hình + trạng thái đặc biệt + diễn xuất trọng tâm đoạn + yêu cầu diễn xuất + lời thoại đồng bộ nguyên văn)

### Bối cảnh liên quan
Tên bối cảnh｜Thời gian
(Đặc điểm cố định của bối cảnh + vị trí/hướng/độ cao camera + tiền/trung/hậu cảnh + quan hệ không gian)

### Đạo cụ quan trọng
Tên đạo cụ
(Vị trí tuyệt đối đầu đoạn + hành động timeline + trạng thái cuối đoạn + điều cấm; chữ bao bì theo A1.3)

─────────────────────────────────────────
【Prompt chính thức】

Tạo một đoạn phim người thật có tổng thời lượng chính xác Xs.
(Phong cách hình ảnh / mô tả tổng quát camera / mô tả tổng quát nguồn sáng)

## Quan hệ không gian giữa các nhân vật
(Tọa độ thế giới + tọa độ khung hình · hai lớp; cấm chỉ viết “tiếp nối đoạn trước”)

## Góc máy N-1｜00:00–00:XX｜XXs｜Chủ thể + cỡ cảnh + góc nhìn
Camera và bố cục: …
Khóa khung hình đầu: …
Timeline hành động: …
Diễn xuất: …
Vật lý: …

## 00:XX｜HARD CUT

## Góc máy N-2｜00:XX–00:XX｜XXs｜Chủ thể + cỡ cảnh + góc nhìn
……

## Ánh sáng
(Hướng nguồn sáng chính trong thế giới + hướng trong khung hình + logic phơi sáng + tính liên tục so với đoạn/góc máy trước)

## Âm thanh
(Âm thanh môi trường thực + lời thoại đồng bộ nguyên văn; có BGM hay không theo yêu cầu người dùng)

## Khóa điều kiện bắt buộc
(Vị trí tuyệt đối nhân vật / đạo cụ đang cầm / hướng nhìn / trạng thái liên tục / nhân vật không được xuất hiện trong góc máy này)

## Khóa chữ
Không phụ đề, không chữ màn hình bổ sung, không lớp chữ hậu kỳ; chỉ giữ nguyên chữ thật trên bao bì/biển hiệu từ tài nguyên tham chiếu, không thêm, sửa hoặc vẽ lại.
```

### A9.2 Mẫu prompt từng đoạn Seedance 2.5 (cấu trúc Objective)

Đầu ra cuối cho Seedance 2.5 sử dụng cấu trúc gọn hơn, có thể đưa trực tiếp vào mô hình. **Không lặp lại toàn bộ mục nhận diện tài nguyên A4 trước mỗi đoạn.** Thông tin A4 phải được đưa vào `Reference binding`, `Immutable locks`, `Timeline` và `Preserve`.

#### A9.2.0 Điều kiện cứng về định dạng cuối (bắt buộc)

Khi mô hình đích là **Seedance 2.5**, đầu ra cuối chỉ được dùng cấu trúc trường A9.2 trong mục này. Ngoài thông tin đầu đoạn, chỉ các trường cấp cao nhất sau được phép:
- `Objective`
- `Reference binding` (chỉ xuất hiện khi có tài nguyên tham chiếu thật; nếu không có thì bỏ cả mục)
- `Immutable locks`
- `Target duration`
- `Timeline`
- `Visual direction`
- `Audio direction`
- `Preserve`
- `Avoid`

**Cấm lấy bản kế hoạch trung gian, mẫu của mô hình khác hoặc khung ngoài A9.2 làm bản bàn giao cuối cho 2.5.** Ngoài phần đầu đoạn và các trường trong danh sách cho phép ở trên, nội dung cuối 2.5 không được có trường cấp cao nhất khác, chương storyboard đánh số hoặc khối phân tích bổ sung.

`Timeline` cuối của 2.5 bắt buộc dùng khối thời gian `【0:00-0:XX】` + văn xuôi tự nhiên liên tục theo A9.2.1. Nếu thật sự cần đổi góc máy, chỉ lồng thay đổi đó vào câu văn của khối thời gian tương ứng, không lập hệ thống góc máy đánh số riêng làm cấu trúc chính.

Nếu bản nháp nội bộ hoặc đầu vào từ bước trước dùng cấu trúc khác, chỉ coi nó là **tư liệu nguồn**, không phải mẫu cuối. Phải phân tích theo A0–A8/A11 trước, rồi chuyển thành các trường A9.2 được phép trước khi bàn giao. Chỉ cần nội dung cuối có cấu trúc cấp cao nhất nằm ngoài danh sách cho phép thì coi là lỗi định dạng, **không được bàn giao và phải sửa trực tiếp thành A9.2 trong cùng lượt**.

```text
═══════════════════════════════════════════
G0N｜Batch X / Đoạn N ｜Mô hình mục tiêu: Seedance 2.5 ｜Thời lượng đoạn: Xs ｜Thời gian toàn phim: MM:SS–MM:SS
═══════════════════════════════════════════

Objective:
Dùng 1–2 câu nêu vị trí của đoạn trong toàn tập, thời lượng/tỷ lệ khung hình/chất lượng hình ảnh tổng thể và mục tiêu kịch tính chính cần đạt. Không kể lại toàn bộ Timeline.

Reference binding:
- Tự động đọc và phân tích tình tiết, góc máy, hành động và nội dung hình ảnh của đoạn, rồi trích xuất những tài nguyên tham chiếu thực sự liên quan và cần gọi trong đoạn, gồm ảnh nhân vật, bối cảnh, sản phẩm, đạo cụ, sơ đồ vị trí, v.v.
- Gắn nhãn ngắn gọn cho từng tài nguyên được trích, chỉ cần nói nó tương ứng với ai, vật gì hoặc công dụng nào, ví dụ: “Tham chiếu nhân vật nam chính”, “Tham chiếu bối cảnh quán trọ”, “Tham chiếu bao bì sản phẩm”, “Tham chiếu đạo cụ dây đỏ”.
- Phải liệt kê riêng từng ảnh tham chiếu thực/mã tài nguyên người dùng đã cung cấp và đoạn này thật sự cần; giữ nguyên ID node, mã tài nguyên hoặc nhãn tham chiếu, không sửa, viết tắt hoặc đánh số lại.
- Nếu cùng tài nguyên tham chiếu đã dùng ở đoạn trước mà đoạn này vẫn cần, bắt buộc trích lại và liệt kê trong đoạn này; cấm viết tắt kiểu “như trên”, “dùng tham chiếu đoạn trước”.
- Chỉ trích tài nguyên thực sự liên quan đoạn này; không máy móc thêm tài nguyên không xuất hiện trong tình tiết hoặc khung hình của đoạn.
- Không cần giải thích dài về từng ảnh “kiểm soát gì/không kiểm soát gì”, chỉ cần nhãn danh tính ngắn gọn, rõ ràng.
- Nếu đoạn không có ảnh tham chiếu, ID node hoặc mã tài nguyên thực, có thể bỏ toàn bộ mục này.
- Nghiêm cấm tự bịa {{node/image-...}}, mã tài nguyên, nhãn tham chiếu hoặc tư liệu không tồn tại dựa trên tình tiết.

Immutable locks:
- Chỉ ghi những điều kiện bất biến ảnh hưởng trực tiếp đến ổn định khi tạo: danh tính/trang phục nhân vật, vị trí thế giới quan trọng và quan hệ trái/phải, logic ánh sáng của các cảnh liên tục, trạng thái đạo cụ quan trọng, cấu trúc sản phẩm, lời thoại gốc và khẩu hình, khóa nhân vật ngoài khung khi cần, v.v.
- Không chép lại toàn bộ tình tiết của đoạn.
- Khi cảnh liên tục qua các đoạn, viết lại trạng thái cuối đoạn trước thành trạng thái đầu tuyệt đối của đoạn này; không viết “tiếp nối đoạn trước”.

Target duration: X seconds

Timeline:
【0:00-0:XX】Dùng một đoạn văn tiếng Việt tự nhiên, liên tục mô tả những gì thực sự nhìn thấy trong khối thời gian: bối cảnh/vị trí cần thiết, trạng thái xuất hiện hiện tại, cỡ cảnh hoặc điểm cắt, thứ tự hành động, phản ứng diễn xuất quan trọng, lời thoại đồng bộ, thay đổi đạo cụ quan trọng và chi tiết vật lý cần thiết. Viết như mô tả phim thành phẩm, không chia thành các đề mục “Camera / Hành động / Diễn xuất / Lời thoại / Vật lý”.

【0:XX-0:XX】Tiếp tục mô tả hình ảnh kế tiếp bằng một đoạn văn tự nhiên liên tục.

【0:XX-0:XX】Tiếp tục theo nhu cầu tình tiết; số khối thời gian không cố định.

Visual direction:
Dùng một đoạn văn gọn để tóm tắt chất lượng hình ảnh quay phim, ánh sáng, nhiệt độ màu, độ sâu trường ảnh, quan hệ hình ảnh giữa nhân vật/sản phẩm và cảm giác vật lý cần thiết. Chỉ ghi những yêu cầu hình ảnh thực sự ảnh hưởng đoạn này.

Audio direction:
- Tiếng động vật lý / âm thanh môi trường: …
- Giọng nói trong lời thoại: …
- Chỉ thêm nhạc khi người dùng yêu cầu rõ; nếu không, mặc định “Không nhạc nền, chỉ giữ âm thanh thu đồng bộ thực tế và tiếng môi trường”.

Preserve:
Dùng một dòng hoặc đoạn văn ngắn liệt kê kiểu dáng nhân vật, đặc điểm cố định bối cảnh, cấu trúc sản phẩm, trạng thái đạo cụ quan trọng, quan hệ không gian hoặc logic hành động bắt buộc giữ.

Avoid:
Dùng một dòng hoặc đoạn văn ngắn nêu những lỗi dễ gặp nhất và liên quan trực tiếp đến đoạn hiện tại; không chất một danh sách dài các từ phủ định chung chung.
```

#### A9.2.1 Cách viết Timeline (bắt buộc)

`Timeline` bắt buộc theo phong cách prompt thành phẩm Seedance 2.5 mà người dùng thường dùng: **khối thời gian + mô tả hình ảnh bằng văn xuôi tự nhiên liên tục**.

Ví dụ đúng:

```text
Timeline:

【0:00-0:06】
Trong bối cảnh đã được xác định rõ ở nguyên tác, nhân vật A thực hiện hành động gốc E01. Camera có thể chuyển từ góc toàn thiết lập sang trung cảnh nhân vật A nếu cần. Nếu theo nguyên tác nhân vật B vẫn ngoài khung ở nhịp này, ghi rõ “Nhân vật B vẫn ngoài khung”. Chỉ bổ sung tư thế, sự tiếp xúc và phản hồi vật lý nhìn thấy trực tiếp; không thêm sự kiện cầm lấy, mở nắp, di chuyển vị trí, v.v. mà nguyên tác không có.

【0:06-0:12】
Tiếp nối E02–E03. Nhân vật A nói nguyên văn lời thoại, nhân vật B phản ứng đúng như nguyên tác. Có thể diễn đạt phản ứng đã có thành hành động cụ thể nhìn thấy được, nhưng không được mở rộng “phản ứng” thành hành vi tình tiết mới. Có thể chuyển sang cận cảnh hoặc đặc tả một bộ phận khi cần, giữ nguyên thứ tự sự kiện.

【0:12-0:18】
Tiếp nối E04. Nếu nguyên tác quy định đạo cụ đã nằm trong tay nhân vật ở khung đầu của khối thời gian này, hãy bắt đầu trực tiếp từ trạng thái đó; không truy ngược hoặc bổ sung quá trình đạo cụ được lấy vào tay. Góc máy chỉ có nhiệm vụ thể hiện, không bổ sung lịch sử.
```

**Yêu cầu thực thi:**
- Mỗi khối thời gian thường dùng một đoạn văn tự nhiên, vừa đủ thông tin.
- Số khối thời gian tùy tình tiết, không cố định ba hay bốn khối.
- Có thể viết trực tiếp “chuyển cận cảnh nam chính / chuyển đặc tả tay / trở về trung cảnh hai người”, không cần đánh số góc máy riêng.
- Chỉ ghi vị trí, trái/phải, trạng thái ngoài khung và tính liên tục thực sự ảnh hưởng đến khối hiện tại, không máy móc lặp lại `Immutable locks`.
- Khi nhân vật không được xuất hiện, chỉ cần viết ngắn “Nữ chính vẫn ngoài khung, không tự thêm vào hình”.
- Lời thoại được chèn trực tiếp tại nơi hành động tương ứng diễn ra, không lặp lại sau Timeline.
- Chỉ ghi chi tiết vật lý liên quan trực tiếp đến hành động hiện tại, ví dụ chất lỏng sóng sánh, vải chạm nhau, bề mặt đạo cụ ẩm ướt, trọng lượng vật thể, phản hồi va chạm.
- Ưu tiên chuỗi hành động rõ ràng trong mỗi khối, không nhồi thông tin vào từng giây chỉ để đủ mọi chi tiết.
- **Trọng tâm mô tả là “thành phẩm thực sự cho thấy gì vào thời điểm này”, không phải giải thích lại quy tắc.**
- Mọi hành động trong Timeline làm thay đổi nhân vật/đạo cụ/vị trí/số lượng/quan hệ/thông tin đều phải xuất phát từ nhịp nguồn `E##` ở A2.
- Không thêm hành vi cầm lấy, đóng mở, rút ra, trao cho, đứng dậy, di chuyển, quay đầu, số lần sử dụng hoặc hao hụt đạo cụ không có trong nguyên tác chỉ vì muốn “mượt hơn”, “đầy đủ hơn” hoặc “có nhân quả hơn”.
- Nếu nguyên tác bắt đầu trực tiếp ở một trạng thái đã xác định, ghi trạng thái đó ngay; không tự hỏi hoặc dựng thêm diễn biến trước đó.
- Nếu nguyên tác dùng các cách gọi chung như “cha mẹ / phụ huynh / người lớn / ai đó”, Timeline phải giữ cùng mức khái quát, trừ khi chỉ thị rõ ràng gần nhất của người dùng đã chỉ định người cụ thể.

#### A9.2.2 Reference binding (quy tắc cứng về tài nguyên tham chiếu thật cho 2.5)

- Tự động đọc tình tiết, góc máy, hành động và nội dung hình của đoạn; chỉ trích các tài nguyên tham chiếu thật **thực sự liên quan và cần dùng trong đoạn này** như ảnh nhân vật, bối cảnh, sản phẩm, đạo cụ, vị trí, hành động, v.v.
- Chỉ dùng node tham chiếu, nhãn ảnh hoặc mã tài nguyên người dùng thực sự cung cấp, **giữ nguyên đầy đủ node/mã đó**; không đổi tên, viết tắt, đánh số lại hoặc bịa tham chiếu không tồn tại dựa trên tình tiết.
- Liệt kê mỗi tham chiếu thực trên một dòng theo dạng **“Node thực / mã tài nguyên: nhãn nhận diện ngắn”**; nhãn chỉ nêu đối tượng hoặc công dụng, ví dụ “Tham chiếu nam chính”, “Tham chiếu bối cảnh quán trọ”, “Tham chiếu bao bì sản phẩm”, “Tham chiếu đạo cụ dây đỏ”.
- Không cần giải thích dài cho từng ảnh “kiểm soát gì/không kiểm soát gì”, nhưng nội bộ phải tuân theo mục đích người dùng đã nêu; ảnh nhân vật không được tự thay đổi vị trí, ảnh vị trí không được ghi đè danh tính, ảnh bối cảnh không được kéo thêm nhân vật hoặc đạo cụ vào.
- Nếu người dùng nói rõ “chỉ tham chiếu vị trí / chỉ trang phục / chỉ sản phẩm”, phải giữ giới hạn mục đích trong nhãn ngắn, ví dụ “Chỉ tham chiếu vị trí đứng”, “Chỉ tham chiếu trang phục”.
- **Mỗi đoạn tự chứa đầy đủ:** nếu đoạn trước đã dùng tham chiếu nhưng đoạn này vẫn cần thì phải liệt kê lại; cấm viết “như trên”, “dùng tham chiếu đoạn trước”.
- Chỉ liệt kê tài nguyên thực sự cần trong đoạn, không đưa cả thư viện tham chiếu của tập vào mọi đoạn.
- Khi không có tham chiếu thực, bỏ toàn bộ `Reference binding`; cấm giả mạo `{{Ref}}`, `{{node/image-...}}`, số tài nguyên hoặc tên tài nguyên không tồn tại.

#### A9.2.3 Immutable locks

Chỉ giữ những thông tin **không được trôi lệch**, ví dụ:
- Nam chính mặc trắng, nữ chính mặc đỏ;
- Nữ chính ở phía nam bàn/bên trái hình, nam chính ở phía bắc bàn/bên phải hình;
- Sản phẩm có cấu trúc nắp bật màu xanh dương;
- Một nhân vật ở ngoài khung trong một khối thời gian cụ thể;
- Lời thoại nguyên văn không đổi từ hoặc nuốt chữ;
- Hướng sáng và trạng thái đạo cụ của cảnh liên tục không đặt lại từ đầu.

Không biến mọi hành động thành điều kiện khóa; những hành động thay đổi theo thời gian phải được giữ trong Timeline.

#### A9.2.4 Audio direction

- Nếu người dùng yêu cầu rõ BGM/nhạc nền → viết theo yêu cầu.
- Nếu không yêu cầu → mặc định không BGM, không âm thanh nhấn cảm xúc; chỉ giữ tiếng môi trường thật, tiếng động vật lý và lời thoại đồng bộ.
- Không coi nhạc nền là hành vi mặc định của 2.5 chỉ vì ví dụ nào đó từng có nhạc.

#### A9.2.5 Preserve / Avoid

`Preserve` và `Avoid` phải phục vụ thực thi đoạn hiện tại:
- `Preserve` ghi hình dáng, không gian, sản phẩm, đạo cụ và logic hành động thực sự không được trôi lệch;
- `Avoid` ghi lỗi tạo dễ xảy ra nhất ở đoạn hiện tại;
- Cả hai đều ngắn gọn, không ghi hàng chục nhãn chung chung.

---

## A10. Cấu trúc đầu ra của toàn phim

Với câu chuyện dài, phải phân biệt kế hoạch toàn phim và đợt bàn giao hiện tại. Tổng quan toàn phim dùng tiếng Việt; nội dung từng đoạn tạo theo A9.1 hoặc A9.2 của mô hình mục tiêu.

```text
═══════════════════════════════════════════
Tổng quan toàn phim
═══════════════════════════════════════════
· Mô hình mục tiêu: Seedance 2.X
· Tổng thời lượng mong muốn: (bắt buộc / tham khảo / chưa chỉ định)
· Giới hạn mỗi đoạn: 15s / 30s
· Số đoạn tối thiểu lý thuyết: ⌈tổng thời lượng / giới hạn đoạn⌉ (chỉ là giới hạn dưới)
· Số đoạn thực tế: X đoạn (dựa trên mật độ nội dung)
· Danh sách đoạn: G01 … GXX (thời lượng + khoảng thời gian toàn phim + nhịp chính)
· Chia đợt: Batch 1 = G01–G0X; Batch 2 = …
· Đợt bàn giao hiện tại: Batch X
· Đoạn của đợt tiếp theo: GXX–GXX (nếu không có, ghi “Không”)
· Danh sách tài nguyên toàn phim
· Danh sách ảnh tham chiếu (chỉ 2.5 và có ảnh thật): ghi nguyên nhãn node ảnh/tài nguyên và công dụng; chỉ phục vụ kế hoạch toàn phim, không thay Reference binding của từng đoạn
· Bảng thay đổi bối cảnh và thời gian
· Trục không gian của từng bối cảnh liên tục
· Diễn tiến cảm xúc theo thời gian gốc
· Nhãn nhịp truyện quan trọng
· Phong cách
· Nhịp chuyển động camera
· Xung đột giới hạn thời lượng (nếu không có, ghi “Không”)
· Bảo toàn truyện gốc: yêu cầu “Đạt”; nếu bản gốc có chỗ thiếu hoặc mâu thuẫn, chỉ đánh dấu vấn đề, không tự bổ sung cốt truyện

─────────────────────────────────────────
Nếu mô hình mục tiêu là Seedance 2.0:
[G01] Dùng A9.1 “Định danh tài nguyên + prompt chính thức”
[G02] Dùng A9.1
……

Nếu mô hình mục tiêu là Seedance 2.5:
[G01] Dùng trực tiếp cấu trúc Objective theo A9.2, không lặp cả khối định danh tài nguyên
[G02] Dùng A9.2
……
─────────────────────────────────────────
```

**Quy tắc cho tập dài:** ngay cả khi lượt hiện tại chỉ bàn giao Batch 1, vẫn phải lên kế hoạch các đoạn toàn cục tiếp theo và vị trí lô hiện tại trong toàn phim trước, tránh việc chia đoạn lại ở mỗi lô khiến logic trước/sau bị trôi lệch.

**Quy tắc ngắn gọn của 2.5:** tổng quan toàn phim giải thích “vì sao chia như vậy”; prompt từng đoạn giải thích “đoạn này cụ thể được tạo thế nào”. Không nhồi lặp lại nội dung tổng quan vào từng `Objective` hoặc `Timeline` của 2.5.

---

## A11. Kiểm tra cấu trúc (giai đoạn sửa cấu trúc duy nhất trước A12)

A11 phụ trách các vấn đề cấu trúc như “có tạo được không, tình tiết có bị ép méo không”; A12 chỉ trau chuốt câu chữ và cách thể hiện.

### A11.1 Danh sách kiểm tra
- [ ] Đã lập sổ cái các nhịp nguồn `E01 / E02 / E03...` và dùng chỉ thị rõ gần nhất / câu chuyện gốc của người dùng làm nguồn sự thật?
- [ ] Mọi sự kiện thay đổi trạng thái cốt truyện trong Timeline cuối đều ánh xạ được với một `E##` và không có hành động mới vô căn cứ?
- [ ] Không tự thêm, xóa, thay thế, đổi người thực hiện/đối tượng hoặc đảo thứ tự bất kỳ sự kiện nào của người dùng?
- [ ] Không tự cụ thể hóa nhân vật mơ hồ như “cha mẹ / phụ huynh / người lớn” thành bố/mẹ/người thứ hai?
- [ ] Không truy ngược nguồn gốc đạo cụ hoặc thêm quá trình mở nắp/rút/lấy/di chuyển chỉ để nối mạch liên tục?
- [ ] Đã ghi đủ nhịp nguyên tử theo thứ tự nguyên tác, không chỉ giữ năm loại nhịp quan trọng?
- [ ] Không dùng đường cong cảm xúc để sắp lại tình tiết?
- [ ] Chỉ coi số đoạn tối thiểu lý thuyết là giới hạn dưới, không buộc số đoạn thực tế phải bằng nó?
- [ ] Thời lượng mỗi đoạn ≤ giới hạn cứng của mô hình?
- [ ] Tổng thời lượng các đoạn đáp ứng tổng thời lượng nghiêm ngặt của người dùng; nếu không thể đáp ứng đồng thời, đã đánh dấu rõ xung đột?
- [ ] Mọi câu thoại đều có thể nói hết bằng tốc độ tự nhiên trong khoảng thời gian của nó?
- [ ] Hành động tuần tự, phản ứng và khoảng dừng cần thiết đều có thời gian thực tế, không dựa vào dịch chuyển tức thời hoặc tốc độ nói nhanh bất thường?
- [ ] Với câu chuyện dài, đã lập bảng đoạn đầy đủ cho toàn phim trước rồi mới chia lô theo dung lượng Batch?
- [ ] Trạng thái xuất hiện của nhân vật A4 đã được lên kế hoạch theo timeline và nhất quán với nội dung cuối?
- [ ] Đã xác định “liên hệ liên tục / liên hệ trạng thái cục bộ / không liên hệ liên tục” cho mỗi cặp đoạn tạo liền kề, không ép kế thừa giữa các đoạn không liên quan?
- [ ] Trong các đoạn liên tục, vị trí thế giới, quan hệ tương đối, tư thế, hướng cơ thể và tay đang sử dụng của nhân vật có thể chuyển từ trạng thái cuối đoạn trước đến đầu đoạn sau mà không mâu thuẫn?
- [ ] Đã kiểm tra chuỗi “người giữ / vị trí / số lượng / trạng thái / khả năng nhìn thấy” của mọi đạo cụ quan trọng; không có việc biến mất, sao chép, đổi tay, phục hồi hoặc dịch chuyển tức thời vô căn cứ?
- [ ] Trạng thái cửa, cửa sổ, đồ nội thất, vết bẩn, mực chất lỏng, hư hỏng, thời tiết và nguồn sáng đã thay đổi trong cảnh có được kế thừa hợp lý ở các đoạn liên quan?
- [ ] Đã kiểm tra trước độ ổn định khi tạo để tránh nhồi tương tác cơ thể/tay/đạo cụ rủi ro cao, camera phức tạp, che khuất và tham chiếu mâu thuẫn vào cùng góc máy?
- [ ] Nếu mô hình đích là 2.0, đã dùng A9.1 “Nhận diện tài nguyên + prompt chính thức”?
- [ ] Nếu mô hình đích là 2.5, đã dùng cấu trúc `Objective / Reference binding / Immutable locks / Target duration / Timeline / Visual direction / Audio direction / Preserve / Avoid` của A9.2?
- [ ] Nếu mô hình đích là 2.5, nội dung cuối đã qua điều kiện cứng A9.2.0: ngoài đầu đoạn và các trường được phép của A9.2, không có cấu trúc cấp cao nhất hoặc khối phân tích thêm nào?
- [ ] Nếu mô hình đích là 2.5, `Timeline` chỉ dùng các khối thời gian + văn xuôi tự nhiên liên tục, không lập hệ thống góc máy đánh số khác làm cấu trúc chính?
- [ ] Nếu người dùng cung cấp ảnh tham chiếu, từng đoạn liên quan của 2.5 đã liệt kê nguyên dạng node ảnh/mã tài nguyên thực cần dùng trong `Reference binding` của chính đoạn đó?
- [ ] `Reference binding` chỉ chứa tài nguyên tham chiếu thực cần dùng trong đoạn, theo dạng “node thực / mã tài nguyên + nhãn ngắn”; đã giữ giới hạn mục đích như “chỉ vị trí / chỉ trang phục / chỉ sản phẩm” của người dùng?
- [ ] Không dùng “như trên / dùng ảnh tham chiếu đoạn trước” thay cho việc liên kết lại ở đoạn này?
- [ ] `Timeline` của 2.5 vẫn là “khối thời gian + văn xuôi tự nhiên liên tục”, không thoái thành một đống đề mục camera/hành động/diễn xuất?
- [ ] 2.5 không xuất lặp nguyên khối danh sách tài nguyên A4, mà đưa thông tin cần thiết vào các trường tương ứng?
- [ ] Mỗi đoạn đều tự chứa tọa độ thế giới + tọa độ khung hình, không ghi “như trên/tiếp nối đoạn trước”?
- [ ] Đã kế thừa đúng trạng thái của cảnh liên tục và xác lập lại mốc khi đổi cảnh?
- [ ] Cách nối đoạn đáp ứng A7.3?
- [ ] Dựng nối hành động được giữ trong cùng đoạn tạo khi có thể?
- [ ] Lời thoại được chép nguyên văn?
- [ ] Không giao phụ đề/chữ đè hậu kỳ cho mô hình tạo? Chữ trên tài nguyên thật được xử lý theo A1.3?
- [ ] Nếu chưa có thư viện tham chiếu nhưng có tạo ảnh tham chiếu, ảnh đó chỉ dùng cho Reference binding, ngoại hình được ghi là đề xuất thiết kế và không vượt quyền kiểm soát vị trí/ánh sáng/tình tiết? (Bổ sung trường hợp hai ở A1.2)

### A11.2 Cơ chế sửa có giới hạn (tránh lặp vô hạn)

Nếu kiểm tra lần đầu phát hiện vấn đề:
1. Tổng hợp tất cả mục không đạt trong một lần;
2. **Chỉ thực hiện một lượt sửa cấu trúc tập trung**; việc sửa chỉ được điều chỉnh ranh giới đoạn, cách các góc máy chứa nội dung, ngân sách thời gian, cách thể hiện bằng camera và thông tin khóa, **không được sửa nội dung sự kiện, người thực hiện, đối tượng, số lượng, thứ tự hoặc lời thoại của bất kỳ `E##` nào**;
3. Sau khi sửa, chỉ kiểm tra lại các mục bị ảnh hưởng và tính liên tục trực tiếp của chúng;
4. Sau đó thực hiện kiểm toán trung thành cốt truyện A11.3 và tiền kiểm ổn định khi tạo A11.4; chỉ khi tất cả đạt mới vào A12.

**Cấm quay đi quay lại đệ quy giữa A11 ↔ A12.**

Nếu sau một lượt sửa tập trung vẫn có xung đột cứng do “các yêu cầu của người dùng không thể đồng thời đáp ứng” (ví dụ bắt buộc đúng 30s nhưng đọc tự nhiên thoại gốc đã quá 30s), giữ nguyên nguyên tác và nêu rõ trong “Tổng quan toàn phim｜Xung đột giới hạn thời lượng”, không tính đi tính lại vô hạn.

### A11.3 Kiểm toán trung thành cốt truyện (bắt buộc trước A12)

Đối chiếu một chiều đúng một lần; không đưa sổ cái nội bộ cho người dùng:

1. Đọc sổ cái nhịp nguồn theo thứ tự `E01 → E02 → ...`;
2. Xác nhận mỗi `E##` đều xuất hiện trong một đoạn tạo của bản cuối, người thực hiện / đối tượng / lời thoại / thứ tự không thay đổi;
3. Quét ngược tất cả hành động làm thay đổi trạng thái thế giới trong Timeline cuối; nếu không tìm được `E##` nguồn, xóa hành động do AI tự thêm;
4. Quay phim, bố cục, cỡ cảnh, lấy nét, kết quả vật lý trực tiếp và tiếng động của hành động đã có có thể không cần `E##`, nhưng không được tạo sự thật cốt truyện mới;
5. Nếu xóa hành động do AI thêm khiến nảy sinh câu hỏi “trạng thái này từ đâu ra”, xử lý theo A0.1.4: coi trạng thái người dùng đã cung cấp trực tiếp là trạng thái đầu của nhịp đó, không thêm lịch sử;
6. Nếu văn bản nguồn tự có khoảng trống hoặc mâu thuẫn, giữ nguyên và đánh dấu trong tổng quan toàn phim, không tự viết nối.

**Mục tiêu kiểm toán không phải làm câu chuyện trôi chảy hơn, mà là bảo đảm prompt cuối và cốt truyện của người dùng vẫn là cùng một câu chuyện.**

### A11.4 Tiền kiểm độ ổn định khi tạo (giảm nguy cơ hình ảnh lỗi · bắt buộc)

Mục này chỉ giảm rủi ro tạo, **không được hứa mô hình chắc chắn không sinh hình lỗi**. Mục tiêu là giảm trước độ phức tạp prompt dễ gây biến dạng nhân vật, lỗi bàn tay, đạo cụ biến mất/nhân đôi, cấu trúc hình ảnh bị chảy méo và trôi danh tính. Không được xóa tình tiết hoặc sửa sự kiện vì lý do “ổn định”.

#### A11.4.1 Các yếu tố kích hoạt rủi ro cao

Khi bất kỳ góc máy nào có các tình huống dưới đây, đánh dấu rủi ro cao và chủ động giảm độ phức tạp:
- Có từ ba chủ thể trở lên đồng thời di chuyển mạnh, che khuất nhau hoặc tiếp xúc;
- Hai tay/nhiều người đồng thời thao tác đạo cụ nhỏ như trao tay, cài cúc, rót chất lỏng, lau, v.v. và còn đòi hỏi chuyển động camera phức tạp;
- Chuyển động cơ thể lớn như quay người nhanh, ngồi xổm rồi đứng lên, tiếp đất, mặc/cởi đồ, nhiều người đổi vị trí diễn ra đồng thời với chi tiết bàn tay ở cận cảnh;
- Bố cục có gương, kính, phản xạ mạnh, bình chứa trong suốt, nhiều bóng đổ, dễ làm nhân đôi nhân vật/chi/đạo cụ;
- Bao bì sản phẩm, chữ nhỏ, ngón tay, chất lỏng hoặc cấu trúc cơ khí vừa phải chính xác ở cự ly gần vừa di chuyển/xoay tốc độ cao;
- Một góc máy đồng thời yêu cầu độ sâu trường ảnh cực nông, che khuất mạnh, camera nhanh, tiếp xúc tinh vi và diễn xuất nhiều nhân vật;
- Đoạn có quá nhiều ảnh tham chiếu, trong đó các ảnh có thể mâu thuẫn về cùng nhân vật, trang phục, cấu trúc bối cảnh hoặc hình dáng sản phẩm;
- Bản thân prompt có yêu cầu loại trừ nhau, ví dụ “nhân vật cố định hoàn toàn” đồng thời “đổi vị trí nhanh”, hoặc “tay luôn nắm bút” đồng thời “cùng góc máy dùng tay trống thực hiện hành động khác”.

#### A11.4.2 Trình tự giảm rủi ro

Khi gặp rủi ro cao, xử lý theo thứ tự sau cho đến khi prompt không còn quá tải:
1. **Bỏ yêu cầu điều khiển không liên quan, không bỏ tình tiết.** Xóa thuật ngữ camera không ảnh hưởng góc máy này, từ phủ định chung chung, chi tiết vật liệu không liên quan và tham chiếu vô ích; chỉ giữ các điều kiện khóa thật sự cần.
2. **Đơn giản hóa camera trước.** Khi có tiếp xúc tinh tế giữa tay/đạo cụ, ưu tiên máy cố định hoặc một chuyển động êm duy nhất; không chồng cùng lúc đẩy/kéo, xoay quanh, lia nhanh và đổi nét mạnh.
3. **Làm cho tiếp xúc quan trọng nhìn thấy đầy đủ.** Với hành động bàn giao, cầm lấy, lau, đóng mở, chọn cỡ cảnh thấy rõ cả tay và đạo cụ liên quan; tránh để điểm tiếp xúc quan trọng nhất bị mép hình, cơ thể hoặc tiền cảnh che hoàn toàn.
4. **Giảm xung đột độ sâu trường ảnh.** Khi phải phân biệt rõ tay, đạo cụ và bề mặt tiếp xúc, không dùng độ sâu trường ảnh quá nông làm một trong các đối tượng bị mờ hoàn toàn.
5. **Đừng để hành động phức tạp và quay phim phức tạp cạnh tranh cùng thời điểm.** Nếu nguyên tác cho phép tách góc máy, phân bổ tương tác phức tạp tại các ranh giới `E##` đã có. Nếu nguyên tác yêu cầu đồng thời, giữ nguyên đồng thời nhưng giảm độ phức tạp chuyển động camera, nền động và diễn xuất không liên quan.
6. **Chỉ giữ ảnh tham chiếu thật sự cần cho đoạn.** Nếu nhiều ảnh cùng đối tượng nhưng mục đích khác nhau, xác định rõ phạm vi từng ảnh; khi mâu thuẫn xử lý theo A1.2.1, không để mô hình tự trộn.
7. **Thêm Avoid có mục tiêu cho đoạn rủi ro cao, không chất từ phủ định trên cả phim.** Theo rủi ro thực tế có thể ghi: không thêm tay/ngón tay thừa, dính chi, trôi danh tính khuôn mặt, đạo cụ nhân đôi/biến mất, vật thể xuyên tay/xuyên bàn, cơ thể xuyên vật, hình học chảy méo, nhân vật thừa trong gương, v.v. Không có rủi ro thì không máy móc thêm.
8. **Chỉ khi vẫn quá tải mới chia lại góc máy/đoạn.** Chỉ dùng ranh giới nhịp nguồn đã có; không xóa, thêm, đảo thứ tự hoặc thay đổi quan hệ đồng thời.

#### A11.4.3 Tiêu chuẩn đạt kiểm tra ổn định

Trước khi vào A12, xác nhận:
- Mỗi góc máy có nhiệm vụ xem chính rõ ràng;
- Số nhân vật, tiếp xúc cơ thể, số đạo cụ và quan hệ nhân quả hành động đều có thể nhìn rõ đầy đủ bằng cỡ cảnh hiện tại;
- Camera không có lệnh chuyển động mâu thuẫn nhau;
- Không có yêu cầu gương/phản xạ không cần thiết dễ gây nhân đôi chủ thể;
- Các Reference binding không cạnh tranh kiểm soát cùng một khía cạnh;
- Danh tính, trang phục nhân vật quan trọng, cấu trúc sản phẩm và đạo cụ chính đã được khóa ở các trường phù hợp;
- `Avoid` của đoạn rủi ro cao chỉ nhắm tới rủi ro thực, không phải hàng chục từ phủ định chung chung.

---

## A12. Tối ưu trước bàn giao (trau chuốt cuối · chỉ thực hiện một lần)

**A12 chỉ thực hiện một lần.** Đây không phải lượt dựng storyboard thứ hai, không dùng để tính lại số đoạn, chia lại nhịp hoặc quay về A11.

Tối ưu không phải viết lại, mà là kiểm tra cách thể hiện và khả năng thực thi của A12.1–A12.18 trên cấu trúc đã có. Lỗi diễn đạt thông thường thì sửa trực tiếp; xung đột cứng cấp cấu trúc xử lý theo A12.19, không quay lui đệ quy.

### A12.1 Khóa khung hình đầu tiên
Với khung hình đầu của mỗi góc máy, ghi rõ những mục áp dụng:
- Góc máy này có nhân vật hay không; nếu không, ghi rõ “khung hình không người, không có nhân vật”;
- Nhân vật đứng / ngồi / ngồi xổm / nằm;
- Vị trí trái/phải của nhân vật trong khung hình;
- Khoảng cách tương đối giữa các nhân vật;
- Hướng cơ thể;
- Điểm nhìn ban đầu (nếu nguyên tác chỉ định rõ đối tượng đang chú ý thì ghi đúng; nếu không, chỉ dùng điểm nhìn trung tính không mang thông tin mới, không suy ra mối quan tâm/sự thù địch/tình ý mới);
- Đang cầm vật gì trong tay;
- Đạo cụ quan trọng được đặt ở đâu;
- Khoảng cách và độ cao camera;
- Tiền cảnh / trung cảnh / hậu cảnh.

Không tự bịa những mục không áp dụng.

### A12.2 Khóa trạng thái xuất hiện theo từng góc máy
Lấy kế hoạch trạng thái theo timeline nội bộ của A4 làm chuẩn. Với 2.5, dù không xuất riêng phần nhận diện tài nguyên, vẫn phải thể hiện các ràng buộc xuất hiện tương tự trong Timeline / Immutable locks.

Với nhân vật không được xuất hiện trong góc máy này, phải ghi rõ:
- Hoàn toàn không xuất hiện trong khung hình;
- Không xuất hiện khuôn mặt / cơ thể / vai / tay / hình phản chiếu / bóng đổ / bóng người ngoài vùng nét (chọn tùy nhu cầu);
- Nếu chỉ có lời thoại đồng bộ từ ngoài khung, phải ghi rõ “chỉ có tiếng nói”.

Đặc biệt với góc nhìn chủ quan, góc quay một bộ phận, góc qua vai và góc chỉ có một người, phải tránh việc mô hình tự thêm nhân vật khác.

### A12.3 Quang học: mô tả kết quả nhìn thấy, không phụ thuộc mã ống kính
- ❌ “85mm f/1.4”
- ✅ “Góc nhìn mang cảm giác chân dung với tiêu cự ngắn, phối cảnh khuôn mặt tự nhiên, nền hơi mờ”

Mã ống kính có thể bổ trợ, nhưng trọng tâm là kết quả hình ảnh cuối cùng.

### A12.4 Kiểm tra mâu thuẫn chuyển động camera
Mỗi góc máy chỉ giữ một logic chuyển động camera chính.
- ❌ “Camera hoàn toàn cố định, đồng thời từ từ di chuyển ngang”
- ✅ “Camera cố định, chỉ chuyển nét cực chậm một lần”

### A12.5 Cách quay gián tiếp (chỉ áp dụng cho phong cách tiết chế/kín đáo)
Khi phong cách của người dùng mang tính tiết chế, kín đáo, có thể ưu tiên:
- Đặc tả bàn tay / chiếc cốc / dây đỏ / mép sàn;
- Góc qua vai / cột che khuất / tiền cảnh ngoài nét;
- Trung cảnh hai người / viễn cảnh cố định.

Không áp dụng ép buộc quy tắc này cho phim hành động, hài đậm, thử nghiệm sản phẩm hoặc phong cách khác.

### A12.6 Diễn xuất: mô tả hành vi thay vì cảm xúc trừu tượng
- ❌ “Anh ấy rất buồn”
- ✅ “Anh ấy đang nâng cốc thì dừng động tác khoảng 0,4 giây, sau đó tiếp tục uống”

Ưu tiên chuyển **phản ứng đã tồn tại trong cốt truyện nguồn** thành hành động có thể nhìn thấy. Chỉ dùng việc dừng ánh mắt / siết ngón tay / khựng cốc / hé rồi khép môi / đổi nhịp thở / chuyển trọng tâm nếu phù hợp với phản ứng gốc; không dùng chúng làm sự kiện diễn xuất mới do AI tự thêm.

### A12.7 Mật độ vi biểu cảm
Mỗi nhân vật trong mỗi góc máy thường có 0–2 sự kiện vi biểu cảm rõ ràng. Khi góc máy không thấy mặt thì không mô tả phản ứng trên mặt.

### A12.8 Cụ thể hóa đối tượng nhìn
Chỉ khi nguyên tác đã ghi rõ nhân vật đang nhìn người/vật/hướng nào mới cụ thể hóa mục tiêu. Nếu nguyên tác không nêu đối tượng chú ý, không được tự chọn đối tượng mang ý nghĩa tình tiết.

Có thể mô tả trình tự tự nhiên “mắt chuyển trước → đầu quay theo sau”, nhưng chỉ để thể hiện hành động nhìn đã có trong nguyên tác, không thêm một lần nhìn mới.

### A12.9 Tránh đồng bộ máy móc giữa hành động của hai người
Nếu nguyên tác có hai hành động vốn có thể diễn ra song song nhưng chưa yêu cầu đồng bộ chính xác, có thể lệch nhịp nhẹ với điều kiện không thay đổi thứ tự và quan hệ nhân quả của sự kiện. **Không được thêm hành động cho bất kỳ nhân vật nào, trì hoãn sự kiện quan trọng hoặc thay quan hệ đồng thời đã được nêu rõ chỉ để “tự nhiên” hơn.**

### A12.10 Chuỗi nhân quả hành động
Ưu tiên sắp xếp **các nhịp nguồn đã tồn tại** thành chuỗi nhân quả rõ ràng. Nếu nguyên tác của người dùng thực sự có nhiều hành động, phải giữ tất cả và chỉ phân bổ giữa các góc máy; không được xóa sự kiện nguồn chỉ vì “mỗi góc máy một hành động chính”. Phải xóa những hành động trang trí do AI tự thêm.

### A12.11 Tính liên tục của đạo cụ (trong đoạn và giữa các đoạn liên quan)

Với mỗi đạo cụ quan trọng, ít nhất phải kiểm tra: **người giữ, tay đang sử dụng (nếu đã xác định), vị trí tuyệt đối, trạng thái nhìn thấy/bị che, số lượng, hướng, trạng thái mở/đóng, mực chất lỏng/nội dung bên trong, hao mòn, vết bẩn/độ ẩm và vị trí cuối đoạn**.

- Trong đoạn, quét từng khối thời gian theo “trạng thái đầu → hành động nguyên tác → trạng thái cuối”. Với các đoạn liên tục liên quan, đối chiếu trạng thái cuối đoạn trước và đầu đoạn sau theo A8.3.
- Nếu một cây bút vẫn đang được nhân vật cầm và không có hành động đặt xuống, trao đi, cất hoặc đánh rơi tương ứng với `E##` nguồn, nó không được tự biến mất ở thời điểm tiếp theo.
- Góc máy sau không thấy đạo cụ vì bị cắt khỏi hình hoặc che khuất không có nghĩa đạo cụ đã biến mất; trạng thái thế giới vẫn được giữ.
- Nếu cùng bàn tay còn nhìn thấy rõ nhưng đạo cụ lại mất không có căn cứ, đó là lỗi liên tục; nếu cả tay và đạo cụ đều ngoài khung, chỉ ghi “nhân vật đó vẫn đang giữ/vật vẫn ở vị trí cũ”, không tự thay đổi trạng thái.
- Đạo cụ đã đặt xuống không thể tự quay lại tay; vật đã trao cho B không thể đồng thời xuất hiện trở lại trong tay A; số lượng không được tự tăng giảm.
- Nếu nguyên tác chưa nêu tay trái/phải và góc máy không cần, không ép khóa tay; một khi prompt đã xác định một tay để thực thi thì không được đổi tay vô cớ giữa các góc máy liên tục liên quan.

Cấm phục hồi hoặc đặt lại trạng thái không có nguyên nhân: chiếc cốc đã uống bỗng đầy lại, vết bẩn đã lau tự trở lại, cửa đang mở tự đóng không có hành động, đạo cụ hỏng tự nguyên vẹn hoặc số lượng vật đã tiêu hao tự phục hồi.

### A12.12 Tính chân thực vật lý
Tập trung kiểm tra quán tính chất lỏng, nếp gấp vải, tiếp xúc giữa tay và đạo cụ, trọng lượng vật thể, rung động mặt bàn, phản hồi va chạm, khúc xạ/phản xạ của kính, v.v.

### A12.13 Tính nhất quán ánh sáng
Trong cùng cảnh liên tục, giữ nguyên hướng ánh sáng chính, nhiệt độ màu và logic phơi sáng. Khi chuyển cảnh hoặc nhảy thời gian, thiết lập lại theo A5.5, không ép kế thừa.

Cấm đột ngột thêm ánh sáng viền, tăng ánh sáng bắt mắt hoặc đổi phơi sáng chỉ vì tình tiết quan trọng, trừ khi phong cách người dùng đã yêu cầu rõ.

### A12.14 Âm thanh
Mặc định chỉ giữ lời thoại đồng bộ thực tế và âm thanh môi trường/hành động. Có dùng BGM, nhạc nền hoặc hiệu ứng nhấn cảm xúc hay không phải theo yêu cầu người dùng; nếu không yêu cầu thì không tự thêm, mặc định không có nhạc nền.

### A12.15 Lời thoại nguyên văn + thời lượng
Lời thoại người dùng cung cấp phải:
- Chép nguyên văn;
- Không đổi từ / đổi cấu trúc câu / thêm từ cảm thán / lặp lại / ứng khẩu.

A12 **không được** giải quyết thoại không đủ thời gian bằng cách “nói nhanh hơn”; vấn đề như vậy phải được xử lý ở A11. A12 chỉ tinh chỉnh cách mô tả khoảng dừng mà không thay đổi cấu trúc.

### A12.16 Ưu tiên khóa điều kiện khẳng định
Ưu tiên ghi trạng thái có thể thực hiện:
- “Nhân vật A luôn ở bên trái khung hình trong góc máy này”;
- “Chiếc cốc được nhân vật A cầm bằng tay phải”;
- “Nhân vật B hoàn toàn ngoài khung trong góc máy này”.

Sau đó mới thêm những điều cấm cần thiết.

### A12.17 Khóa chữ trên hình
Mặc định ghi:
- Không phụ đề;
- Không chữ màn hình bổ sung;
- Không tiêu đề/thẻ giải thích/chữ UI chồng lên hình/watermark ở hậu kỳ.

Nếu góc máy có chữ trên tài nguyên vật lý như bao bì sản phẩm, biển hiệu, thư từ:
- Có ảnh tham chiếu → giữ nguyên tài nguyên tham chiếu, không thêm, viết lại hoặc vẽ lại chữ;
- Không yêu cầu mô hình tạo thêm “chữ mới rõ và chính xác”;
- Chỉ khóa chính xác từng chữ nếu người dùng yêu cầu rõ chữ phải đọc được.

### A12.17.1 Tính đầy đủ của liên kết ảnh tham chiếu (Seedance 2.5)
Khi người dùng cung cấp ảnh tham chiếu, A12 chỉ kiểm tra đã liên kết đủ và xác định rõ mục đích hay chưa; không được thay, xóa, ghép hoặc tự bổ sung ảnh tham chiếu trong giai đoạn tối ưu.

- Mỗi đoạn liên quan phải giữ node tham chiếu thực/mã tài nguyên mà đoạn đó cần;
- Không xóa tham chiếu khỏi đoạn sau chỉ vì “đã liên kết ở đoạn trước”;
- Không mở rộng “chỉ tham chiếu vị trí” thành tham chiếu ngoại hình nhân vật;
- Không đưa phông nền, người lạ hoặc đạo cụ bổ sung từ ảnh tham chiếu nhân vật vào cốt truyện;
- Không viết lại phần chữ phức tạp trong ảnh tham chiếu sản phẩm thành nội dung bao bì mới.

### A12.18 Chỉ thêm các giới hạn chung khi cần
Có thể chọn theo dự án hiện tại:
- Không thêm nhân vật / đạo cụ / lời thoại / hành động cốt truyện;
- Không tự ý vượt trục / không hoán đổi vị trí nhân vật khi thiếu quá trình;
- Không dựng cắt nhanh kiểu MV;
- Không thêm ánh sáng phụ kiểu quảng cáo / làm mịn da khi không có căn cứ phong cách;
- Không phóng đại độ sâu trường ảnh / không dùng quay chậm thiếu tự nhiên.

**Không máy móc dán các giới hạn không liên quan góc máy hiện tại.**

### A12.18.1 Kiểm toán cuối về tính liên tục và nguy cơ lỗi hình (bắt buộc trước bàn giao)

A12 sau khi trau chuốt câu chữ, trước khi xuất bản cuối, phải thực hiện thêm một lần **kiểm toán một chiều**, không quay về A11 hoặc kích hoạt lượt A12 thứ hai:

1. **Lập bản chụp trạng thái đầu/cuối mỗi đoạn:** vị trí thế giới, tư thế, hướng, trạng thái xuất hiện và tay đang sử dụng của nhân vật; người giữ/vị trí/số lượng/trạng thái đạo cụ quan trọng; trạng thái liên tục của cửa, cửa sổ, đồ nội thất, vết bẩn, nguồn sáng trong bối cảnh.
2. **Chỉ so sánh những cặp đoạn A8 xác định là “liên hệ liên tục / liên hệ trạng thái cục bộ”.** Không ép so sánh vị trí nhân vật giữa các đoạn liền kề không có liên hệ liên tục; chỉ kiểm tra tính hợp lý của bản thân đoạn đó.
3. **Kiểm tra lỗi hình nhân vật:** dịch chuyển tức thời vô căn cứ, đổi bên vô căn cứ, đứng ↔ ngồi không có quá trình, nhân đôi cùng nhân vật thành hai người tại một vị trí thế giới, mâu thuẫn giữa mô tả trong/ngoài khung và vị trí camera.
4. **Kiểm tra lỗi đạo cụ:** biến mất, nhân đôi, đổi tay, quay trở lại tay, thay đổi số lượng, đặt lại trạng thái mở/đóng, phục hồi mực chất lỏng/vết bẩn/hư hỏng khi thiếu căn cứ; đặc biệt kiểm tra “giây trước còn cầm, giây sau cùng bàn tay vẫn nhìn rõ nhưng trống không”.
5. **Kiểm tra lỗi không gian:** đồ nội thất cố định tự dịch chuyển, cửa/cửa sổ nhảy trạng thái, nhân vật xuyên tường/xuyên bàn, đồ vật xuyên tay, tỷ lệ nhân vật với bàn ghế đột ngột thay đổi, phản chiếu/gương có thêm nhân vật hoặc đạo cụ không tồn tại.
6. **Kiểm tra nguy cơ hình ảnh bị lỗi khi tạo:** các góc máy rủi ro cao đã giảm chuyển động camera, che khuất, độ sâu trường ảnh, tiếp xúc đồng thời và xung đột tham chiếu theo A11.4 chưa; đã thêm Avoid nhắm đúng rủi ro thực tế của góc máy chưa.
7. **Rà soát trung thành cốt truyện:** mọi chỉnh sửa chỉ được thay đổi cách thể hiện bằng camera, thông tin khóa, mô tả che khuất/nhìn thấy và cách góc máy chứa nội dung; không thêm hành động nối như “đặt bút xuống”, “nhặt bút lên lần nữa”, “đi về vị trí cũ” để che giấu lỗi hình.

Nếu mâu thuẫn nằm trong bản nháp do AI tạo, sửa trực tiếp trong A12 lần này để khớp trạng thái đã xác nhận. Nếu mâu thuẫn vốn nằm trong cốt truyện nguồn, giữ nguyên nguyên tác và đánh dấu “Mâu thuẫn văn bản nguồn” trong tổng quan toàn phim.

**Mục này chỉ kiểm toán nguy cơ lỗi hình ở phía prompt, không có nghĩa video thực sự được tạo đã hết lỗi.** Các lỗi trong video thật như thừa tay/ngón tay, dính chi, đổi khuôn mặt, đạo cụ chớp xuất hiện/biến mất, xuyên vật thể, phản chiếu sai, v.v. bắt buộc nghiệm thu riêng khi có thể đọc phương tiện thực tế.

### A12.19 Giới hạn tối ưu và điều kiện kết thúc (tránh lặp vô hạn)

A12 không được thay đổi:
- Lời thoại nguyên văn người dùng;
- **Hành động, phản ứng, số lượng sự kiện, người thực hiện, người chịu tác động, đạo cụ, thông tin và quan hệ nhân quả của bất kỳ nhịp nguồn `E##` nào**;
- **Mức độ mơ hồ về danh tính trong nguyên tác của người dùng (ví dụ không tự cụ thể hóa “cha mẹ/phụ huynh/người lớn”)**;
- Ý đồ cốt lõi của câu chuyện;
- Thứ tự nhịp đã được xác nhận trong A11;
- Số đoạn thực tế toàn phim / thời lượng mỗi đoạn;
- Số thứ tự đoạn toàn cục / kế hoạch Batch;
- Danh tính các tài nguyên quan trọng;
- Logic tọa độ thế giới đã xác nhận.

A12 chỉ được phép:
- Viết mô tả cụ thể và dễ thực hiện hơn;
- Bổ sung đầy đủ khóa khung hình đầu/trạng thái xuất hiện;
- Giảm diễn xuất quá mức;
- Bổ sung mô tả vật lý, ánh sáng, âm thanh và tính liên tục;
- Sửa câu chữ mâu thuẫn nhau.

**Phân biệt nguồn mâu thuẫn:**
- Nếu mâu thuẫn do lỗi diễn đạt trong bản nháp AI (ví dụ cùng góc máy nói nhân vật cầm cốc bằng cả tay trái và tay phải như những điều loại trừ nhau) → sửa trực tiếp trong A12 cho khớp trạng thái đã xác nhận ở A11;
- Nếu mâu thuẫn vốn có trong kịch bản nguồn của người dùng (ví dụ cùng một thời điểm ghi rõ hai vị trí loại trừ nhau) → không tự sửa tình tiết, ghi “Mâu thuẫn văn bản nguồn” trong tổng quan toàn phim.

**Quy tắc kết thúc:** Sau khi hoàn tất A12 một lần, chỉ thực hiện danh sách kiểm tra cuối; không quay lại A11 hoặc chạy A12 lần thứ hai.

Danh sách kiểm tra cuối:
- [ ] Mọi nhịp nguồn `E##` đều xuất hiện và giữ nguyên thứ tự, người thực hiện, đối tượng, lời thoại;
- [ ] Timeline không có hành động tình tiết mới thiếu `E##` nguồn;
- [ ] Không tự thêm quá khứ, nguồn gốc đạo cụ hoặc cụ thể hóa nhân vật mơ hồ;
- [ ] Đã điền đầy đủ những điều kiện khung hình đầu có thể áp dụng;
- [ ] Trạng thái xuất hiện trong từng góc máy nhất quán với A4;
- [ ] Không có lệnh camera mâu thuẫn;
- [ ] Diễn xuất nhìn thấy được và không quá tải;
- [ ] Đối tượng nhìn cụ thể;
- [ ] Đạo cụ / vật lý / ánh sáng liên tục;
- [ ] Đã xác định loại liên hệ của mọi cặp đoạn liền kề theo A8; trong các đoạn liên tục, vị trí/tư thế/hướng nhân vật nhất quán, các đoạn không liên hệ không bị khóa nhầm;
- [ ] Đạo cụ quan trọng không tự biến mất, nhân đôi, đổi tay, quay lại tay, đổi số lượng hoặc đặt lại trạng thái thiếu căn cứ; việc cắt khuôn hình/che khuất không bị hiểu sai là thay đổi trạng thái thế giới;
- [ ] Đã kiểm toán nguy cơ lỗi hình về không gian/cửa, cửa sổ/đồ nội thất/phản xạ/gương/xuyên vật thể;
- [ ] Các góc máy rủi ro cao đã vượt qua tiền kiểm ổn định A11.4 và được giảm độ phức tạp đúng mục tiêu;
- [ ] Lời thoại nguyên văn không thay đổi;
- [ ] AI không thêm phụ đề/chữ đè;
- [ ] Chữ trên vật thể thật được xử lý theo tài nguyên tham chiếu;
- [ ] Không quay lui cấu trúc / không lặp vô hạn;
- [ ] Nếu mô hình đích là 2.5, bản bàn giao cuối chỉ có các trường A9.2 cho phép, không có khung ba phần cũ, khung 2.0 hoặc cấu trúc chính đánh số góc máy;
- [ ] Ảnh tham chiếu được tạo (nếu có) chỉ dùng cho Reference binding, ngoại hình được ghi là đề xuất thiết kế, không vượt quyền bổ sung vị trí/ánh sáng/tình tiết (bổ sung trường hợp hai A1.2).

**Hoàn tất danh sách kiểm tra → xuất phiên bản cuối cùng.**

---

═══════════════════════════════════════════

---

## Tiến hành trên Canvas

Sản xuất thực tế mặc định được thể hiện trên Canvas hiện tại, nhưng **tuyến Seedance có ưu tiên trước bước khám phá và cấu hình Canvas**. Nếu đã có kịch bản/timeline có thể thực thi và mục tiêu hiện tại là sản xuất, tạo, tiếp tục hoặc sửa video, trước tiên phải hoàn tất kế hoạch và chốt prompt Seedance tương ứng theo PART A trong tệp này. Sau đó mới vào [Thực thi Canvas](references/canvasExecution.md) để đọc tổng quan Canvas, node đích, kết nối cục bộ, cấu hình mô hình, cổng và hàm node khi cần. Không bỏ qua PART A chỉ vì cần `getConfig`, chọn độ phân giải/tỷ lệ khung hình/chế độ hoặc ứng dụng hiển thị câu hỏi cấu hình. Chỉ khi chưa bước vào giai đoạn sản xuất video mới khám phá Canvas trước theo quy trình thường. “Hoàn tất kịch bản và phương án tài nguyên trước” chỉ giới hạn giai đoạn: vẫn dùng node văn bản, không kích hoạt tạo phương tiện. Chỉ bỏ thao tác node khi người dùng yêu cầu rõ chỉ trả lời văn bản, tư vấn hoặc không thao tác Canvas. Không gian làm việc sử dụng dự án hiện tại của ứng dụng. Nếu Canvas chưa mở, nêu điều kiện cụ thể và tiếp tục phần văn bản có thể hoàn tất.

| Giai đoạn đã đến | Sản phẩm hiện tại | Cần đọc |
|---|---|---|
| 1. Nội dung và phạm vi | Node văn bản nguyên tác hoặc kịch bản; bản tóm tắt yêu cầu sản xuất cần thiết | [Đầu vào và kịch bản](references/sourceAndScript.md) |
| 2. Tài nguyên | Danh sách nhân vật, bối cảnh, đạo cụ trong phạm vi hiện tại và ảnh thực tế được chọn | [Tạo tài nguyên](references/assets.md) |
| 3. Prompt Seedance | Kế hoạch toàn phim, chia đoạn và prompt chính thức bao phủ tình tiết của lượt này; **chỉ thực thi PART A tích hợp trong tệp này** (2.0 theo A9.1, 2.5 theo A9.2), không đọc storyboard hoặc methods trong giai đoạn này | **Chỉ PART A tích hợp trong tệp này** |
| 4. Tạo và chọn | Node tạo cho đoạn hiện tại, đầu ra thực, phản hồi và bản ghi lựa chọn | [Thực thi Canvas](references/canvasExecution.md), [Trạng thái và bàn giao](references/stateAndDelivery.md) |
| 5. Bàn giao hoặc tiếp tục | Chỉ mục kịch bản, tư liệu và đoạn hợp lệ, phạm vi thực sự hoàn thành và bước tiếp theo | [Trạng thái và bàn giao](references/stateAndDelivery.md) |

Chỉ tạo các node cần cho giai đoạn hiện tại đã đến. Một đoạn tình tiết có thể chứa nhiều góc máy và mặc định tương ứng một prompt hoàn chỉnh cùng một node tạo video. Không mặc định tạo khung hình chính trước cho mỗi góc máy. Kết nối chỉ truyền tư liệu thực, không đại diện cho phê duyệt hoặc lập lịch tự động.

Tài nguyên chính thức trong sản xuất cốt truyện phải dựa trên kịch bản hoàn chỉnh đã xác nhận của lượt này. Khi thiết kế riêng nhân vật, bối cảnh hoặc đạo cụ, căn cứ vào yêu cầu thiết kế người dùng đã xác nhận và tư liệu có sẵn, không yêu cầu viết bổ sung kịch bản. Nếu người dùng yêu cầu đồng thời kịch bản và phương án tài nguyên, có thể trích danh sách tài nguyên và bản nháp thiết kế trong cùng lượt, ghi rõ chúng phụ thuộc kịch bản đang chờ xác nhận; không coi bản nháp là quyền tạo. Nhân vật không cần có tiểu sử đầy đủ trước; nhân vật chỉ có tiếng nói không cần tạo chân dung vô dụng. Đưa phong cách, diễn xuất, hành động và tính liên tục trực tiếp vào tư liệu sản xuất và góc máy, không bắt buộc viết báo cáo riêng cho từng loại. Không tạo tài liệu rỗng khi không có nhu cầu đánh nhau, đạo cụ đặc biệt, v.v.

## Đọc phương pháp theo vấn đề sáng tạo hiện tại

Quy tắc thực thi quyết định cách lưu, tạo và tiếp tục trong Toonflow. Các phương pháp bên dưới **chỉ dùng cho sáng tác/chuyển thể/thiết kế tài nguyên trước giai đoạn prompt Seedance hoặc thực thi phương tiện sau khi prompt Seedance đã hoàn tất**. Sau khi bước vào cách ly nghiêm ngặt của prompt Seedance, không đọc phương pháp sáng tạo nào trong mục này. Không để những phương pháp đó ghi đè PART A trước hoặc sau khi prompt được chốt.

| Vấn đề đang giải quyết | Phương pháp cần đọc | Nơi ghi nhận kết quả đánh giá |
|---|---|---|
| Chuyển kịch bản đã xác nhận thành prompt từng đoạn Seedance 2.0/2.5 (nhịp, thời lượng, vị trí, diễn xuất, camera, tính liên tục, mẫu) | **“SEEDANCE EPISODE DIRECTOR · PART A” tích hợp trong tệp này** | Kế hoạch chia đoạn, prompt chính thức từng đoạn (A9.1/A9.2), khóa trung thành cốt truyện |
| Ý tưởng, động lực nhân vật, nhân quả, đề cương hoặc tiếp tục câu chuyện | [Phát triển câu chuyện](references/methods/storyDevelopment.md) | Mệnh đề hành động, chuỗi sự kiện, lựa chọn và kết quả |
| Chuyển tiểu thuyết thành nghe nhìn, bối cảnh, tâm lý, lời thoại và thời lượng | [Chuyển thể kịch bản](references/methods/screenAdaptation.md) | Các cảnh, hành động và âm thanh đầy đủ, phương án chuyển thể và ước tính thời lượng |
| Ngoại hình, không gian, cấu trúc đạo cụ và trạng thái kéo dài | [Thiết kế hình ảnh](references/methods/visualDesign.md) | Đặc điểm tài nguyên, mẫu không gian và biến thể |
| Phong cách, màu gốc của vật liệu, ánh sáng chiếu và chỉnh màu | [Màu sắc và ánh sáng](references/methods/colorAndLight.md) | Cơ sở thị giác dùng chung, ánh sáng bối cảnh và ràng buộc đoạn phim |
| Sáng tác/chuyển thể cốt truyện trước khi chốt | Chỉ dùng phương pháp phát triển câu chuyện và chuyển thể kịch bản ở trên | Hình thành kịch bản có thể xác nhận; ngay khi chốt và bước vào Seedance, ngừng áp dụng các phương pháp này |
| Thực thi và nghiệm thu phương tiện sau prompt Seedance hoàn chỉnh | [Thực thi Canvas](references/canvasExecution.md), [Trạng thái và bàn giao](references/stateAndDelivery.md) | Chỉ thực thi prompt đã chốt, kết nối tham chiếu thực, kiểm tra đầu ra thực; không viết thêm quy tắc prompt khác |

Kết luận từ các phương pháp này chỉ được đưa vào sản phẩm kịch bản/thiết kế tài nguyên **trước Seedance**. Sau khi bước vào cách ly nghiêm ngặt của prompt Seedance, không được trực tiếp ghi hoặc sửa prompt cuối bằng bất kỳ kết luận phương pháp nào; PART A phải xử lý lại từ đầu vào đã xác nhận. Ví dụ phương pháp, nhịp thể loại và phương án phong cách không được tự trở thành sự thật của dự án.

Chỉ khi chi phí bàn giao và ghép kết quả thấp hơn khối lượng phân tích riêng lẻ mới được dùng `subAgent` để phân chia việc trích xuất sự thật từ nguyên tác dài hoặc sắp xếp tư liệu **trước Seedance**. **Trong giai đoạn cách ly nghiêm ngặt của prompt Seedance, cấm để subAgent tự soạn, viết lại hoặc tối ưu prompt chia đoạn**; A0–A12 phải được hoàn thành thống nhất bởi cùng một luồng thực thi chính, tránh đưa hệ quy tắc thứ hai về góc máy/diễn xuất/tính liên tục từ tác vụ con.

Với lượng văn bản nhỏ, kiểm kê tài nguyên, nối node và bố trí, hãy làm trực tiếp, không phân vai cố định hay thêm vòng rà soát. Việc chia công chỉ giới hạn ở xử lý nội dung độc lập, không thay đổi quy trình xác nhận, tạo và lựa chọn sau này. Đoạn tạo tiếp theo phụ thuộc kết quả thực của đoạn trước vẫn phải chờ kết quả đó.

## Xác nhận và thực thi

- Trình bày sản phẩm thực chất của giai đoạn và hỏi có cần điều chỉnh không; giữ nguyên nội dung và phạm vi sản xuất liên tục người dùng đã phê duyệt rõ. Không biến mỗi lần gọi công cụ, phân tích nội bộ hoặc bước con không cần thiết thành câu hỏi.
- Ghi riêng việc xác nhận nội dung, quyền tiêu tốn tài nguyên tính toán và lựa chọn kết quả. Trước khi tạo, trình bày phương án cụ thể có thể xem xét: đối tượng và số lượng, mô hình, prompt đầy đủ, tham chiếu thực, thông số và số lần thực thi. Dùng thống nhất cụm từ “tiêu tốn tài nguyên tính toán” khi nói với người dùng; nếu không tra được thì ghi “Chưa biết mức tiêu tốn tài nguyên tính toán”.
- Xin phép qua `askUser` của ứng dụng hoặc phản hồi xác nhận rõ ràng. Không hỏi lại từng node cho cùng phương án/lô cụ thể đã phê duyệt; nếu thêm số lượng, đổi phương án thực tế hoặc thử lại bổ sung thì kiểm tra phạm vi quyền có bao gồm không. Lệnh “tiếp tục” thông thường, im lặng và biểu mẫu thất bại không tạo thành quyền mới để bắt đầu tạo.
- Mô hình đích Seedance chỉ được xác định theo PART A A0; **nếu chưa chỉ định, bắt buộc hỏi ngắn một lần xác nhận 2.0 hoặc 2.5 trước**. Câu hỏi này thuộc A0 của Seedance, không phải cấu hình Canvas, và không được gỡ khóa tuyến. Chỉ sau khi mô hình đã xác nhận và đã vào PART A, lớp Canvas mới được dùng cấu hình thời gian thực kiểm tra mô hình/chế độ đó có thực sự thực thi được không. Giá trị mặc định node, mặc định ứng dụng, biểu mẫu cấu hình, cấu hình lịch sử hoặc câu trả lời về độ phân giải/tỷ lệ khung hình không được ghi đè hoặc gỡ tuyến mô hình A0; khi kết thúc hỏi đáp cấu hình phải tiếp tục cùng trạng thái thực thi Seedance.
- Có lời thoại không đồng nghĩa bắt buộc có mẫu giọng từ bên ngoài. Cách viết âm thanh trong prompt chỉ tuân theo PART A; khi thực thi thực tế chỉ dùng [Thực thi Canvas](references/canvasExecution.md) để kiểm tra mô hình có hỗ trợ âm thanh gốc và đầu vào âm thanh thực hay không, không vì đó mà sửa quy tắc thoại/âm thanh của PART A.

## Nguyên tắc tối thiểu để hoàn tất và khôi phục

Nội dung của node văn bản được lưu bằng hàm node; đường dẫn tệp đọc từ `data.textPath` thực tế. Sản xuất qua nhiều lượt dùng một bản ghi trạng thái gọn và một node tổng quan. Kế thừa sổ theo dõi hiện có, không yêu cầu làm lại chỉ vì thiếu mẫu cố định.

Văn bản chờ xác nhận hoặc đã được chọn cần có căn cứ phiên bản cố định; khi tạo phải giữ prompt, tham số, tham chiếu và đầu ra cũ của lượt này. Sau khi xác nhận phải kiểm tra lại node thực tế để tránh coi chỉnh sửa người dùng thực hiện trong thời gian chờ là nội dung đã phê duyệt. Tư liệu đã chọn ưu tiên cố định ở node tư liệu; bản sửa tạo phương án ứng viên riêng. Xem cách làm cụ thể tại [Trạng thái và bàn giao](references/stateAndDelivery.md).

Nếu node phương tiện gốc trả về `generating` thì chỉ có nghĩa tác vụ đã bắt đầu, không được tuyên bố hoàn thành. Nếu lượt này không có công cụ đọc trạng thái thực tế hoặc chờ kết quả, sau khi làm xong các thao tác khởi chạy và văn bản đã được phép, không có phụ thuộc, hãy ghi nhận và đề nghị người dùng phản hồi khi hoàn tất rồi đọc lại node tương ứng. Không bịa cơ chế tự đánh thức hay thăm dò nền. Việc tạo đoạn sau trong chuỗi liên tục phải chờ đoạn trước được chọn và có trạng thái ranh giới thực; kế hoạch văn bản có thể liệt kê trạng thái dự kiến trước. Tài nguyên hoặc đoạn độc lập có thể được lên lịch theo lô đã được cấp phép rõ.

Có đường dẫn video không có nghĩa Agent đã xem video. Chỉ kiểm tra theo khả năng đọc phương tiện thực tế; nếu không đủ khả năng, để người dùng xem trước và báo vấn đề, trạng thái nối cảnh cùng quyết định lựa chọn, đồng thời nêu rõ phần Agent chưa kiểm tra. Khi bàn giao, phân biệt đoạn đã tạo, đoạn người dùng đã chọn, phim hoàn chỉnh đã ghép và bản sao đã tập hợp. Nếu thiếu công cụ tương ứng thì bàn giao trung thực những gì đã có và các phần còn thiếu.
