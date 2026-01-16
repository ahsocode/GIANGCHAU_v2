import { CaLamForm } from "../ui/ca-lam-form";

export default function TaoMoiCaLamPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Tạo ca làm mới</h2>
        <p className="text-sm text-muted-foreground">
          Nhập thông tin ca làm để áp dụng cho nhân viên.
        </p>
      </div>

      <CaLamForm mode="create" />
    </div>
  );
}
