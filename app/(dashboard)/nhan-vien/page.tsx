import { NhanVienCrud } from "./ui/nhan-vien-crud";

export default function NhanVienPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Danh sách nhân viên</h2>
        <p className="text-sm text-muted-foreground">Tạo / sửa / xoá nhân viên và gán bộ phận, chức vụ.</p>
      </div>

      <NhanVienCrud />
    </div>
  );
}
