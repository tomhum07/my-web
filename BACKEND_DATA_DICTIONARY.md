# CertiChain - Backend Data Dictionary

Tài liệu này liệt kê toàn bộ kiểu dữ liệu và các nhóm dữ liệu mà Frontend hiện đang dùng, để team Backend có thể map đúng field, kiểu dữ liệu, validation và API contract.

## 1. Mục tiêu

Frontend của dự án hiện xử lý 3 nghiệp vụ chính:

- Phát hành bằng cấp / giấy khen / giấy chứng nhận
- Xác minh bằng cấp từ ảnh QR
- Thu hồi bằng cấp theo hash metadata trên blockchain

Tài liệu này tập trung vào dữ liệu đầu vào/đầu ra mà BE cần hiểu để:

- thiết kế API đúng format
- lưu trữ đúng schema
- validate đúng kiểu dữ liệu
- đồng bộ với dữ liệu đang được FE băm, đóng QR và gửi lên blockchain

## 2. Kiểu dữ liệu cấp cao

### 2.1 `DocumentType`

Kiểu dữ liệu dùng để phân loại loại giấy tờ.

| Value | Ý nghĩa | Hiển thị trên UI |
|---|---|---|
| `commendation` | Giấy khen | Giấy khen |
| `certificate` | Giấy chứng nhận | Giấy chứng nhận |
| `diploma` | Bằng tốt nghiệp | Bằng tốt nghiệp |

Đây là một enum string.

### 2.2 `DiplomaType`

Chỉ áp dụng cho giấy tốt nghiệp.

| Value | Ý nghĩa |
|---|---|
| `bachelor` | Bằng cử nhân |
| `engineer` | Bằng kỹ sư |
| `doctor` | Bằng tiến sĩ |
| `master` | Bằng thạc sĩ |

### 2.3 `CertificateMetadata`

Đây là object metadata FE đang chuẩn hóa, băm SHA-256 và nhúng vào QR.

```ts
{
  version: 1,
  documentType: "commendation" | "certificate" | "diploma",
  studentName: string,
  studentWalletAddress: string,
  issueDateIso: string,
  expirationTimestamp: number,
  certificateCode: string
}
```

## 3. Danh sách field dữ liệu chính

### 3.1 Thông tin giấy tờ

| Field | Kiểu | Bắt buộc | Ví dụ | Mô tả |
|---|---|---:|---|---|
| `documentType` | string enum | Có | `commendation` | Loại giấy tờ |
| `certificateCode` | string | Có | `CERT-MO6WUGOU-2EUHN6` | Mã chứng chỉ hiển thị cho người dùng |
| `issueDateIso` | string | Có | `2026-04-20` | Ngày cấp dạng ISO `YYYY-MM-DD` |
| `expirationTimestamp` | number | Có | `1776643200` | Unix timestamp giây. `0` nghĩa là không giới hạn |

### 3.2 Thông tin người nhận

| Field | Kiểu | Bắt buộc | Ví dụ | Mô tả |
|---|---|---:|---|---|
| `studentName` | string | Có | `Nguyễn Văn A` | Tên người được cấp |
| `studentWalletAddress` | string | Có | `0x9feb3E98D66522881F285392a6039d7827043eEF` | Địa chỉ ví blockchain của người nhận |
| `studentGenderLabel` | string | Không | `Ông` | Danh xưng hiển thị, chủ yếu dùng ở trang tạo bằng |
| `studentClass` | string | Không | `ĐHCNTT23A-CS` | Lớp |
| `faculty` | string | Không | `Công nghệ và Kỹ thuật` | Khoa / ngành |
| `major` | string | Không | `Khoa học máy tính - Công nghệ phần mềm` | Chuyên ngành, dùng cho bằng tốt nghiệp |
| `dateOfBirth` | string | Không | `2004-02-22` | Ngày sinh dạng ISO |
| `graduationYear` | string | Không | `2028` | Năm tốt nghiệp |
| `graduationRank` | string | Không | `Xuất sắc` | Xếp loại |
| `location` | string | Không | `Đồng Tháp` | Địa điểm ký ban hành |
| `content` | string | Không | `Sinh viên xuất sắc - Năm học 2024-2025` | Nội dung mô tả chính của giấy tờ |

## 4. Kiểu dữ liệu trong QR

### 4.1 Prefix QR

QR hiện không chứa hash trực tiếp. QR chứa payload có prefix:

```text
CERT_META_V1:
```

Phần sau prefix là JSON metadata.

### 4.2 Payload QR thực tế

Ví dụ:

```text
CERT_META_V1:{"certificateCode":"CERT-...","documentType":"commendation",...}
```

### 4.3 Quy tắc parse

BE nếu cần đọc QR phải làm theo thứ tự:

1. Kiểm tra prefix `CERT_META_V1:`
2. Lấy phần JSON phía sau
3. Parse JSON
4. Validate schema
5. Nếu cần, tính lại SHA-256 để so khớp với blockchain

## 5. Kiểu dữ liệu hash

### 5.1 Metadata hash

FE băm JSON metadata đã serialize bằng SHA-256.

| Field | Kiểu | Ví dụ | Mô tả |
|---|---|---|---|
| `metadataHash` | string | `0x6c1d...` | Hash dùng trên blockchain |

Đặc điểm:

- luôn có prefix `0x`
- 64 ký tự hex phía sau
- là input chính cho các hàm `issueCertificate`, `verifyCertificate`, `revokeCertificate`

### 5.2 Quy tắc ổn định hash

Trước khi băm, FE:

- trim các string
- bỏ giá trị `undefined` / `null`
- sort key theo alphabet
- stringify JSON sau khi normalize

Nếu BE muốn tái tạo hash phải giữ đúng cách này.

## 6. Kiểu dữ liệu blockchain

### 6.1 Input vào contract `issueCertificate`

```ts
issueCertificate(
  hash: string,
  studentWallet: string,
  expirationTimestamp: number
)
```

| Field | Kiểu | Ví dụ | Ghi chú |
|---|---|---|---|
| `hash` | string | `0x...` | Hash metadata |
| `studentWallet` | string | `0x9feb...` | Địa chỉ ví người nhận |
| `expirationTimestamp` | number | `0` hoặc Unix timestamp | `0` nghĩa là vĩnh viễn |

### 6.2 Input vào contract `verifyCertificate`

```ts
verifyCertificate(hash: string)
```

Output:

| Trả về | Kiểu | Ý nghĩa |
|---|---|---|
| `isValid` | boolean | `true` nếu bằng còn hiệu lực và chưa bị thu hồi |
| `studentWallet` | address | Ví sinh viên |
| `issueDate` | uint256 | Unix timestamp lúc cấp |
| `expirationDate` | uint256 | Unix timestamp hết hạn |

### 6.3 Input vào contract `revokeCertificate`

```ts
revokeCertificate(hash: string)
```

| Field | Kiểu | Ví dụ | Ghi chú |
|---|---|---|---|
| `hash` | string | `0x...` | Phải là metadata hash, không phải mã `CERT-...` |

### 6.4 Hàm `owner()`

BE không cần truyền input.

Output là address owner của hợp đồng.

## 7. API backend hiện có

Hiện FE có 1 API demo nội bộ:

### 7.1 `POST /api/certificates`

Request dạng `multipart/form-data`.

| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---:|---|
| `image` | File | Có | Ảnh PNG/JPG/... đã render từ preview |
| `studentName` | string | Có | Tên sinh viên |
| `studentWalletAddress` | string | Có | Ví sinh viên |
| `imageHash` | string | Có | Metadata hash dùng làm key |
| `documentType` | string enum | Có | `commendation` / `certificate` / `diploma` |
| `expirationTimestamp` | number string | Có | Unix timestamp giây |
| `metadataJson` | string | Không | JSON metadata đã serialize |

Response success:

```json
{
  "success": true,
  "message": "Certificate saved successfully",
  "imageHash": "0x...",
  "studentName": "Nguyễn Văn A"
}
```

Response error phổ biến:

- `400 Missing required fields`
- `400 Uploaded file must be an image`
- `500 Failed to process certificate: ...`

### 7.2 `GET /api/certificates?hash=...`

Query:

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---:|---|
| `hash` | string | Có | Metadata hash |

Response success trả về object đã lưu trong store demo.

Response error phổ biến:

- `400 Hash parameter required`
- `404 Certificate not found`

## 8. Kiểu dữ liệu lưu trữ demo ở FE

API demo hiện lưu trong memory `Map<string, CertificateData>`.

### 8.1 `CertificateData`

```ts
{
  studentName: string,
  studentWalletAddress: string,
  imageHash: string,
  metadataJson?: string,
  documentType: "commendation" | "diploma" | "certificate",
  expirationTimestamp: number
}
```

### 8.2 Lưu ý quan trọng

- Đây không phải persistent storage
- Mất dữ liệu khi restart server
- Không phù hợp production trên Vercel serverless
- BE nên thay bằng database thật nếu muốn dữ liệu bền

## 9. Kiểu dữ liệu trong trang revoke

Trang revoke dùng các field sau:

| Field | Kiểu | Ví dụ | Mô tả |
|---|---|---|---|
| `certificateId` | string | `0x...` | Hash metadata cần thu hồi |
| `reason` | string | `Không đạt điều kiện xác thực nội bộ` | Lý do thu hồi |

Local history:

| Field | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Hash đã thu hồi |
| `reason` | string | Lý do |
| `revokedAt` | string ISO | Thời điểm ghi nhận local |
| `txHash` | string | Tx hash blockchain |
| `revokedBy` | string | Địa chỉ ví owner đã thu hồi |

## 10. Kiểu dữ liệu hiển thị kết quả verify

Trang verify có các trạng thái:

- `idle`
- `loading`
- `success`
- `warning`
- `error`

### 10.1 `success` / `warning`

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `studentWallet` | string | Ví sinh viên đọc từ chain |
| `issueDateText` | string | Ngày cấp đã format |
| `expirationDateText` | string | Hạn sử dụng đã format |
| `metadataSummary` | string | Tóm tắt từ QR: sinh viên, loại, mã |

### 10.2 `error`

Chỉ cần message hiển thị lỗi.

## 11. Các kiểu dữ liệu liên quan UI nhưng ảnh hưởng logic

### 11.1 Ngày tháng

FE dùng 2 dạng:

- `YYYY-MM-DD` cho input date
- `DD/MM/YYYY` hoặc text tiếng Việt cho hiển thị

### 11.2 Hạn sử dụng

- `0` = không giới hạn
- khác `0` = Unix timestamp giây

### 11.3 Địa chỉ ví

- format chuẩn Ethereum address
- trong FE có chỗ validate bằng `ethers.isAddress`

## 12. Mapping dữ liệu cho BE

Nếu BE cần chuẩn bị schema DB, có thể map như sau:

### 12.1 Bảng/collection `certificates`

| Cột | Kiểu gợi ý | Nguồn FE |
|---|---|---|
| `id` | string / UUID | nội bộ BE |
| `metadata_hash` | string unique | `imageHash` / `metadataHash` |
| `student_name` | string | `studentName` |
| `student_wallet` | string | `studentWalletAddress` |
| `document_type` | string enum | `documentType` |
| `issue_date_iso` | date/string | `issueDateIso` |
| `expiration_timestamp` | bigint/int | `expirationTimestamp` |
| `certificate_code` | string | `certificateCode` |
| `metadata_json` | json/text | `metadataJson` |
| `image_url` | string | file upload result |
| `status` | string enum | issued / revoked / expired |
| `tx_hash_issue` | string | tx issue on-chain |
| `tx_hash_revoke` | string | tx revoke on-chain |
| `revoked_at` | timestamp nullable | nếu bị thu hồi |

## 13. Những điểm BE cần khớp để FE không lỗi

### 13.1 Hash phải khớp tuyệt đối

Nếu BE tự tính hash hay regenerate metadata JSON, phải đảm bảo:

- đúng thứ tự key
- đúng trim string
- đúng prefix QR
- đúng SHA-256

### 13.2 `documentType` chỉ có 3 giá trị

- `commendation`
- `certificate`
- `diploma`

### 13.3 `diplomaType` chỉ có 4 giá trị

- `bachelor`
- `engineer`
- `doctor`
- `master`

### 13.4 Thu hồi dùng hash, không dùng mã chứng chỉ

Đây là lỗi dễ gặp nhất.

- Đúng: `0x...`
- Sai: `CERT-...`

## 14. Danh sách dữ liệu quan trọng nhất cho BE

Nếu BE chỉ muốn nắm phần cần thiết nhất, hãy ưu tiên 6 field sau:

1. `documentType`
2. `studentName`
3. `studentWalletAddress`
4. `issueDateIso`
5. `expirationTimestamp`
6. `certificateCode`

Và 1 giá trị dẫn xuất quan trọng:

- `metadataHash` = SHA-256 của JSON metadata đã normalize

## 15. Kết luận

Frontend hiện tại xoay quanh 3 lớp dữ liệu chính:

- dữ liệu form nhập tay
- metadata chuẩn hóa để tạo QR và hash
- dữ liệu blockchain / API để phát hành, verify, revoke

Nếu BE muốn tích hợp chính xác, chỉ cần giữ đúng các kiểu dữ liệu và format trong tài liệu này là FE có thể kết nối trơn tru.

Nếu cần, mình có thể viết tiếp một file thứ hai dạng **API contract chi tiết cho BE** với bảng `request -> response -> validation -> error codes` để backend implement trực tiếp.
