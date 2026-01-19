import { HolidayTypeCrud } from "./ui/holiday-type-crud";

export default function LoaiNgayNghiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Loại ngày nghỉ</h1>
        <p className="text-sm text-muted-foreground">Quản lý loại ngày nghỉ và màu hiển thị trên lịch.</p>
      </div>
      <HolidayTypeCrud />
    </div>
  );
}
