# Kiểm kê Việt hóa ToonFlow — bảng V1, ngày 2026-11-08

**Tình trạng:** 127 ID được đưa vào mã theo bản dịch duyệt, chỉ xác minh ở mức tĩnh; **chưa hoàn thành Việt hóa toàn bộ ToonFlow**.

**Nguồn đối chiếu bắt buộc:** `ToonFlow_Bang_Viet_Hoa_Prompt_v1.xlsx` và `ToonFlow_Prompt_Viet_Hoa_Cho_AI_Lap_Trinh_v1.md` do người dùng đính kèm trong phiên thực hiện, đối chiếu với commit nguồn `ddd0667c933f7ebb2c0c6a74cd8956e584c169b2`.

**Bằng chứng thay đổi mã:** [commit có 127 bản dịch](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/cbeb30013f5a07da42c64b74eebd3d748e6d4538). [Trở lại sổ ghi chú](./overview.md).

## Tóm tắt kiểm tra

- Excel ↔ Markdown: 127/127 ID có cùng đường dẫn, hash gốc, câu Trung và câu Việt; hash SHA-256 rút gọn của mọi câu gốc đã được xác minh bằng công cụ.
- Chuỗi gốc trong code commit tham chiếu: 127/127 tìm thấy ở tệp đúng. **0 mục sai nguyên văn**. Trong đó 95 ID có một lần trùng gốc; 32 ID có nhiều vị trí trùng hoặc là chuỗi con, đã kiểm tra ngữ cảnh đúng và không replace-all toàn repo.
- Chuỗi tiếng Việt được duyệt: 127/127 được tìm thấy tại đường xử lý phù hợp ở code nhánh. Câu Trung gốc vẫn giữ lại ở mã, riêng 26 mục Settings cập nhật giá trị từ điển `vi.json` (18 giá trị thay đổi, 8 đã đúng).
- Có hai bản system prompt riêng theo locale trong server, hai bản prompt 3D riêng, mô tả Node tool chọn theo ngôn ngữ host, Node label chọn theo ngôn ngữ host. Không sửa 20 bộ từ điển khác.
- Ký hiệu template trong prompt nền của Agent và Đạo diễn 3D đã được kiểm tra là giữ nguyên; chưa chạy typecheck, build hoặc nghiệm thu phát sinh nội dung AI.

## Danh sách 127 ID được đối chiếu

**Cột số lần khớp:** số lần chuỗi gốc xuất hiện tại đúng tệp mã nguồn của commit tham chiếu. `Nhiều` chỉ phản ánh cần đối chiếu đúng nơi sử dụng, **không** cho phép dịch tất cả vị trí.

| ID | Tệp đối chiếu | Hash gốc (16 ký tự) | Số lần khớp | Trạng thái |
|---|---|---|---|---|
| `VI-0001` | `apps/server/src/agent/runtime/prompt.ts` | `4640d88324dc4f8f` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0002` | `apps/server/src/agent/runtime/prompt.ts` | `119161e9b53602a4` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0003` | `apps/server/src/agent/runtime/prompt.ts` | `40cb0bfc9590e8c9` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0004` | `apps/server/src/agent/runtime/prompt.ts` | `a54bda1144a6034d` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0005` | `apps/server/src/agent/runtime/prompt.ts` | `d1d31fd4a0e0fbb5` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0006` | `apps/server/src/agent/runtime/prompt.ts` | `e043e455286d963a` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0007` | `apps/server/src/agent/runtime/prompt.ts` | `d70d4f4c5b704617` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0008` | `apps/server/src/agent/runtime/prompt.ts` | `d299eec46a650274` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0009` | `apps/server/src/agent/runtime/prompt.ts` | `845781d6a7a2a7de` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0010` | `apps/server/src/agent/runtime/prompt.ts` | `192c2a8c262f352a` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0011` | `apps/server/src/agent/runtime/prompt.ts` | `1bb71b9bb9a436e1` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0012` | `apps/server/src/agent/runtime/prompt.ts` | `83463a355cf678c8` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0013` | `apps/server/src/agent/runtime/prompt.ts` | `6505ac058b17f529` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0014` | `apps/server/src/agent/runtime/prompt.ts` | `557cc74bcc8e1492` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0015` | `apps/server/src/agent/runtime/prompt.ts` | `ad6e4000716e49b1` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0016` | `apps/server/src/agent/runtime/prompt.ts` | `542ac93fa4ff3084` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0017` | `apps/server/src/agent/runtime/prompt.ts` | `ebc218c1e091237d` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0018` | `apps/server/src/agent/runtime/prompt.ts` | `4a0242036230b29b` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0019` | `apps/server/src/agent/runtime/prompt.ts` | `f8f54bbc0af3ae5f` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0020` | `apps/server/src/agent/runtime/prompt.ts` | `c8ac3793cefbcb00` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0021` | `apps/server/src/agent/runtime/prompt.ts` | `627dddff175ec723` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0022` | `apps/server/src/agent/runtime/prompt.ts` | `cbd6ff77618e8a73` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0023` | `apps/server/src/agent/runtime/prompt.ts` | `7dbab76d55215ad3` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0024` | `apps/server/src/agent/runtime/prompt.ts` | `72230fff3500bbcf` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0025` | `apps/server/src/agent/runtime/prompt.ts` | `7dbf77a26e5cbb8c` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0026` | `apps/server/src/agent/runtime/prompt.ts` | `5a16cb250f0ed9a0` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0027` | `apps/server/src/agent/runtime/prompt.ts` | `5a1c43024df0bc2c` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0028` | `apps/server/src/agent/runtime/prompt.ts` | `09001089bf557088` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0029` | `apps/server/src/agent/runtime/prompt.ts` | `65d7767d656b2546` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0030` | `apps/server/src/agent/runtime/prompt.ts` | `1c53f4f4daef16f6` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0031` | `apps/server/src/agent/runtime/prompt.ts` | `2ae99dff724e3c9d` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0032` | `apps/server/src/agent/runtime/prompt.ts` | `815b2fe43b64dc85` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0033` | `apps/server/src/agent/runtime/prompt.ts` | `492ccbb8a66b280e` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0034` | `apps/server/src/agent/runtime/prompt.ts` | `a3a8377d755ba0fd` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0035` | `apps/server/src/agent/runtime/prompt.ts` | `55f660c30207eb3c` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0036` | `apps/server/src/agent/runtime/prompt.ts` | `9da2b2d16cc853cd` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0037` | `apps/server/src/agent/runtime/prompt.ts` | `cd3c77e3e9306ec4` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0038` | `apps/server/src/agent/runtime/prompt.ts` | `9435b773ee831abd` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0039` | `apps/server/src/agent/runtime/prompt.ts` | `850472b9ee548ba6` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0040` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `715e6efeb5ee81cc` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0041` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `df0dcbc413822897` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0042` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `d6a4c26b47b8f685` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0043` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `da8ad0742f10a6aa` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0044` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `95e531131feac0b2` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0045` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `a1417790cf28d274` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0046` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `b9dc66ef6fa0745b` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0047` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `695583fc058beaed` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0048` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `a3ff8dcbc5887554` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0049` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `f05f1ec60debe1a0` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0050` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `91e56a98c10cdd13` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0051` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `a0fa084370df726e` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0052` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `bd2dee1df2930557` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0053` | `packages/nodes/director3dNode/src/agentPrompt.ts` | `5f7c34acd134e4cd` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0054` | `packages/nodes/imageGenerationNode/src/index.vue` | `3b1cc168dea2b83f` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0055` | `packages/nodes/imageGenerationNode/src/index.vue` | `fb4656fdbfd5f6af` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0056` | `packages/nodes/imageGenerationNode/src/index.vue` | `2e47a9509aa6e50c` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0057` | `packages/nodes/imageGenerationNode/src/index.vue` | `0cd1a452e5b4590c` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0058` | `packages/nodes/videoGenerationNode/src/index.vue` | `4ba7266b4b3da6cb` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0059` | `packages/nodes/videoGenerationNode/src/index.vue` | `cef6b4c211de6bc4` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0060` | `packages/nodes/videoGenerationNode/src/index.vue` | `2b6ad0b7c4b988f0` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0061` | `packages/nodes/videoGenerationNode/src/index.vue` | `09ea271c8dffc29e` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0062` | `packages/nodes/textNode/src/index.vue` | `c0c70a6e069d1de6` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0063` | `packages/nodes/director3dNode/src/agentTools.ts` | `9aa3d1f1532cbbd4` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0127` | `packages/nodes/director3dNode/src/agentTools.ts` | `05a4df16badee4bf` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0064` | `packages/nodes/imageGenerationNode/src/index.vue` | `9c56cb9536631c49` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0065` | `packages/nodes/imageGenerationNode/src/index.vue` | `501aa006a82a5b80` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0066` | `packages/nodes/imageGenerationNode/src/index.vue` | `1d51a96f2be2f94c` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0067` | `packages/nodes/imageGenerationNode/src/index.vue` | `fc6911e71ad9c4b5` | Nhiều (3) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0068` | `packages/nodes/imageGenerationNode/src/index.vue` | `dab8874278b8e597` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0069` | `packages/nodes/imageGenerationNode/src/index.vue` | `c62a58459251b02c` | Nhiều (10) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0070` | `packages/nodes/imageGenerationNode/src/index.vue` | `7fe1b7664ae9d84e` | Nhiều (9) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0071` | `packages/nodes/imageGenerationNode/src/index.vue` | `a10bdbb66360b255` | Nhiều (4) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0072` | `packages/nodes/imageGenerationNode/src/index.vue` | `9df3d83c5f359675` | Nhiều (4) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0073` | `packages/nodes/imageGenerationNode/src/index.vue` | `612485e150952770` | Nhiều (4) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0074` | `packages/nodes/imageGenerationNode/src/index.vue` | `7902a782e7c126c1` | Nhiều (3) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0075` | `packages/nodes/imageGenerationNode/src/index.vue` | `dbc39d0565e7c7a1` | Nhiều (4) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0076` | `packages/nodes/imageGenerationNode/src/index.vue` | `75306d589d692340` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0077` | `packages/nodes/imageGenerationNode/src/index.vue` | `1afed6a81a2512d2` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0078` | `packages/nodes/imageGenerationNode/src/index.vue` | `e2ebc59779f012ed` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0079` | `packages/nodes/imageGenerationNode/src/index.vue` | `20964c8ed34f10d4` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0080` | `packages/nodes/imageGenerationNode/src/index.vue` | `9ad0aac32ea304be` | Nhiều (5) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0081` | `packages/nodes/imageGenerationNode/src/index.vue` | `e2705d0d4f1e5346` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0082` | `packages/nodes/imageGenerationNode/src/index.vue` | `71c9cf3da9ea6ea5` | Nhiều (4) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0083` | `packages/nodes/imageGenerationNode/src/index.vue` | `1f0923326e1c8785` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0084` | `packages/nodes/imageGenerationNode/src/index.vue` | `8a909cefdd9a8942` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0085` | `packages/nodes/videoGenerationNode/src/index.vue` | `89174fe72eeec3ae` | Nhiều (7) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0086` | `packages/nodes/videoGenerationNode/src/index.vue` | `39089f4075f674dc` | Nhiều (4) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0087` | `packages/nodes/videoGenerationNode/src/index.vue` | `089a426926c8b6c9` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0088` | `packages/nodes/videoGenerationNode/src/index.vue` | `014cb112fd912816` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0089` | `packages/nodes/videoGenerationNode/src/index.vue` | `56e56614fed043ae` | Nhiều (4) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0090` | `packages/nodes/videoGenerationNode/src/index.vue` | `5b7c7d64817d9854` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0091` | `packages/nodes/videoGenerationNode/src/index.vue` | `07498e644a4747b3` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0092` | `packages/nodes/videoGenerationNode/src/index.vue` | `1afed6a81a2512d2` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0093` | `packages/nodes/videoGenerationNode/src/index.vue` | `9ad0aac32ea304be` | Nhiều (5) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0094` | `packages/nodes/videoGenerationNode/src/index.vue` | `e2705d0d4f1e5346` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0095` | `packages/nodes/textNode/src/index.vue` | `dd81861811e57bf7` | Nhiều (24) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0096` | `packages/nodes/textNode/src/index.vue` | `1c6d720b38d1592c` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0097` | `packages/nodes/textNode/src/index.vue` | `9ea909081835eccb` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0098` | `packages/nodes/textNode/src/index.vue` | `57641a68c4a5ac42` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0099` | `packages/nodes/textNode/src/index.vue` | `1afed6a81a2512d2` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0100` | `packages/nodes/textNode/src/index.vue` | `1ad1463fe16fc2a6` | Nhiều (8) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0101` | `apps/web/src/components/settings/panels/general/ui.vue` | `6b5b0aafdaed28da` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0102` | `apps/web/src/components/settings/panels/general/ui.vue` | `3a3ebd8ad6599924` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0103` | `apps/web/src/components/settings/panels/general/ui.vue` | `ab8289975e854515` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0104` | `apps/web/src/components/settings/panels/general/ui.vue` | `9f6fee1aba17a565` | Nhiều (3) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0105` | `apps/web/src/components/settings/panels/general/ui.vue` | `edbdb0dbdaae2796` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0106` | `apps/web/src/components/settings/panels/general/ui.vue` | `97cefbbbfb554b2f` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0107` | `apps/web/src/components/settings/panels/general/ui.vue` | `7d5ce714f1d6c411` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0108` | `apps/web/src/components/settings/panels/general/ui.vue` | `df9770b122279aae` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0109` | `apps/web/src/components/settings/panels/general/ui.vue` | `b933becd14d641e6` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0110` | `apps/web/src/components/settings/panels/general/ui.vue` | `4eafa9e925b30bcd` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0111` | `apps/web/src/components/settings/panels/general/ui.vue` | `0c30c37c6ead953b` | Nhiều (3) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0112` | `apps/web/src/components/settings/panels/general/ui.vue` | `104d3d6ae322af83` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0113` | `apps/web/src/components/settings/panels/general/ui.vue` | `c4f549bbbfb789d9` | Nhiều (2) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0114` | `apps/web/src/components/settings/panels/general/ui.vue` | `aa0819dfc4d8d782` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0115` | `apps/web/src/components/settings/panels/general/ui.vue` | `a6b75d0680322a61` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0116` | `apps/web/src/components/settings/panels/general/ui.vue` | `217cfe7db1e3d10a` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0117` | `apps/web/src/components/settings/panels/general/ui.vue` | `9600dd65ff6ba14e` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0118` | `apps/web/src/components/settings/panels/general/ui.vue` | `5b38e6d8d15602e3` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0119` | `apps/web/src/components/settings/panels/general/ui.vue` | `f205bdc28b3b08b9` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0120` | `apps/web/src/components/settings/panels/general/ui.vue` | `b58fafc108f2ca41` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0121` | `apps/web/src/components/settings/panels/general/ui.vue` | `844b8cc8dff7c1d8` | Nhiều (5) | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0122` | `apps/web/src/components/settings/panels/general/ui.vue` | `ff3e021384504ffd` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0123` | `apps/web/src/components/settings/panels/general/ui.vue` | `29df7ebea71ec24b` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0124` | `apps/web/src/components/settings/panels/general/ui.vue` | `86dcc6c3fac05480` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0125` | `apps/web/src/components/settings/panels/general/ui.vue` | `d56c59a95a5dd3ef` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |
| `VI-0126` | `apps/web/src/components/settings/panels/general/ui.vue` | `13d61fea9f174905` | 1 | Đã đối chiếu tĩnh; chưa kiểm thử AI |

## Chuỗi tiếng Trung và phần prompt chưa duyệt

**Giữ nguyên; không tự cấp bản dịch, không thay thế bằng bản tự tạo.**

- `apps/web/src/components/settings/panels/mediaModel/providerPrompt.ts` — toàn bộ provider prompt ngoài bảng.
- `packages/skills/v118workflow/SKILL.md`, `packages/skills/v118workflow/references/*`, `packages/skills/canvas/SKILL.md` — các skill và prompt dài chưa duyệt.
- `packages/tools/*` và các `packages/nodes/*` ngoài danh sách VI-xxxx — chưa kiểm kê/duyệt toàn bộ.
- Ví dụ chuỗi giao diện ngoài bảng V1 tại `apps/web/src/components/settings/panels/general/ui.vue`: `Toonflow 每一个灵感，都值得被看见`; `这是当前颜色、字体与圆角的实际效果。`. Không dịch câu gốc; có thể đã có bản hiển thị qua i18n, nhưng không coi là được duyệt theo bảng này.
- Ví dụ prompt ghép ở `packages/nodes/imageGenerationNode/src/index.vue`: `参考 ` và ` 张图` vẫn là thành phần chưa có mục riêng trong bảng. Giữ nguyên để tránh dịch sai điều kiện số tham chiếu.
- Các câu chưa duyệt khác phải được đối chiếu và bổ sung bảng bởi người điều phối trước khi sửa.

## Kiểm thử chưa thực hiện / cần nghiệm thu

- `bun run typecheck`, Vite build, Electron/Electrobun desktop build chưa chạy (môi trường không có Bun, dependencies và macOS).
- Chưa test UI chuyển `vi` ↔ `zh-CN` ↔ `en` thực tế, lưu/mở lại project, AI Agent System Prompt, Director3D tool/schema, Text/Image/Video Nodes, nhận kết quả AI, dark/light theme.
- **Không kết luận** các chức năng AI đã vận hành; [ISSUE-0005 và ISSUE-0006](./openIssues.md) tiếp tục mở.
