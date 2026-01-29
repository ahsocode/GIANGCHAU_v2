"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DeviceUserItem = {
  deviceCode: string;
  deviceUserCode: string;
  lastSeen: string | null;
  mapping: {
    employeeId: string;
    employeeCode: string | null;
    employeeName: string | null;
    note: string | null;
    isActive: boolean;
  } | null;
};

type ApiResponse = {
  ok: boolean;
  items?: DeviceUserItem[];
  total?: number;
};

type EmployeeItem = {
  id: string;
  code: string | null;
  fullName: string;
  departmentName: string | null;
  positionName: string | null;
};

type EmployeeResponse = {
  items?: EmployeeItem[];
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFormatter.format(d);
}

export default function DeviceUsersClient() {
  const [items, setItems] = useState<DeviceUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceUserCode, setDeviceUserCode] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "mapped" | "unmapped">("all");
  const [sortMode, setSortMode] = useState<"mapped-first" | "unmapped-first">("unmapped-first");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<DeviceUserItem | null>(null);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeItem[]>([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const fetchDeviceUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deviceCode.trim()) params.set("deviceCode", deviceCode.trim());
      if (deviceUserCode.trim()) params.set("deviceUserCode", deviceUserCode.trim());
      const res = await fetch(`/api/may-cham-cong/device-users?${params.toString()}`);
      if (!res.ok) {
        let message = `Không tải được danh sách (HTTP ${res.status})`;
        try {
          const payload = (await res.json()) as { error?: string; message?: string };
          message = payload.error ?? payload.message ?? message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      const data = (await res.json()) as ApiResponse;
      setItems(data.items ?? []);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async (query: string) => {
    setEmployeeLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("sort", "fullName");
      params.set("order", "asc");
      params.set("pageSize", "20");
      params.set("withoutDeviceMapping", "true");
      const res = await fetch(`/api/nhan-vien?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Không tải được danh sách nhân viên.");
      }
      const data = (await res.json()) as EmployeeResponse;
      setEmployeeOptions(data.items ?? []);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không tải được danh sách nhân viên.");
    } finally {
      setEmployeeLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceUsers();
  }, []);

  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      const isMapped = !!item.mapping && item.mapping.isActive;
      if (statusFilter === "mapped") return isMapped;
      if (statusFilter === "unmapped") return !isMapped;
      return true;
    });

    return list.sort((a, b) => {
      const aMapped = !!a.mapping && a.mapping.isActive;
      const bMapped = !!b.mapping && b.mapping.isActive;
      if (sortMode === "mapped-first") {
        if (aMapped !== bMapped) return aMapped ? -1 : 1;
      } else {
        if (aMapped !== bMapped) return aMapped ? 1 : -1;
      }
      if (a.deviceCode !== b.deviceCode) return a.deviceCode.localeCompare(b.deviceCode);
      return a.deviceUserCode.localeCompare(b.deviceUserCode);
    });
  }, [items, sortMode, statusFilter]);

  const openMappingDialog = (item: DeviceUserItem) => {
    setDialogItem(item);
    setSelectedEmployeeId(item.mapping?.employeeId ?? null);
    setEmployeeQuery("");
    setEmployeeOptions([]);
    setDialogOpen(true);
    fetchEmployees("");
  };

  const handleConfirmMapping = async () => {
    if (!dialogItem || !selectedEmployeeId) {
      toast.error("Vui lòng chọn nhân viên để map.");
      return;
    }
    try {
      const res = await fetch("/api/may-cham-cong/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceCode: dialogItem.deviceCode,
          deviceUserCode: dialogItem.deviceUserCode,
          employeeId: selectedEmployeeId,
          isActive: true,
        }),
      });
      if (!res.ok) {
        let message = `Không map được (HTTP ${res.status})`;
        try {
          const payload = (await res.json()) as { error?: string; message?: string };
          message = payload.error ?? payload.message ?? message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      toast.success("Đã map thành công.");
      setDialogOpen(false);
      setDialogItem(null);
      await fetchDeviceUsers();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không map được.");
    }
  };

  const handleUnmap = async (item: DeviceUserItem) => {
    if (!confirm(`Gỡ mapping cho user ${item.deviceUserCode} trên máy ${item.deviceCode}?`)) return;
    try {
      const params = new URLSearchParams({
        deviceCode: item.deviceCode,
        deviceUserCode: item.deviceUserCode,
      });
      const res = await fetch(`/api/may-cham-cong/mapping?${params.toString()}`, { method: "DELETE" });
      if (!res.ok) {
        let message = `Không gỡ mapping được (HTTP ${res.status})`;
        try {
          const payload = (await res.json()) as { error?: string; message?: string };
          message = payload.error ?? payload.message ?? message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      toast.success("Đã gỡ mapping.");
      await fetchDeviceUsers();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không gỡ mapping được.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold">Nhân viên trong máy chấm công</h1>
        <p className="text-sm text-muted-foreground">Danh sách user trong máy và trạng thái mapping.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Device code</label>
            <Input value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} placeholder="MCC00001" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">User code</label>
            <Input value={deviceUserCode} onChange={(e) => setDeviceUserCode(e.target.value)} placeholder="123" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Trạng thái</label>
            <div className="flex flex-wrap gap-2">
              {(["all", "mapped", "unmapped"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={statusFilter === value ? "default" : "outline"}
                  onClick={() => setStatusFilter(value)}
                >
                  {value === "all" ? "Tất cả" : value === "mapped" ? "Đã map" : "Chưa map"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Sắp xếp</label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={sortMode === "unmapped-first" ? "default" : "outline"}
                onClick={() => setSortMode("unmapped-first")}
              >
                Chưa map trước
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sortMode === "mapped-first" ? "default" : "outline"}
                onClick={() => setSortMode("mapped-first")}
              >
                Đã map trước
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={fetchDeviceUsers} disabled={loading}>
            {loading ? "Đang tải..." : "Tải danh sách"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead className="w-14 text-center bg-slate-100 whitespace-nowrap">STT</TableHead>
                <TableHead className="min-w-28 text-center bg-slate-100 whitespace-nowrap">Device</TableHead>
                <TableHead className="min-w-24 text-center bg-slate-100 whitespace-nowrap">User</TableHead>
                <TableHead className="min-w-40 text-center bg-slate-100 whitespace-nowrap">Nhân viên</TableHead>
                <TableHead className="min-w-28 text-center bg-slate-100 whitespace-nowrap">Trạng thái</TableHead>
                <TableHead className="min-w-36 text-center bg-slate-100 whitespace-nowrap">Lần cuối</TableHead>
                <TableHead className="min-w-32 text-center bg-slate-100 whitespace-nowrap">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Đang tải dữ liệu...
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Không có dữ liệu.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item, index) => {
                  const mapped = !!item.mapping && item.mapping.isActive;
                  return (
                    <TableRow key={`${item.deviceCode}-${item.deviceUserCode}`}>
                      <TableCell className="text-center text-sm text-slate-500">{index + 1}</TableCell>
                      <TableCell className="text-center font-medium">{item.deviceCode}</TableCell>
                      <TableCell className="text-center">{item.deviceUserCode}</TableCell>
                      <TableCell className="text-center">
                        {item.mapping ? (
                          <div className="space-y-1">
                            <div className="font-medium">
                              {item.mapping.employeeName ?? "—"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.mapping.employeeCode ?? "—"}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-xs font-medium",
                            mapped ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {mapped ? "Đã map" : "Chưa map"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{formatDateTime(item.lastSeen)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openMappingDialog(item)}>
                            {mapped ? "Đổi nhân viên" : "Map"}
                          </Button>
                          {item.mapping ? (
                            <Button size="sm" variant="destructive" onClick={() => handleUnmap(item)}>
                              Gỡ
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Map user máy chấm công</DialogTitle>
            <DialogDescription>
              {dialogItem
                ? `Device ${dialogItem.deviceCode} · User ${dialogItem.deviceUserCode}`
                : "Chọn nhân viên để map"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={employeeQuery}
                onChange={(e) => setEmployeeQuery(e.target.value)}
                placeholder="Tìm theo tên, mã, chức vụ hoặc phòng ban"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchEmployees(employeeQuery)}
                disabled={employeeLoading}
              >
                {employeeLoading ? "Đang tìm..." : "Tìm"}
              </Button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border">
              {employeeLoading ? (
                <div className="p-4 text-sm text-slate-500">Đang tải danh sách...</div>
              ) : employeeOptions.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Không có nhân viên phù hợp.</div>
              ) : (
                employeeOptions.map((emp) => {
                  const selected = selectedEmployeeId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0",
                        selected ? "bg-slate-100" : "hover:bg-slate-50"
                      )}
                      onClick={() => setSelectedEmployeeId(emp.id)}
                    >
                      <div>
                        <div className="font-medium">{emp.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {emp.code ?? "—"}
                          {emp.positionName ? ` · ${emp.positionName}` : ""}
                          {emp.departmentName ? ` · ${emp.departmentName}` : ""}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border",
                          selected ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                        )}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={handleConfirmMapping} disabled={!selectedEmployeeId}>
              Lưu mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
