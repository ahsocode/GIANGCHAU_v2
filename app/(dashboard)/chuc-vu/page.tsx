import { ChucVuCrud } from "./ui/chuc-vu-crud";

export default function ChucVuPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Danh sách chức vụ</h2>
        <p className="text-sm text-muted-foreground">Tạo / sửa / xoá chức vụ để gán cho nhân viên.</p>
      </div>

      <ChucVuCrud />
    </div>
  );
}
