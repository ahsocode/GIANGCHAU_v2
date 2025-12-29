import { BoPhanCrud } from "./ui/bo-phan-crud";

export default async function BoPhanPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Danh sách bộ phận</h2>
        <p className="text-sm text-muted-foreground">
          Tạo / sửa / xoá bộ phận để phân loại nhân viên.
        </p>
      </div>

      <BoPhanCrud />
    </div>
  );
}
