import { HolidaySetClient } from "./holiday-set-client";

export default function ThietLapNgayNghiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Thiết lập ngày nghỉ</h2>
        <p className="text-sm text-muted-foreground">
          Chọn loại ngày nghỉ và đánh dấu ngày trên lịch để áp dụng.
        </p>
      </div>

      <HolidaySetClient />
    </div>
  );
}
