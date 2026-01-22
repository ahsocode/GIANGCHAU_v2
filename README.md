# GIANGCHAU_V2 - Hệ thống quản lý nhân sự

Ứng dụng quản lý nhân sự nội bộ xây dựng bằng Next.js (App Router) và Prisma, tập trung vào quản lý nhân sự, ca làm, phân ca, chấm công và ngày nghỉ.

## Công nghệ chính

- Next.js 16 (App Router), React 19
- Prisma 7 + PostgreSQL
- NextAuth (Credentials/JWT)
- Tailwind CSS 4 + Radix UI
- Cloudinary (upload avatar)
- xlsx (import Excel nhân viên)

## Yêu cầu

- Node.js 18+
- PostgreSQL

## Cài đặt nhanh

```bash
npm install
```

Thiết lập biến môi trường trong `.env`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
NEXTAUTH_SECRET="your-secret"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
NEXT_PUBLIC_CLOUDINARY_AVATAR_FOLDER="employee_avatar"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
# Optional cho môi trường dev:
PG_SSL_REJECT_UNAUTHORIZED="0"
```

Đồng bộ schema và tạo dữ liệu mẫu:

```bash
npx prisma db push
npx tsx prisma/seed.ts
```

Chạy dự án:

```bash
npm run dev
```

Mở `http://localhost:3000` để sử dụng.

## Tài khoản mặc định (seed)


## Hướng dẫn sử dụng nhanh

1. Đăng nhập bằng tài khoản có sẵn.
2. Khai báo danh mục nền: Bộ phận, Chức vụ.
3. Tạo Nhân viên hoặc import Excel danh sách nhân sự.
4. Cấu hình Ca làm, sau đó Phân ca/Lịch làm.
5. Theo dõi Chấm công và thiết lập Ngày nghỉ.

## Chức năng chi tiết

### Dashboard tổng quan

- Thống kê nhanh nhân sự, ca làm, tình trạng chấm công theo ngày/tuần.
- Biểu đồ xu hướng đi muộn, vắng mặt, tăng ca.

### Tổng hợp nhân viên

- Trang tổng hợp cá nhân cho nhân viên: lịch làm tháng, chấm công gần đây, ca sắp tới, đơn nghỉ.
- API riêng: `GET /api/tong-hop`.

### Nhân viên

- Danh sách nhân viên có tìm kiếm, lọc, sắp xếp và phân trang.
- Thêm/sửa/xoa, xem chi tiết hồ sơ nhân viên.
- Gắn tài khoản đăng nhập với nhân viên.
- Import Excel:
  - Tải file mẫu Excel kèm sheet huong dan.
  - Preview du lieu, co the chinh sua truoc khi xac nhan.
  - Chon dong de nhap hoac loai bo.
  - Kiem tra trung du lieu trong danh sach va trong CSDL.

### Bộ phận

- Tao/sua/xoa bo phan.
- Quan ly truong bo phan (manager) neu can.
- Neu ma bi trung thi tu sinh ma gan giong.

### Chức vụ

- Tao/sua/xoa chuc vu.
- Neu ma bi trung thi tu sinh ma gan giong.

### Tài khoản

- Tao/sua/xoa tai khoan.
- Gan tai khoan cho nhan vien.
- Quan ly vai tro: ADMIN, DIRECTOR, STAFF, EMPLOYEE.
- Khoa/vo hieu hoa tai khoan.

### Ca làm

- Tao ca lam voi gio vao/ra, thoi gian nghi, nguong tang ca.
- Cap nhat ca lam dang su dung.

### Phân ca va Lịch làm

- Gan ca theo nhan vien.
- Xem lich theo ngay de kiem tra phan ca.
- Ho tro xoa phan ca hang loat khi can.

### Chấm công

- Check-in/out theo ca da phan.
- Luu lich su cham cong, xu ly di muon/ve som/tang ca.
- Tong hop cham cong theo ngay.

### Ngày nghỉ

- Quan ly loai ngay nghi: co luong/khong luong/ngay phep.
- Thiet lap lich ngay nghi theo pham vi: toan cong ty/bo phan/chuc vu/nhan vien.

### Ho so ca nhan

- Xem va cap nhat thong tin ca nhan.
- Doi mat khau.
- Cap nhat gioi tinh.

## Gioi thieu tung man hinh

- Dang nhap: nhap email/mat khau, chuyen vao Dashboard sau khi xac thuc.
- Tong quan: bieu do tong hop nhan su, ca lam, cham cong va xu huong theo thoi gian.
- Tong hop: trang tong hop ca nhan cho nhan vien.
- Nhan vien: danh sach, tim kiem/loc/sap xep, xem chi tiet va chinh sua nhan vien.
- Nhan vien - Chi tiet: thong tin ho so, lich su cham cong lien quan, gan tai khoan.
- Nhan vien - Chinh sua: cap nhat thong tin co ban, avatar, phong ban, chuc vu.
- Nhan vien - Import: tai file mau, preview, chinh sua va xac nhan nhap du lieu.
- Bo phan: quan ly danh muc bo phan va truong bo phan.
- Chuc vu: quan ly danh muc chuc vu, ma chuc vu.
- Tai khoan: quan ly tai khoan dang nhap, vai tro va trang thai.
- Ca lam: tao va chinh sua ca lam, xem danh sach ca lam.
- Phan ca: gan ca theo nhan vien va theo ngay.
- Lich lam: xem lich phan ca theo ngay/thang.
- Cham cong: thao tac check-in/out, cap nhat thong tin cham cong.
- Cham cong - Lich su: xem chi tiet lich su, di muon/ve som/tang ca.
- Ngay nghi - Loai: quan ly loai ngay nghi va che do luong.
- Ngay nghi - Lich: thiet lap lich nghi theo pham vi.
- Ho so: xem thong tin ca nhan.
- Ho so - Chinh sua: cap nhat thong tin va doi mat khau.

## Quy trinh su dung goi y

1. Tao Bo phan, Chuc vu.
2. Tao Nhan vien hoac import Excel.
3. Tao Ca lam.
4. Phan ca cho nhan vien.
5. Theo doi Cham cong va quan ly Ngay nghi.

## Scripts tiện ích

```bash
npx tsx prisma/seed.ts
npx tsx scripts/backfill-attendance.ts
```

## Lưu ý

- Import nhân viên:
  - File mẫu có sẵn sheet hướng dẫn + danh sách mã chức vụ/bộ phận.
  - Mã nhân viên tự sinh khi xác nhận nhập.
  - Một số trường có ràng buộc unique (SĐT, Email, BHXH, CCCD/CMND).
- Prisma đọc `DATABASE_URL` từ `prisma.config.ts` (Prisma 7).

## Kế hoạch

Tài liệu và chức năng sẽ tiếp tục được cập nhật trong tương lai.
