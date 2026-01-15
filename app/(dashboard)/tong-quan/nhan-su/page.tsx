"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type MonthBucket = { key: string; label: string; value: number };
type DepartmentStat = { id: string; name: string; count: number };
type SummaryData = {
  totalEmployees: number;
  newEmployees: number;
  resignedEmployees: number;
  activeEmployees: number;
  departmentCount: number;
  positionCount: number;
  employmentCounts: { ct: number; tv: number };
  newEmployeesByMonth: MonthBucket[];
  activeByDepartment: DepartmentStat[];
  topDepartments: DepartmentStat[];
};

export default function TongQuanNhanSuPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tong-quan/nhan-su");
        if (!res.ok) throw new Error("Không tải được dữ liệu tổng quan");
        const json = (await res.json()) as SummaryData;
        setData(json);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được dữ liệu tổng quan");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const ctCount = data?.employmentCounts.ct ?? 0;
  const tvCount = data?.employmentCounts.tv ?? 0;
  const totalEmployment = ctCount + tvCount;
  const ctRate = totalEmployment ? Math.round((ctCount / totalEmployment) * 100) : 0;
  const tvRate = totalEmployment ? 100 - ctRate : 0;
  const maxBucket = useMemo(
    () => Math.max(1, ...(data?.newEmployeesByMonth ?? []).map((b) => b.value)),
    [data]
  );
  const activeDepartmentTotal = useMemo(
    () => (data?.activeByDepartment ?? []).reduce((sum, dept) => sum + dept.count, 0),
    [data]
  );
  const departmentChart = useMemo(() => {
    const items = (data?.activeByDepartment ?? []).map((dept, index) => {
      const hue = (index * 360) / Math.max(1, (data?.activeByDepartment ?? []).length);
      return {
        ...dept,
        color: `hsl(${Math.round(hue)} 85% 45%)`,
      };
    });
    let cursor = 0;
    const segments = items.map((dept) => {
      const value = activeDepartmentTotal ? (dept.count / activeDepartmentTotal) * 100 : 0;
      const start = cursor;
      const end = cursor + value;
      cursor = end;
      return {
        ...dept,
        start,
        end,
      };
    });
    const gradient = segments.map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`).join(", ");
    return {
      items: segments,
      gradient: gradient || "#e2e8f0 0% 100%",
    };
  }, [data, activeDepartmentTotal]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tổng quan nhân sự</h2>
        <p className="text-sm text-muted-foreground">
          Thống kê nhanh nhân sự theo thời gian, loại nhân viên và trạng thái.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng nhân viên</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.totalEmployees ?? 0}</div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Nhân viên mới (tháng này)</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.newEmployees ?? 0}</div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Nhân viên đã nghỉ</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.resignedEmployees ?? 0}</div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Nhân viên đang làm</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.activeEmployees ?? 0}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3">
          <div>
            <div className="text-sm text-slate-500">Tỉ lệ loại nhân viên</div>
            <div className="text-base font-semibold text-slate-900">
              Chính thức {ctRate}% - Thời vụ {tvRate}%
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-none bg-slate-100">
            <div className="flex h-full">
              <div className="bg-emerald-500" style={{ width: `${ctRate}%` }} />
              <div className="bg-amber-500" style={{ width: `${tvRate}%` }} />
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Chính thức: {ctCount}</span>
            <span>Thời vụ: {tvCount}</span>
          </div>
        </div>

        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm text-slate-500">Nhân viên mới 6 tháng gần nhất</div>
          <div className="flex items-end gap-3">
            {(data?.newEmployeesByMonth ?? []).map((bucket) => (
              <div key={bucket.key} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-none bg-blue-500/80"
                  style={{ height: `${Math.max(8, (bucket.value / maxBucket) * 120)}px` }}
                  title={`${bucket.value} nhân viên`}
                />
                <div className="text-xs text-slate-500">{bucket.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng bộ phận</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.departmentCount ?? 0}</div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng chức vụ</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.positionCount ?? 0}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm text-slate-500">Nhân viên đang làm theo bộ phận</div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative h-[27rem] w-[27rem] sm:h-[30rem] sm:w-[30rem]">
              <svg
                viewBox="0 0 200 200"
                className="h-full w-full"
                role="img"
                aria-label="Tỉ lệ nhân viên theo bộ phận"
              >
                {departmentChart.items.map((segment) => {
                  const startAngle = (segment.start / 100) * 360;
                  const endAngle = (segment.end / 100) * 360;
                  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                  const startRad = (Math.PI / 180) * (startAngle - 90);
                  const endRad = (Math.PI / 180) * (endAngle - 90);
                  const r = 90;
                  const cx = 100;
                  const cy = 100;
                  const x1 = cx + r * Math.cos(startRad);
                  const y1 = cy + r * Math.sin(startRad);
                  const x2 = cx + r * Math.cos(endRad);
                  const y2 = cy + r * Math.sin(endRad);
                  const d = [
                    `M ${cx} ${cy}`,
                    `L ${x1} ${y1}`,
                    `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
                    "Z",
                  ].join(" ");
                  const percent = activeDepartmentTotal
                    ? Math.round((segment.count / activeDepartmentTotal) * 100)
                    : 0;
                  return (
                    <path
                      key={segment.id}
                      d={d}
                      fill={segment.color}
                      stroke="white"
                      strokeWidth="1"
                      className="cursor-pointer"
                    >
                      <title>
                        {segment.name}: {segment.count} ({percent}%)
                      </title>
                    </path>
                  );
                })}
                <circle cx="100" cy="100" r="89" fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </svg>
            </div>
            <div className="flex-1 space-y-2">
              {departmentChart.items.map((dept) => {
                const percent = activeDepartmentTotal
                  ? Math.round((dept.count / activeDepartmentTotal) * 100)
                  : 0;
                return (
                  <div key={dept.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: dept.color }}
                      />
                      <span className="text-slate-700">{dept.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900">
                      {dept.count} ({percent}%)
                    </span>
                  </div>
                );
              })}
              {departmentChart.items.length === 0 && !loading && (
                <div className="text-sm text-slate-500">Chưa có dữ liệu</div>
              )}
              {departmentChart.items.length > 0 && (
                <div className="text-xs text-slate-500">
                  Tỉ lệ tính theo nhân viên đang làm.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm text-slate-500">Top 5 bộ phận đông nhân sự</div>
          <div className="space-y-2">
            {(data?.topDepartments ?? []).map((dept, index) => (
              <div key={dept.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">
                  {index + 1}. {dept.name}
                </span>
                <span className="font-semibold text-slate-900">{dept.count}</span>
              </div>
            ))}
            {data?.topDepartments?.length === 0 && !loading && (
              <div className="text-sm text-slate-500">Chưa có dữ liệu</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
