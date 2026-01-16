import { PhanCaClient } from "../ui/phan-ca-client";

export default function PhanCaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Phân ca</h2>
        <p className="text-sm text-muted-foreground">
          Thiết lập phân ca theo ngày và nhân viên.
        </p>
      </div>

      <PhanCaClient />
    </div>
  );
}
