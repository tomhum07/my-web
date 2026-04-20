# Frontend - Backend Integration Guide

Tài liệu này mô tả toàn bộ FE hiện tại của dự án CertiChain, để team BE có thể hiểu chính xác:

- FE có những màn hình nào
- Mỗi màn hình làm gì
- FE gửi/nhận dữ liệu theo format nào
- Những API BE cần khớp nếu muốn thay thế phần storage hiện tại bằng backend thật
- FE đang gọi smart contract ra sao
- Dữ liệu nào được băm, nhúng QR, lưu local, hoặc lấy từ blockchain

## 1. Tóm tắt kiến trúc

Dự án FE hiện tại là một ứng dụng Next.js 16 dùng App Router, React 19, TypeScript strict, Tailwind CSS 4 và ethers v6.

Frontend của dự án có 3 lớp nghiệp vụ chính:

1. Tạo/chỉnh sửa bằng cấp và xuất ảnh PNG.
2. Xác minh bằng cấp từ ảnh tải lên hoặc QR metadata.
3. Thu hồi bằng cấp trên blockchain.

Điểm quan trọng nhất với BE:

- Phần “phát hành” và “thu hồi” hiện chủ yếu đi qua smart contract, không phải qua REST API.
- Chỉ có một API route nội bộ hiện tại là `/api/certificates`, dùng để lưu metadata và image theo kiểu demo/local storage in-memory.
- Nếu BE muốn thay thế backend demo này bằng backend thật, cần giữ nguyên format dữ liệu mà FE đang gửi.

## 2. Cấu trúc route hiện tại

Các trang chính:

- `/` - Trang xác minh công khai bằng tải ảnh lên
- `/admin` - Dashboard tạo giấy khen / bằng tốt nghiệp / giấy chứng nhận
- `/commendation` - Trang tạo giấy khen
- `/certificate` - Trang xác minh công khai (route riêng, cùng component với `/`)
- `/revoke` - Trang thu hồi bằng
- `/fake-certificate` - Trang tạo bằng giả/test, hiện dùng chung UI với trang thật nhưng tắt blockchain
- `/api/certificates` - API lưu và truy vấn metadata certificate demo

Navbar hiện có các link chính:

- Home
- Admin Dashboard
- Thu hồi bằng
- Tạo bằng giả

## 3. Luồng dữ liệu tổng thể

### 3.1 Tạo bằng / phát hành

Trang admin dùng component `CommendationGenerator` để:

- người dùng nhập thông tin bằng
- tạo metadata certificate
- serialize metadata thành JSON
- băm JSON bằng SHA-256 để ra hash on-chain
- tạo QR chứa payload `CERT_META_V1:` + JSON metadata
- tạo ảnh preview bằng `html-to-image`
- nếu đang ở mode blockchain: gửi giao dịch issue lên contract
- nếu đang ở mode local-only (`/fake-certificate`): chỉ xuất PNG, không gọi blockchain
- sau khi phát hành, gửi multipart form data lên `/api/certificates`

### 3.2 Xác minh bằng

Trang home `/` và `/certificate` dùng `PublicCertificateVerifier` để:

- người dùng upload ảnh bằng cấp
- FE đọc QR từ ảnh bằng `jsqr`
- decode metadata JSON từ QR
- băm lại metadata JSON để lấy hash on-chain
- gọi smart contract `verifyCertificate(hash)`
- hiển thị kết quả hợp lệ / không hợp lệ / hết hạn

### 3.3 Thu hồi bằng

Trang `/revoke`:

- nhận input là hash metadata on-chain dạng `0x...`
- check MetaMask
- check ví hiện tại có phải owner của contract không
- gọi `revokeCertificate(hash)` trên smart contract
- lưu lịch sử thu hồi local để tiện theo dõi

### 3.4 Tạo bằng giả/test

Trang `/fake-certificate`:

- dùng chung UI với trang thật
- không kết nối blockchain
- không gửi backend
- chỉ cho nhập thông tin, xem trước và tải ảnh PNG

## 4. Dữ liệu certificate metadata

Metadata certificate đang được chuẩn hóa trong `utils/certificateMetadata.ts`.

### 4.1 Cấu trúc metadata

```ts
export type CertificateMetadata = {
  version: 1;
  documentType: "commendation" | "diploma" | "certificate";
  studentName: string;
  studentWalletAddress: string;
  issueDateIso: string;
  expirationTimestamp: number;
  certificateCode: string;
};
```

### 4.2 Cách serialize

FE không stringify trực tiếp object thô. Nó làm các bước sau:

- trim string
- giữ number/boolean nguyên bản
- lọc giá trị `undefined`/`null`
- sort key theo alphabet trước khi stringify

Điều này giúp hash ổn định giữa các lần tạo.

### 4.3 QR payload

QR không chứa hash on-chain trực tiếp. QR chứa:

```text
CERT_META_V1:{JSON metadata}
```

Vì vậy, nếu BE cần giải mã QR hoặc tái tạo hash, cần làm đúng prefix `CERT_META_V1:` và parse JSON phía sau.

### 4.4 Hash on-chain

Hash được tạo bằng SHA-256 của JSON metadata đã serialize:

- input: `metadataJson`
- output: chuỗi hex có prefix `0x`

Ví dụ hàm hiện tại:

- `serializeCertificateMetadata(metadata)` -> JSON string
- `hashMetadataJson(metadataJson)` -> `0x...`
- `encodeMetadataForQr(metadataJson)` -> `CERT_META_V1:{...}`
- `decodeMetadataFromQr(rawPayload)` -> JSON string

## 5. Smart contract interaction

FE đang nói chuyện với smart contract qua ethers v6.

### 5.1 Contract config

Cấu hình từ:

- `constants/address.ts`
- `constants/config.ts`
- `constants/abi.json`

FE hiện dùng Sepolia RPC.

### 5.2 Contract address

Địa chỉ contract được lấy từ `constants/address.ts` và re-export qua `constants/config.ts`.

### 5.3 ABI methods đang dùng

Từ ABI hiện tại, FE đang dùng các method sau:

- `issueCertificate(string _hash, address _studentWallet, uint256 _expirationDate)`
- `revokeCertificate(string _hash)`
- `verifyCertificate(string _hash) returns (bool, address, uint256, uint256)`
- `owner() returns (address)`

### 5.4 Ý nghĩa từng method

#### `issueCertificate`

FE gọi khi phát hành bằng thật từ trang admin.

Input:

- `_hash`: hash metadata dạng `0x...`
- `_studentWallet`: địa chỉ ví sinh viên
- `_expirationDate`: Unix timestamp giây

Lưu ý:

- Nếu chứng chỉ vĩnh viễn, FE truyền `0`
- FE chỉ gọi sau khi người dùng xác nhận MetaMask
- FE hiện không tự validate sâu ngoài kiểm tra wallet và thời hạn

#### `revokeCertificate`

FE gọi khi thu hồi bằng.

Input:

- `_hash`: hash metadata dạng `0x...`

Lưu ý:

- Đây không phải mã certificate như `CERT-...`
- FE đã validate format `0x` + 64 hex
- FE kiểm tra ví hiện tại có phải `owner()` của contract hay không trước khi gửi tx

#### `verifyCertificate`

FE gọi ở trang xác minh công khai.

Input:

- `_hash`: hash metadata lấy từ QR

Output:

- `bool isValid`
- `address studentWallet`
- `uint256 issueDate`
- `uint256 expirationDate`

FE dùng các giá trị này để hiển thị trạng thái hợp lệ / thu hồi / hết hạn.

#### `owner()`

FE gọi trong trang thu hồi để kiểm tra user có quyền thu hồi hay không.

### 5.5 Trạng thái blockchain hiện tại

- Trang tạo thật: có blockchain
- Trang fake: không có blockchain
- Trang revoke: có blockchain
- Trang verify: đọc QR + verify on-chain

## 6. API backend hiện có

Hiện tại FE chỉ có một API route nội bộ là `/api/certificates`.

### 6.1 `POST /api/certificates`

Mục đích:

- lưu metadata và ảnh của certificate sau khi phát hành
- hiện chỉ là demo in-memory, không persistent

Request:

- `multipart/form-data`

Fields:

- `image` - File ảnh PNG/JPG/...; bắt buộc
- `studentName` - string; bắt buộc
- `studentWalletAddress` - string; bắt buộc
- `imageHash` - string; bắt buộc, chính là hash metadata dạng `0x...`
- `metadataJson` - string; optional
- `documentType` - string; bắt buộc theo union `commendation | diploma | certificate`
- `expirationTimestamp` - number/string parse được sang number; bắt buộc

Validation hiện tại ở FE/API:

- phải có `image`
- phải có `studentName`
- phải có `studentWalletAddress`
- phải có `imageHash`
- file phải là image MIME type

Response success:

```json
{
  "success": true,
  "message": "Certificate saved successfully",
  "imageHash": "0x...",
  "studentName": "Nguyen Van A"
}
```

Status code: `201`

Response error:

- `400` với message như `Missing required fields` hoặc `Uploaded file must be an image`
- `500` nếu có lỗi xử lý

### 6.2 `GET /api/certificates?hash=...`

Mục đích:

- tra cứu certificate theo `imageHash`/metadata hash

Query params:

- `hash` - bắt buộc

Response success:

- trả về object certificate đã lưu trong memory

Response error:

- `400` nếu thiếu `hash`
- `404` nếu không tìm thấy certificate
- `500` nếu có lỗi server

### 6.3 Lưu ý quan trọng cho BE

Hiện API này lưu trong `Map` ở memory:

- không bền
- sẽ mất khi restart server
- không phù hợp production trên Vercel serverless nếu không thay bằng DB/KV

Nếu BE muốn thay thế, nên giữ lại shape request/response tương tự để FE không phải sửa nhiều.

## 7. Dữ liệu FE đang gửi lên backend khi phát hành

Khi phát hành bằng thật, FE gửi lên backend sau khi render PNG thành công.

Payload `FormData` hiện có:

- `image`: file ảnh đã chụp từ preview
- `studentName`: tên sinh viên
- `studentWalletAddress`: ví sinh viên
- `imageHash`: hash metadata on-chain
- `documentType`: loại giấy tờ
- `expirationTimestamp`: Unix timestamp
- `metadataJson`: JSON metadata đã serialize

Nếu BE viết API mới, nên ưu tiên xử lý các field này.

## 8. Luồng xác minh công khai chi tiết

Trang verify hiện làm theo thứ tự:

1. Người dùng upload ảnh bằng cấp.
2. FE kiểm tra file có phải image không.
3. FE đọc QR trong ảnh bằng `jsqr`.
4. FE kiểm tra QR có prefix `CERT_META_V1:` không.
5. FE parse JSON metadata.
6. FE băm JSON metadata để ra hash on-chain.
7. FE gọi `verifyCertificate(hash)` trên smart contract.
8. FE đọc kết quả:
   - `isValid` false -> đã thu hồi
   - `issueDate`/`expirationDate` để hiển thị
   - `expirationDate` nhỏ hơn hiện tại -> hết hạn
9. FE hiển thị trạng thái và metadata tóm tắt.

### 8.1 Những gì BE cần biết

BE không phải là nguồn chân lý cho verify trong luồng hiện tại. Nguồn chân lý là blockchain.

Nếu BE muốn làm API phụ trợ cho verify, BE cần đảm bảo:

- hash metadata phải trùng chính xác với FE
- metadata JSON phải được serialize theo đúng quy tắc sort key + trim string
- dữ liệu trả về phải tương thích với output của contract

## 9. Luồng tạo bằng thật chi tiết

Trang admin hiện có các bước:

1. Người dùng nhập dữ liệu form.
2. FE build metadata JSON.
3. FE hash metadata JSON.
4. FE tạo QR metadata.
5. FE render preview thành PNG.
6. FE gọi MetaMask.
7. FE gửi tx `issueCertificate(hash, studentWallet, expirationDate)`.
8. FE chờ xác nhận tx.
9. FE gửi `FormData` lên `/api/certificates`.
10. Nếu API lưu thành công, FE báo hoàn tất.

### 9.1 Điểm cần khớp giữa FE và BE

Nếu BE thay API hiện tại, cần khớp:

- `imageHash` phải là chính hash đã đưa lên chain
- `metadataJson` phải có thể decode lại được
- `expirationTimestamp` phải là số giây Unix
- `documentType` phải nằm trong 3 giá trị hợp lệ

## 10. Luồng thu hồi bằng chi tiết

Trang revoke hiện có đặc điểm:

- input bắt buộc là hash metadata dạng `0x...`
- FE không chấp nhận `CERT-...`
- FE kiểm tra `window.ethereum`
- FE kết nối MetaMask
- FE đọc `owner()` từ contract
- nếu ví hiện tại không phải owner, FE dừng
- nếu hợp lệ, gọi `revokeCertificate(hash)`

Lịch sử thu hồi hiển thị ở trang này chỉ là local storage.

### 10.1 Ý nghĩa với BE

BE không tham gia revoke flow hiện tại, nhưng nếu muốn đồng bộ trạng thái thu hồi, BE nên nghe event:

- `CertificateRevoked(string certHash)`

và đồng bộ trạng thái certificate trong DB.

## 11. Trang tạo bằng giả `/fake-certificate`

Trang này hiện được build bằng cách tái sử dụng đúng component tạo bằng thật, nhưng với chế độ local-only.

Ý nghĩa:

- giao diện gần như y hệt trang thật
- không gọi blockchain
- không gọi backend
- chỉ cho nhập thông tin, xem trước và tải PNG

BE không cần hỗ trợ gì thêm cho trang này.

## 12. Local storage hiện đang dùng ở đâu

### 12.1 Trang revoke

- lưu danh sách thu hồi nội bộ
- key: `certichain.revoked-certificates`
- chỉ phục vụ hiển thị trong UI

### 12.2 Không dùng localStorage cho dữ liệu nghiệp vụ chính

- không nên xem localStorage là nguồn dữ liệu chuẩn
- dữ liệu thật vẫn phải nằm trên chain hoặc backend DB

## 13. Environment variables

FE hiện chỉ cần một biến public chính:

- `NEXT_PUBLIC_SEPOLIA_RPC_URL`

Nếu không set, FE sẽ fallback sang RPC public Sepolia.

BE nếu tích hợp sâu hơn có thể cần thêm:

- RPC riêng
- contract address theo môi trường
- DB connection string nếu thay API demo

## 14. Scripts chạy dự án

Từ `package.json`:

- `npm run dev` - chạy dev server
- `npm run build` - build production
- `npm run start` - chạy production server
- `npm run lint` - lint source

## 15. File quan trọng theo chức năng

### 15.1 Entry routes

- [app/page.tsx](app/page.tsx) - trang verify công khai
- [app/admin/page.tsx](app/admin/page.tsx) - trang phát hành bằng
- [app/commendation/page.tsx](app/commendation/page.tsx) - route riêng của phát hành
- [app/revoke/page.tsx](app/revoke/page.tsx) - thu hồi bằng
- [app/fake-certificate/page.tsx](app/fake-certificate/page.tsx) - fake/local-only issuance

### 15.2 Component chính

- [components/PublicCertificateVerifier.tsx](components/PublicCertificateVerifier.tsx) - đọc QR, verify on-chain
- [components/CommendationGenerator.tsx](components/CommendationGenerator.tsx) - form phát hành + preview + xuất PNG
- [components/Navbar.tsx](components/Navbar.tsx) - điều hướng

### 15.3 Blockchain/config

- [constants/abi.json](constants/abi.json) - ABI contract
- [constants/address.ts](constants/address.ts) - địa chỉ contract
- [constants/config.ts](constants/config.ts) - contract + RPC config
- [hooks/useWeb3.ts](hooks/useWeb3.ts) - connect wallet helper
- [hooks/useIssueCertificate.ts](hooks/useIssueCertificate.ts) - hook issue certificate

### 15.4 Metadata/API helpers

- [utils/certificateMetadata.ts](utils/certificateMetadata.ts) - serialize/hash/QR encode/decode
- [app/api/certificates/route.ts](app/api/certificates/route.ts) - API lưu và truy vấn demo

## 16. Những điểm BE cần đặc biệt khớp chính xác

### 16.1 Hash metadata

Hash chứng chỉ phải được tính từ JSON metadata đã serialize theo đúng cách FE đang làm.

Nếu BE tự tính hash thì phải giữ:

- trim string
- sort key theo alphabet
- JSON stringify từ object đã chuẩn hóa

### 16.2 QR prefix

Nếu BE cần đọc QR hoặc sinh QR tương thích FE, phải dùng prefix:

```text
CERT_META_V1:
```

### 16.3 Input revoke

Trang revoke hiện yêu cầu:

- `0x` + 64 ký tự hex

Không phải:

- mã certificate `CERT-...`
- không phải tên sinh viên
- không phải QR raw text

### 16.4 Upload backend

Nếu BE thay API upload:

- vẫn nên nhận `multipart/form-data`
- vẫn nên đọc các field: `image`, `studentName`, `studentWalletAddress`, `imageHash`, `documentType`, `expirationTimestamp`, `metadataJson`

## 17. Ghi chú production

`app/api/certificates/route.ts` hiện chỉ là backend demo.

Để production thật:

- thay in-memory `Map` bằng DB/KV
- lưu thêm trạng thái on-chain nếu cần
- có thể bổ sung API tra cứu theo hash, theo ví sinh viên, theo mã bằng
- nếu muốn audit, nên lưu event log từ blockchain

## 18. Kết luận cho team BE

Nếu BE chỉ cần hỗ trợ tối thiểu cho FE hiện tại thì cần:

1. Giữ endpoint `POST /api/certificates` với multipart form data như mô tả trên.
2. Giữ endpoint `GET /api/certificates?hash=...` nếu muốn tra cứu demo.
3. Nếu muốn đồng bộ production, thêm DB và mapping theo `imageHash`.
4. Nếu muốn validate với blockchain, dùng event `CertificateIssued` và `CertificateRevoked`.
5. Không thay đổi cách FE hash metadata nếu chưa sửa đồng bộ cả hai phía.

Nếu cần, mình có thể viết tiếp một file riêng dạng **API spec cho BE** với bảng request/response chuẩn hơn, hoặc một **sequence diagram** cho 3 luồng: phát hành, verify, revoke.
