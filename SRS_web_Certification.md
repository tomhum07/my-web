# ĐẶC TẢ PHẦN MỀM HỆ THỐNG CẤP VÀ XÁC MINH CHỨNG CHỈ BLOCKCHAIN

## 1. Giới thiệu

### 1.1 Mục đích
Tài liệu này mô tả đầy đủ các yêu cầu của hệ thống CertiChain Web App, nhằm làm cơ sở cho việc phân tích, thiết kế, lập trình, cài đặt, kiểm thử và bảo trì hệ thống cấp, xác minh và thu hồi chứng chỉ dựa trên blockchain.

### 1.2 Phạm vi hệ thống
Phần mềm hỗ trợ quản lý nghiệp vụ phát hành giấy khen/giấy chứng nhận/bằng tốt nghiệp, xác minh chứng chỉ công khai bằng QR metadata, thu hồi chứng chỉ trên blockchain và lưu trữ thông tin chứng chỉ qua API nội bộ hoặc backend tích hợp.

### 1.3 Đối tượng sử dụng tài liệu
- Nhóm phát triển phần mềm
- Quản trị viên hệ thống/nhà trường
- Nhóm backend tích hợp dữ liệu

### 1.4 Định nghĩa, từ viết tắt
- SRS: Software Requirements Specification
- FR: Functional Requirement
- NFR: Non-functional Requirement
- BR: Business Rule
- QR: Quick Response

## 2. Mô tả tổng quan

### 2.1 Góc nhìn sản phẩm
Hệ thống là một ứng dụng web chạy trên Next.js, cho phép tạo chứng chỉ có QR metadata, băm dữ liệu để phát hành on-chain, xác minh trạng thái chứng chỉ từ blockchain và thu hồi chứng chỉ bởi tài khoản owner smart contract.

### 2.2 Các nhóm người dùng
- Quản trị viên: tạo chứng chỉ, phát hành blockchain, thu hồi chứng chỉ.
- Người dùng công khai: tải ảnh chứng chỉ để xác minh.
- Nhóm kỹ thuật backend: cung cấp API lưu trữ bền vững thay cho in-memory store.

### 2.3 Giả định và ràng buộc
- Người dùng quản trị có ví MetaMask để ký giao dịch blockchain.
- Hệ thống hoạt động trên trình duyệt web hiện đại.
- Kết nối RPC Sepolia sẵn sàng khi xác minh hoặc phát hành.
- Mặc định dữ liệu API nội bộ có thể lưu in-memory nếu chưa cấu hình backend ngoài.

## 3. Yêu cầu chức năng (Functional Requirements)

### FR-01: Tạo và phát hành chứng chỉ
Hệ thống phải cho phép quản trị viên nhập thông tin chứng chỉ, sinh metadata chuẩn hóa, tạo hash SHA-256 và gọi smart contract để phát hành chứng chỉ khi bật chế độ blockchain.

### FR-02: Xuất ảnh chứng chỉ
Hệ thống phải cho phép tạo ảnh chứng chỉ định dạng PNG từ mẫu thiết kế, nhúng QR metadata và tải ảnh về máy người dùng.

### FR-03: Lưu thông tin chứng chỉ qua API
Hệ thống phải cho phép gửi dữ liệu chứng chỉ (bao gồm ảnh và metadata liên quan) lên API certificates để lưu trữ, tra cứu và phục vụ quản trị.

### FR-04: Xác minh chứng chỉ từ ảnh
Hệ thống phải cho phép người dùng tải ảnh chứng chỉ, đọc QR metadata, tái tạo hash và kiểm tra tính hợp lệ bằng hàm verifyCertificate trên blockchain.

### FR-05: Hiển thị trạng thái xác minh
Hệ thống phải hiển thị rõ các trạng thái xác minh gồm hợp lệ, hết hạn, đã thu hồi hoặc không tồn tại/bị chỉnh sửa, kèm thông tin ví người nhận và mốc thời gian liên quan.

### FR-06: Thu hồi chứng chỉ
Hệ thống phải cho phép quản trị viên thu hồi chứng chỉ theo metadata hash hợp lệ, gửi giao dịch revokeCertificate và đồng bộ trạng thái thu hồi về API.

### FR-07: Tìm kiếm và lọc danh sách chứng chỉ
Hệ thống phải cho phép tìm kiếm, lọc chứng chỉ theo từ khóa, trạng thái và loại tài liệu tại màn hình thu hồi/quản trị.

### FR-08: Chế độ tạo chứng chỉ thử nghiệm
Hệ thống phải hỗ trợ chế độ tạo chứng chỉ giả (test) để xuất ảnh mà không tương tác blockchain, phục vụ demo và kiểm thử giao diện.

## 4. Yêu cầu phi chức năng (Non-functional Requirements)

### NFR-01: Hiệu năng
Thời gian phản hồi cho các thao tác giao diện thông thường phải nhanh, và hệ thống phải hiển thị trạng thái loading rõ ràng cho các thao tác nặng như xử lý ảnh, quét QR và chờ xác nhận giao dịch.

### NFR-02: Bảo mật
Người dùng phải xác nhận giao dịch qua ví MetaMask; hệ thống không lưu private key trên frontend; dữ liệu đầu vào quan trọng như metadata hash phải được kiểm tra định dạng trước khi gửi giao dịch.

### NFR-03: Tính dễ sử dụng
Giao diện phải thân thiện, thông báo lỗi rõ ràng bằng tiếng Việt, và hỗ trợ nhiều định dạng ảnh phổ biến cho chức năng xác minh.

### NFR-04: Độ tin cậy
Hệ thống phải xử lý lỗi mạng, lỗi RPC và lỗi giao dịch có thông báo phù hợp; dữ liệu chứng chỉ sau phát hành cần truy vấn lại được qua API nếu backend lưu trữ hoạt động bình thường.

### NFR-05: Khả năng bảo trì
Hệ thống phải dễ mở rộng để thay in-memory store bằng cơ sở dữ liệu thật, và dễ nâng cấp thêm chức năng quản trị/kiểm toán trong tương lai.

## 5. Quy tắc nghiệp vụ (Business Rules)

### BR-01: Quy tắc metadata hash
Mỗi chứng chỉ được định danh on-chain bằng hash SHA-256 của metadata JSON đã chuẩn hóa; hash phải có dạng 0x + 64 ký tự hex.

### BR-02: Quy tắc QR metadata
QR trên chứng chỉ phải chứa payload có tiền tố CERT_META_V1: và phần JSON metadata hợp lệ để hệ thống tái tạo hash xác minh.

### BR-03: Quy tắc phát hành
Chỉ khi giao dịch issueCertificate được xác nhận thành công trên blockchain thì chứng chỉ mới được coi là phát hành hợp lệ.

### BR-04: Quy tắc thu hồi
Chỉ tài khoản owner của smart contract mới có quyền thu hồi chứng chỉ; hệ thống phải kiểm tra quyền trước khi gửi giao dịch revoke.

### BR-05: Quy tắc thời hạn
expirationTimestamp bằng 0 được hiểu là chứng chỉ không thời hạn; nếu lớn hơn 0 thì chứng chỉ hết hiệu lực khi vượt quá mốc thời gian này.

### BR-06: Quy tắc lưu trữ hiện tại
Khi chưa cấu hình backend ngoài, dữ liệu lưu tại API nội bộ dùng in-memory store và không đảm bảo bền vững sau khi tiến trình khởi động lại.

## 6. Danh sách thành viên
- Nhóm phát triển frontend
- Nhóm tích hợp blockchain
- Nhóm backend/API


| STT | MSSV | Họ tên | Nhiệm vụ |
| :--- | :--- | :--- | :--- |
| 1 | 0023413714 | Võ Nguyễn Nguyên Hùng | Thiết kế xây dựng: Dapp (front-backend, database, contract, kết nối ví MetaMask, deploy), viết đặc tả hệ thống |
| 2 | 0023411000 | Lê Minh Trọng | Đóng góp, lên ý tưởng, test dapp |
| 3 | 0023411852 | Nguyễn Phương Kiệt | Đóng góp, lên ý tưởng, test dapp |
| 4 | 0023411981 | Phan Quốc Phi | Đóng góp, lên ý tưởng, test dapp |
