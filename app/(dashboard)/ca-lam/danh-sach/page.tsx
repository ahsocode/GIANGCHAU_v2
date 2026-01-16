import { CaLamList } from "../ui/ca-lam-list";

export default function CaLamPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Danh sách ca làm</h2>
        <p className="text-sm text-muted-foreground">
          Quản lý danh sách ca làm, thời gian và thông số ca.
        </p>
      </div>

      <CaLamList />
    </div>
  );
}
