# GIANGCHAU_V2 - Hệ thống quản lý nhân sự

Ứng dụng quản lý nhân sự nội bộ xây dựng bằng Next.js (App Router) với Prisma.

## Cài đặt nhanh

```bash
npm install
```

Thiết lập biến môi trường trong `.env` (kết nối CSDL). Sau đó chạy:

```bash
npm run dev
```

Mở `http://localhost:3000` để sử dụng.

## Hướng dẫn sử dụng nhanh

1. Đăng nhập bằng tài khoản đã có trong hệ thống.
2. Vào Dashboard để quản lý nhân sự, bộ phận, chức vụ, tài khoản.
3. Trang Nhân viên hỗ trợ tạo/sửa/xoá và import danh sách bằng file Excel.

## Tính năng hiện có

- Dashboard tổng quan.
- Nhân viên:
  - Danh sách nhân viên, tìm kiếm, lọc, sắp xếp.
  - Phân trang 50 nhân viên/trang.
  - Thêm/sửa/xoá nhân viên, xem chi tiết.
  - Import danh sách nhân viên bằng Excel:
    - Tải file mẫu Excel.
    - Preview dữ liệu, chỉnh sửa trước khi xác nhận.
    - Chọn dòng để nhập hoặc xoá khỏi danh sách preview.
    - Kiểm tra trùng dữ liệu trong danh sách và trong CSDL.
- Bộ phận:
  - Danh sách, tạo/sửa/xoá.
  - Khi tạo mới, nếu trùng mã sẽ tự sinh mã gần giống.
- Chức vụ:
  - Danh sách, tạo/sửa/xoá.
  - Khi tạo mới, nếu trùng mã sẽ tự sinh mã gần giống.
- Tài khoản:
  - Danh sách tài khoản, gắn tài khoản với nhân viên.
- Hồ sơ cá nhân:
  - Xem và cập nhật thông tin cá nhân.

## Lưu ý

- Import nhân viên:
  - File mẫu có sẵn sheet hướng dẫn + danh sách mã chức vụ/bộ phận.
  - Mã nhân viên tự sinh khi xác nhận nhập.
  - Một số trường có ràng buộc unique (SĐT, Email, BHXH, CCCD/CMND).

## Kế hoạch

Tài liệu và chức năng sẽ tiếp tục được cập nhật trong tương lai.
