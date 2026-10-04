# Arcana · Tarot AI

Website Tarot bằng Next.js App Router, TypeScript, Tailwind CSS và GSAP. Giao diện tiếng Việt, responsive; đủ dữ liệu 78 lá, chọn bài từ bộ xáo bằng Web Crypto, không trùng lá trong cùng lượt, hỗ trợ xuôi/ngược.

## Chạy project

Yêu cầu Node.js 22.18 trở lên (đã kiểm tra với Node.js 24.14).

```powershell
npm install
npm install @cometpisces/tarot-kit-images
npm run verify:artwork
npm run dev
```

Mở http://127.0.0.1:3000 khi chạy development. `npm run build` tạo bản production; `npm run start` chạy bản đã build tại http://127.0.0.1:2222 để tránh trùng cổng development.

## Artwork Rider–Waite

Package bắt buộc: `@cometpisces/tarot-kit-images@0.2.0`.

- API mapping: `getImagePath(id)`, `hasImage(id)`, `getAllImagePaths()`, `imageMap`.
- File nguồn: `node_modules/@cometpisces/tarot-kit-images/images/*.png`.
- `scripts/prepare-images.mjs` dùng API thật của package để copy artwork nguyên bản vào `public/tarot` và ghi `src/data/image-manifest.json`.
- 78 ID được kiểm tra đầy đủ; filename không đoán từ thứ tự bộ bài. Package là nguồn mapping quyết định khi đã cài.
- `npm run verify:artwork` kiểm tra đúng ID/path, chữ ký PNG, kích thước, SHA-256 duy nhất cho 78 lá và file copy giống byte gốc. In kết quả riêng cho The Fool, The Magician, Ace of Cups, Death và The World.
- Package không cung cấp card-back. Website dùng cùng một component `CardBack` cho mọi lá úp; chỉ mặt sau có họa tiết CSS/icon.
- Mặt trước chỉ là ảnh PNG Rider–Waite. Không tạo SVG, icon, CSS illustration hay ảnh placeholder cho mặt trước. GSAP kết thúc animation lật mới gắn ảnh mặt trước vào DOM; ảnh được preload riêng, lỗi tải hiện thông báo và có thể thử lại.

Trong phiên triển khai, sandbox chặn npm registry bằng `EACCES`, nên package ảnh chưa cài được. Khi chưa có package, website tham chiếu trực tiếp file PNG của chính version package trên jsDelivr (`https://cdn.jsdelivr.net/npm/@cometpisces/tarot-kit-images@0.2.0/images/…`), dựa trên quy ước filename trong README package. Đây là đường dẫn tới artwork thật, không phải ảnh tự vẽ. Tuy nhiên **mapping API thực tế và artwork chưa được xác minh tại máy khi package chưa cài; CDN cũng bị chặn trong trình duyệt kiểm tra**. `verify:artwork` cố ý báo lỗi trong trạng thái này. Khi có mạng, `npm install` tự chạy bước chuẩn bị để chuyển tất cả ảnh sang nội bộ. Không coi build thành công hay kiểm tra filename là bằng chứng artwork tải thành công.

Mapping cần kiểm tra:

| ID | Filename theo tài liệu |
| --- | --- |
| `the-fool` | `00-TheFool.png` |
| `the-magician` | `01-TheMagician.png` |
| `ace-of-cups` | `Cups01.png` |
| `death` | `13-Death.png` |
| `the-world` | `21-TheWorld.png` |

Tài liệu package: https://www.npmjs.com/package/@cometpisces/tarot-kit-images

## Ủng hộ Arcana

Nút “Ủng hộ” nằm trên thanh đầu trang ở mọi tab. Nhấn nút để mở hộp thoại chứa QR và tài khoản MB `0372204152`. Người dùng có thể sao chép số tài khoản hoặc tải ảnh QR để quét từ thư viện ảnh trong ứng dụng ngân hàng. Người chuyển tự chọn số tiền; nội dung chuyển khoản là `Ung ho Arcana`.

Ảnh cố định nằm tại `public/donate/mb-0372204152.png`, được tạo qua [VietQR Quick Link](https://www.vietqr.io/en/danh-sach-api/link-tao-ma-nhanh/) với URL `https://img.vietqr.io/image/MB-0372204152-qr_only.png?addInfo=Ung%20ho%20Arcana`, sau đó chuyển sang PNG. Giao diện tải ảnh từ dự án, không gọi VietQR khi khách mở trang. Khi đổi tài khoản, cần cập nhật cả ảnh và thông tin trong `src/components/donation-panel.tsx`.

## Kết nối AI

Sao chép `.env.example` thành `.env` nếu chưa có file cấu hình; giữ nguyên cấu hình riêng nếu đã có. Điền `OPENAI_API_KEY`, chọn `OPENAI_MODEL` được tài khoản hỗ trợ. Mặc định `gpt-4o-mini`. `OPENAI_BASE_URL` mặc định `https://api.openai.com/v1`; endpoint tùy chỉnh phải hỗ trợ Responses API và Structured Outputs. Khởi động lại server sau khi sửa môi trường.

Các biến này chỉ được đọc trong `src/services/ai.ts`, được gọi bởi API route server; không dùng tiền tố `NEXT_PUBLIC_`. File `.env` đã được ignore. Không nhập khóa vào giao diện.

Luồng dữ liệu:

1. Người dùng nhập tên, ngày sinh, câu hỏi/chủ đề và loại trải bài.
2. Bộ 78 ID được xáo bằng Fisher–Yates với Web Crypto và rejection sampling. Người dùng chọn lá; orientation được chọn độc lập nếu bật lá ngược.
3. Frontend gửi profile, câu hỏi, spread, các ID/chiều/vị trí và dữ liệu mỗi lá tới `POST /api/reading`.
4. Server kiểm tra ngày sinh, câu hỏi, ID, số lá, không trùng lá và vị trí. Dữ liệu ý nghĩa do client gửi bị bỏ qua; server lấy lại dữ liệu chuẩn theo ID.
5. Prompt phân tách ngữ cảnh người dùng khỏi chỉ dẫn, dùng đúng nghĩa theo chiều, cấm đổi bài, thêm bài và phần trăm giả. Tên/ngày sinh không được dùng để suy diễn định mệnh.
6. Responses API dùng JSON Schema strict. Server kiểm tra lại ID/chiều/thứ tự/vị trí; từ chối tên lá thêm trong nội dung hoặc tỷ lệ phần trăm phát hiện được. Đây là các kiểm tra cấu trúc và một số mẫu văn bản, không phải chứng minh mọi phát biểu AI đều đúng.
7. Kết quả có tổng quan, từng lá, liên kết, chủ đề phù hợp và lời khuyên. Không có khóa hiển thị lỗi rõ; người dùng có thể chọn bản tra cứu được gắn nhãn riêng. Thử lại giữ nguyên trải bài. Tín hiệu hủy request được truyền tới lời gọi provider; dữ liệu lịch sử chỉ nhận kết quả đúng ID/chiều/vị trí và nguồn diễn giải hợp lệ.

API không lưu hội thoại ở provider (`store: false`). Profile, câu hỏi và ngày sinh vẫn được gửi tới provider khi người dùng chọn phân tích; không được coi đây là dữ liệu chỉ lưu trên thiết bị.

## Lịch sử và dữ liệu

`localStorage`: `arcana:profile:v1`, `arcana:history:v1`. Profile tự điền lại sau reload. Tối đa 30 trải bài hoàn chỉnh, lưu ngay khi chọn đủ số lá, cập nhật khi diễn giải thành công. Dữ liệu không hợp lệ bị bỏ qua khi đọc. Có xóa từng lượt, xóa nhật ký và xóa toàn bộ profile/lịch sử; thao tác xóa toàn bộ có xác nhận. Bộ nhớ bị chặn hoặc đầy có thông báo.

## Cấu trúc

```text
src/app/                    Trang, stylesheet và API route
src/components/             Form, deck, flip card, dialog, thư viện, nhật ký
src/data/card-seeds.ts       Nghĩa riêng biệt của 22 + 56 lá
src/data/tarot.ts            78 object TarotCard đầy đủ trường
src/data/spreads.ts          4 kiểu trải bài và vị trí
src/data/rider-waite-images.ts  Filename tài liệu và URL package
src/data/image-manifest.json   Mapping ảnh được chuẩn bị từ package
src/lib/ai-prompt.ts         System prompt và JSON Schema
src/lib/validation.ts       Validation đầu vào, kết quả và lịch sử
src/services/               Draw, localStorage, AI server và AI client
scripts/                    Chuẩn bị/kiểm tra artwork, test loader
tests/                      Unit/API tests và Playwright desktop/mobile
```

## Kiểm tra

```powershell
npm run typecheck
npm test
npm run test:e2e
npm run verify:artwork
npm run test:artwork
npm run build
```

Playwright dùng Chromium; nếu máy chưa có, cài với `npx playwright install chromium`. Các unit/API test giả lập provider để kiểm tra request, schema, từ chối và xử lý lỗi; không tiêu phí AI. E2E không giả lập artwork, ghi chú rõ khi môi trường không tải được ảnh; kiểm tra artwork riêng sẽ không qua nếu package chưa được cài. `test:artwork` bắt buộc package và 78 PNG nội bộ hợp lệ, kiểm tra HTTP của toàn bộ ảnh, browser decode năm lá mẫu, phóng to và thời điểm hiển thị mặt trước sau GSAP. Bộ này không bỏ qua lỗi ảnh và không dùng ảnh test thay thế. Luồng API thật cần khóa hợp lệ và kết nối provider, chưa được xác minh trong môi trường không có mạng.

Ảnh được hiển thị với `object-fit: contain` để giữ đủ mép artwork. Lỗi tải ảnh có thông báo; cửa sổ chi tiết và các lá đã lật có nút thử tải lại đúng URL của chính lá đó. Người dùng vẫn có thể mở ý nghĩa chuẩn khi ảnh chưa tải được. Tìm kiếm hỗ trợ tiếng Việt có dấu hoặc không dấu, kể cả chữ Đ viết hoa.

Lần cài bị chặn đã tạo lockfile không đầy đủ với alias lỗi cho package ảnh, nên file đó được loại bỏ. `npm install` thành công khi có mạng sẽ tạo lại `package-lock.json`; không nên dùng `npm ci` trước bước này.

Trước khi mở API công khai, cần bổ sung giới hạn lượt gọi/xác thực phù hợp nền tảng hosting và ngân sách. Project hiện chạy cục bộ, chưa có rate limiter phân tán hoặc tài khoản người dùng.
