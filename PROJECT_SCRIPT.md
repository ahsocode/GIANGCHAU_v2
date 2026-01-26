# GIANGCHAU_V2 - Script mo ta du an (hoan chinh)

Tai lieu nay mo ta toan bo du an de mot agent khac co the hieu nhanh:
- Muc tieu va pham vi nghiep vu
- Cong nghe va ngu canh van hanh
- Kien truc tong the
- API va luong du lieu chinh
- Cau truc thu muc va chi tiet tung file

---

## 1. Tong quan nghiep vu

GiangChau_V2 la he thong quan ly nhan su noi bo, tap trung vao:
- Quan ly nhan vien (ho so, bo phan, chuc vu, tai khoan)
- Quan ly ca lam, phan ca, lich lam
- Cham cong (check-in/out, tre/som/tang ca)
- Quan ly ngay nghi va yeu cau (doi ca, nghi phep, dieu chinh cham cong, cap nhat thong tin)

Doi tuong nguoi dung:
- Admin/Director/Staff: quan ly toan bo danh muc va du lieu
- Employee: truy cap cac chuc nang ca nhan (tong hop, ho so, lich lam, cham cong, yeu cau)

---

## 2. Cong nghe va ngu canh

Backend/Fullstack:
- Next.js 16 (App Router)
- NextAuth v5 (Credentials + JWT)
- Prisma 7 + PostgreSQL
- Node.js 18+

Frontend:
- React 19
- Tailwind CSS 4
- Radix UI (Dialog, Dropdown, etc.)
- Shadcn-style components
- Sonner (toast)

Tich hop:
- Cloudinary (upload avatar)
- xlsx (import Excel nhan vien)

Luu tru va truy cap:
- Prisma Client su dung Pg adapter + Pool
- Cac route API thuc thi trong app/api
- Session JWT duoc inject vao Server Components qua auth()

---

## 3. Cac bien moi truong (.env)

Khong ghi gia tri cu the (tranh lo thong tin). Cac khoa can thiet:
- DATABASE_URL
- NEXTAUTH_SECRET
- NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
- NEXT_PUBLIC_CLOUDINARY_AVATAR_FOLDER
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- PG_SSL_REJECT_UNAUTHORIZED (tuy chon cho dev)
- DEV_ROLE (tuy chon cho dev, dung cho auth-dev)

---

## 4. Kien truc chinh

App Router structure:
- app/(auth): man hinh dang nhap
- app/(dashboard): khu vuc quan ly noi bo (co Sidebar, header)
- app/api: REST-like API (GET/POST/PATCH/DELETE)

Auth + RBAC:
- auth.ts: NextAuth Credentials (email/password), JWT session
- proxy.ts: middleware-style guard, gioi han route theo role (Employee chi truy cap cac trang ca nhan)
- lib/rbac.ts: menu theo role

Du lieu:
- Prisma schema co nhieu model: Account, Employee, Department, Position, WorkShift, WorkSchedule, AttendanceRecord, LeaveRequest, ...
- Logic cham cong tinh toan tre/som/tang ca dua vao shift window
- Import Excel co buoc validate -> confirm -> ghi DB

---

## 5. Tong quan data model (tu prisma/schema.prisma)

Cac nhom model chinh:
- Auth/Account: Account (role, status, link Employee)
- HR co ban: Employee, Department, Position
- Ca lam & lich: WorkShift, WorkSchedule
- Cham cong: AttendanceRecord, AttendanceEvent, AttendanceAdjustmentRequest
- Yeu cau: ShiftChangeRequest, LeaveRequest, ProfileUpdateRequest, RequestActionLog
- Ngay nghi: HolidayType, HolidayCalendar (lich nghi theo pham vi)
- File import: FileImport + chi tiet
- Audit: AuditLog

Enum quan trong:
- RoleKey: ADMIN/DIRECTOR/STAFF/EMPLOYEE
- AttendanceStatus, AttendanceCheckInStatus, AttendanceCheckOutStatus
- LeaveType, LeaveStatus, RequestType, RequestStatus

---

## 6. API endpoints (muc dich va phuong thuc)

Ghi chu: Tat ca API duoc dat trong app/api (Next.js route handlers).

### Auth
- POST /api/auth/login: dang nhap voi Credentials, tra ve session
- POST /api/auth/logout: dang xuat (server-side)
- GET|POST /api/auth/[...nextauth]: handlers cua NextAuth

### Ho so
- GET /api/ho-so: lay thong tin tai khoan + nhan vien hien tai
- PATCH /api/ho-so: cap nhat thong tin ho so ca nhan
- POST /api/ho-so/doi-mat-khau: doi mat khau

### Nhan vien
- GET /api/nhan-vien: danh sach nhan vien (search, filter, sort, pagination)
- POST /api/nhan-vien: tao nhan vien (tu dong sinh ma)
- GET /api/nhan-vien/[id]: lay chi tiet nhan vien
- PATCH /api/nhan-vien/[id]: cap nhat nhan vien
- DELETE /api/nhan-vien/[id]: xoa nhan vien
- PATCH /api/nhan-vien/[id]/quyen-loi: cap nhat quyen loi (benefit) cua nhan vien

### Import nhan vien (Excel)
- GET /api/nhan-vien/template: tai file mau Excel
- POST /api/nhan-vien/import/validate: validate du lieu excel
- POST /api/nhan-vien/import: upload/parse file excel
- POST /api/nhan-vien/import/confirm: xac nhan import vao DB
- GET /api/nhan-vien/import/history: lich su import
- app/api/nhan-vien/import/utils.ts: ham validate/parse/convert

### Tai khoan
- GET /api/tai-khoan: danh sach tai khoan
- POST /api/tai-khoan: tao tai khoan
- PATCH /api/tai-khoan/[id]: cap nhat tai khoan
- DELETE /api/tai-khoan/[id]: xoa tai khoan

### Bo phan & Chuc vu
- GET /api/bo-phan: danh sach bo phan
- POST /api/bo-phan: tao bo phan
- PATCH /api/bo-phan/[id]: cap nhat bo phan
- DELETE /api/bo-phan/[id]: xoa bo phan

- GET /api/chuc-vu: danh sach chuc vu
- POST /api/chuc-vu: tao chuc vu
- PATCH /api/chuc-vu/[id]: cap nhat chuc vu
- DELETE /api/chuc-vu/[id]: xoa chuc vu

### Ca lam & phan ca
- GET /api/ca-lam: danh sach ca lam
- POST /api/ca-lam: tao ca lam
- GET /api/ca-lam/[id]: chi tiet ca lam
- PATCH /api/ca-lam/[id]: cap nhat ca lam
- DELETE /api/ca-lam/[id]: xoa ca lam
- GET /api/ca-lam/doi-ca-policy: lay policy doi ca
- POST /api/ca-lam/doi-ca-policy: cap nhat policy doi ca

- POST /api/phan-ca: tao phan ca
- POST /api/phan-ca/remove: xoa phan ca hang loat
- GET /api/phan-ca/lich: lay lich phan ca (theo ngay/nhan vien)
- GET /api/lich-lam: lay lich lam cua nhan vien

### Cham cong
- GET /api/cham-cong: lay thong tin cham cong trong ngay (co ca, record)
- POST /api/cham-cong: check-in/check-out
- GET /api/cham-cong/lich-su: lich su cham cong theo khoang ngay

### Tong quan / Tong hop
- GET /api/tong-quan/nhan-su: thong ke nhanh nhan su
- GET /api/tong-quan/ca-lam: thong ke ca lam
- GET /api/tong-quan/cham-cong: thong ke cham cong
- GET /api/tong-hop: tong hop ca nhan (lich, cham cong, nghi phep)

### Ngay nghi
- GET /api/ngay-nghi/loai: danh sach loai ngay nghi
- POST /api/ngay-nghi/loai: tao loai ngay nghi
- PATCH /api/ngay-nghi/loai/[id]: cap nhat loai ngay nghi
- DELETE /api/ngay-nghi/loai/[id]: xoa loai ngay nghi
- GET /api/ngay-nghi/lich: lay lich ngay nghi
- POST /api/ngay-nghi: tao lich ngay nghi

### Yeu cau (workflow)
- POST /api/yeu-cau/doi-ca: yeu cau doi ca
- POST /api/yeu-cau/nghi-phep: yeu cau nghi phep
- POST /api/yeu-cau/cap-nhat-thong-tin: yeu cau cap nhat thong tin
- POST /api/yeu-cau/dieu-chinh-cham-cong: yeu cau dieu chinh cham cong
- GET /api/yeu-cau/lich-su: lich su yeu cau cua nhan vien
- GET /api/yeu-cau/thong-ke: thong ke tong hop yeu cau
- GET /api/yeu-cau/cham-cong-info: lay thong tin cham cong de lap yeu cau
- GET /api/yeu-cau/quan-ly: danh sach yeu cau cho admin/staff
- PATCH /api/yeu-cau/quan-ly: duyet/tu choi yeu cau

### He thong/khac
- POST /api/cloudinary/sign-avatar: ky upload avatar
- GET /api/time: lay thoi gian server

---

## 7. Cau truc thu muc (tong quan)

- app/: Next.js App Router (UI + API)
- components/: UI components va providers
- lib/: helper functions (prisma, rbac, utils)
- prisma/: schema, seed, migrations
- scripts/: script tien ich
- public/: static assets
- types/: type definitions

---

## 8. Chi tiet tung file trong repo

### Root (cau hinh va tai lieu)
- .git/: metadata git (khong dong vao phan chay app).
- .vscode/: cau hinh editor (local).
- .next/: output build cua Next.js (generated).
- node_modules/: thu vien cai dat (generated).
- .env: bien moi truong (khong commit).
- .gitignore: quy tac bo qua file.
- README.md: huong dan tong quan va chay du an.
- package.json: khai bao deps + scripts.
- package-lock.json: lock deps.
- next.config.ts: cau hinh Next.js (hien dang rong).
- next-env.d.ts: khai bao type Next.js.
- tsconfig.json: cau hinh TypeScript.
- tsconfig.tsbuildinfo: cache build TypeScript.
- eslint.config.mjs: cau hinh ESLint.
- postcss.config.mjs: cau hinh PostCSS/Tailwind.
- components.json: config shadcn/tailwind.
- prisma.config.ts: cau hinh Prisma 7 (schema + datasource).
- auth.ts: cau hinh NextAuth (Credentials + JWT).
- proxy.ts: middleware-style guard theo role va auth.

### app/ (Next.js App Router)
- app/layout.tsx: root layout + SessionProvider + Toaster.
- app/page.tsx: redirect ve /dang-nhap.
- app/loading.tsx: UI loading global.
- app/error.tsx: UI error boundary.
- app/not-found.tsx: UI 404.
- app/globals.css: CSS global + Tailwind.
- app/favicon.ico: favicon.

#### app/(auth)/
- app/(auth)/dang-nhap/page.tsx: man hinh dang nhap (client component).
- app/(auth)/loading.tsx: loading khi vao auth route.

#### app/unauthorized/
- app/unauthorized/page.tsx: man hinh khong du quyen.
- app/unauthorized/loading.tsx: loading.

#### app/(dashboard)/
- app/(dashboard)/layout.tsx: layout dashboard (Sidebar + header, require auth).
- app/(dashboard)/loading.tsx: loading trong khu vuc dashboard.

##### Tong quan
- app/(dashboard)/tong-quan/layout.tsx: layout con cho tong quan.
- app/(dashboard)/tong-quan/page.tsx: trang tong quan tong.
- app/(dashboard)/tong-quan/ui/tong-quan-tabs.tsx: tabs UI tong quan.
- app/(dashboard)/tong-quan/nhan-su/page.tsx: dashboard nhan su.
- app/(dashboard)/tong-quan/ca-lam/page.tsx: dashboard ca lam.
- app/(dashboard)/tong-quan/cham-cong/page.tsx: dashboard cham cong.

##### Ca lam / phan ca / lich lam
- app/(dashboard)/ca-lam/layout.tsx: layout con cho khu vuc ca lam.
- app/(dashboard)/ca-lam/page.tsx: trang tong quan ca lam.
- app/(dashboard)/ca-lam/danh-sach/page.tsx: danh sach ca lam.
- app/(dashboard)/ca-lam/tao-moi/page.tsx: tao ca lam.
- app/(dashboard)/ca-lam/[id]/chinh-sua/page.tsx: chinh sua ca lam.
- app/(dashboard)/ca-lam/phan-ca/page.tsx: phan ca nhan vien.
- app/(dashboard)/ca-lam/ui/ca-lam-list.tsx: list UI ca lam.
- app/(dashboard)/ca-lam/ui/ca-lam-form.tsx: form tao/sua ca lam.
- app/(dashboard)/ca-lam/ui/phan-ca-client.tsx: UI client phan ca.
- app/(dashboard)/ca-lam/ui/lich-lam-tabs.tsx: tabs UI lich/phan ca.

##### Lich lam (ca nhan)
- app/(dashboard)/lich-lam/page.tsx: trang lich lam ca nhan.
- app/(dashboard)/lich-lam/lich-lam-client.tsx: UI client cho lich lam.

##### Cham cong
- app/(dashboard)/cham-cong/layout.tsx: layout cham cong.
- app/(dashboard)/cham-cong/page.tsx: trang cham cong.
- app/(dashboard)/cham-cong/cham-cong-client.tsx: UI check-in/out.
- app/(dashboard)/cham-cong/ui/cham-cong-tabs.tsx: tabs UI cham cong.
- app/(dashboard)/cham-cong/lich-su/page.tsx: lich su cham cong.
- app/(dashboard)/cham-cong/lich-su/history-client.tsx: UI lich su cham cong.

##### Tong hop (employee)
- app/(dashboard)/tong-hop/page.tsx: tong hop ca nhan nhan vien.

##### Ho so
- app/(dashboard)/ho-so/page.tsx: xem ho so ca nhan.
- app/(dashboard)/ho-so/chinh-sua/page.tsx: chinh sua ho so.
- app/(dashboard)/ho-so/personal-edit-client.tsx: UI form chinh sua.
- app/(dashboard)/ho-so/doi-mat-khau/page.tsx: trang doi mat khau.
- app/(dashboard)/ho-so/doi-mat-khau/password-client.tsx: UI form doi mat khau.

##### Nhan vien
- app/(dashboard)/nhan-vien/page.tsx: danh sach nhan vien.
- app/(dashboard)/nhan-vien/ui/nhan-vien-crud.tsx: CRUD UI nhan vien.
- app/(dashboard)/nhan-vien/[id]/page.tsx: chi tiet nhan vien.
- app/(dashboard)/nhan-vien/[id]/edit/page.tsx: chinh sua nhan vien.
- app/(dashboard)/nhan-vien/[id]/quyen-loi/page.tsx: quan ly quyen loi.
- app/(dashboard)/nhan-vien/[id]/quyen-loi/benefit-client.tsx: UI quyen loi.
- app/(dashboard)/nhan-vien/tai-len/page.tsx: trang import excel.
- app/(dashboard)/nhan-vien/tai-len/upload-client.tsx: UI upload.
- app/(dashboard)/nhan-vien/tai-len/tabs-client.tsx: tabs UI import.
- app/(dashboard)/nhan-vien/tai-len/history-client.tsx: lich su import.

##### Bo phan
- app/(dashboard)/bo-phan/page.tsx: danh muc bo phan.
- app/(dashboard)/bo-phan/ui/bo-phan-crud.tsx: CRUD UI bo phan.

##### Chuc vu
- app/(dashboard)/chuc-vu/page.tsx: danh muc chuc vu.
- app/(dashboard)/chuc-vu/ui/chuc-vu-crud.tsx: CRUD UI chuc vu.

##### Tai khoan
- app/(dashboard)/tai-khoan/layout.tsx: layout tai khoan.
- app/(dashboard)/tai-khoan/page.tsx: trang tong quan tai khoan.
- app/(dashboard)/tai-khoan/ui/tai-khoan-tabs.tsx: tabs UI tai khoan.
- app/(dashboard)/tai-khoan/account/page.tsx: danh sach tai khoan.
- app/(dashboard)/tai-khoan/nhan-vien/page.tsx: danh sach nhan vien (gan tai khoan).

##### Ngay nghi
- app/(dashboard)/ngay-nghi/layout.tsx: layout ngay nghi.
- app/(dashboard)/ngay-nghi/page.tsx: tong quan ngay nghi.
- app/(dashboard)/ngay-nghi/ui/holiday-tabs.tsx: tabs UI ngay nghi.
- app/(dashboard)/ngay-nghi/loai/page.tsx: danh muc loai ngay nghi.
- app/(dashboard)/ngay-nghi/loai/ui/holiday-type-crud.tsx: CRUD loai ngay nghi.
- app/(dashboard)/ngay-nghi/set/page.tsx: thiet lap lich ngay nghi.
- app/(dashboard)/ngay-nghi/set/holiday-set-client.tsx: UI thiet lap lich.

##### Yeu cau
- app/(dashboard)/yeu-cau/page.tsx: trang yeu cau cua nhan vien.
- app/(dashboard)/yeu-cau/lich-su/page.tsx: lich su yeu cau.
- app/(dashboard)/yeu-cau/employee-requests-client.tsx: UI yeu cau cua nhan vien.
- app/(dashboard)/yeu-cau/admin-requests-client.tsx: UI quan ly yeu cau (admin/staff).
- app/(dashboard)/xu-ly-yeu-cau/page.tsx: trang xu ly yeu cau (admin/staff).

### app/api/ (chi tiet file)
- app/api/auth/[...nextauth]/route.ts: handlers GET/POST cua NextAuth.
- app/api/auth/login/route.ts: API login.
- app/api/auth/logout/route.ts: API logout.

- app/api/ho-so/route.ts: GET thong tin ho so, PATCH cap nhat ho so.
- app/api/ho-so/doi-mat-khau/route.ts: POST doi mat khau.

- app/api/nhan-vien/route.ts: GET danh sach, POST tao nhan vien.
- app/api/nhan-vien/[id]/route.ts: GET chi tiet, PATCH cap nhat, DELETE xoa.
- app/api/nhan-vien/[id]/quyen-loi/route.ts: PATCH cap nhat quyen loi.
- app/api/nhan-vien/template/route.ts: GET file mau excel.
- app/api/nhan-vien/import/route.ts: POST upload/parse excel.
- app/api/nhan-vien/import/validate/route.ts: POST validate du lieu.
- app/api/nhan-vien/import/confirm/route.ts: POST ghi DB sau khi confirm.
- app/api/nhan-vien/import/history/route.ts: GET lich su import.
- app/api/nhan-vien/import/utils.ts: ham tien ich import/validate.

- app/api/tai-khoan/route.ts: GET danh sach, POST tao tai khoan.
- app/api/tai-khoan/[id]/route.ts: PATCH cap nhat, DELETE xoa.

- app/api/bo-phan/route.ts: GET danh sach, POST tao bo phan.
- app/api/bo-phan/[id]/route.ts: PATCH cap nhat, DELETE xoa.

- app/api/chuc-vu/route.ts: GET danh sach, POST tao chuc vu.
- app/api/chuc-vu/[id]/route.ts: PATCH cap nhat, DELETE xoa.

- app/api/ca-lam/route.ts: GET danh sach, POST tao ca lam.
- app/api/ca-lam/[id]/route.ts: GET chi tiet, PATCH cap nhat, DELETE xoa.
- app/api/ca-lam/doi-ca-policy/route.ts: GET/POST policy doi ca.

- app/api/phan-ca/route.ts: POST phan ca.
- app/api/phan-ca/remove/route.ts: POST xoa phan ca hang loat.
- app/api/phan-ca/lich/route.ts: GET lich phan ca.
- app/api/lich-lam/route.ts: GET lich lam ca nhan.

- app/api/cham-cong/route.ts: GET thong tin cham cong trong ngay, POST check-in/out.
- app/api/cham-cong/lich-su/route.ts: GET lich su cham cong.

- app/api/ngay-nghi/loai/route.ts: GET/POST loai ngay nghi.
- app/api/ngay-nghi/loai/[id]/route.ts: PATCH/DELETE loai ngay nghi.
- app/api/ngay-nghi/lich/route.ts: GET lich ngay nghi.
- app/api/ngay-nghi/route.ts: POST tao lich ngay nghi.

- app/api/tong-quan/nhan-su/route.ts: GET thong ke nhan su.
- app/api/tong-quan/ca-lam/route.ts: GET thong ke ca lam.
- app/api/tong-quan/cham-cong/route.ts: GET thong ke cham cong.
- app/api/tong-hop/route.ts: GET tong hop ca nhan.

- app/api/yeu-cau/doi-ca/route.ts: POST yeu cau doi ca.
- app/api/yeu-cau/nghi-phep/route.ts: POST yeu cau nghi phep.
- app/api/yeu-cau/cap-nhat-thong-tin/route.ts: POST yeu cau cap nhat thong tin.
- app/api/yeu-cau/dieu-chinh-cham-cong/route.ts: POST yeu cau dieu chinh cham cong.
- app/api/yeu-cau/lich-su/route.ts: GET lich su yeu cau.
- app/api/yeu-cau/thong-ke/route.ts: GET thong ke yeu cau.
- app/api/yeu-cau/cham-cong-info/route.ts: GET thong tin cham cong de tao yeu cau.
- app/api/yeu-cau/quan-ly/route.ts: GET danh sach yeu cau, PATCH duyet/tu choi.

- app/api/cloudinary/sign-avatar/route.ts: POST ky upload avatar.
- app/api/time/route.ts: GET thoi gian server.

### components/
- components/layout/sidebar.tsx: Sidebar responsive, menu theo role.
- components/providers/session-provider.tsx: wrapper SessionProvider cho NextAuth.

#### components/ui/
- components/ui/button.tsx: Button variants (cva + radix Slot).
- components/ui/card.tsx: Card component.
- components/ui/dialog.tsx: Dialog (Radix).
- components/ui/dropdown-menu.tsx: Dropdown (Radix).
- components/ui/input.tsx: Input component.
- components/ui/separator.tsx: Separator.
- components/ui/sheet.tsx: Drawer/Sheet (Radix).
- components/ui/table.tsx: Table helpers.
- components/ui/barcode.tsx: Barcode UI (jsbarcode).
- components/ui/flip-clock.tsx: Flip clock countdown.
- components/ui/fullscreen-loader.tsx: Fullscreen loading overlay.

### lib/
- lib/prisma.ts: tao PrismaClient + Pg Pool (SSL option).
- lib/rbac.ts: role + menu mapping.
- lib/utils.ts: cn() helper.
- lib/employee-code.ts: sinh ma nhan vien.
- lib/auth-dev.ts: helper dev role (DEV_ROLE).

### prisma/
- prisma/schema.prisma: schema DB.
- prisma/seed.ts: seed tai khoan mac dinh (admin/director).

### scripts/
- scripts/backfill-attendance.ts: tao/bo sung attendanceRecord theo workSchedule.

### public/
- public/next.svg, vercel.svg, globe.svg, window.svg, file.svg: static assets.

### types/
- types/next-auth.d.ts: mo rong type cho NextAuth session/user.
- types/css.d.ts: khai bao types cho CSS modules (neu co).

---

## 9. Huong dan nhanh cho agent moi

1) Doc README.md de hieu cach setup.
2) Xem prisma/schema.prisma de hieu data model.
3) Doc auth.ts + proxy.ts de hieu auth/role.
4) Vao app/api de hieu API hien co.
5) Vao app/(dashboard) de hieu UI routes.

---

Neu can them: co the yeu cau them "API contract detail" (request/response), hoac "data dictionary" tu Prisma.
