import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const schedules = await prisma.workSchedule.findMany({
    select: {
      id: true,
      employeeId: true,
      date: true,
      attendance: { select: { id: true, scheduleId: true } },
    },
    orderBy: { date: "asc" },
  });

  let created = 0;
  let updated = 0;

  for (const schedule of schedules) {
    const result = await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: schedule.employeeId, date: schedule.date } },
      create: {
        employeeId: schedule.employeeId,
        date: schedule.date,
        scheduleId: schedule.id,
        status: "INCOMPLETE",
        checkInStatus: "PENDING",
        checkOutStatus: "PENDING",
        source: "MANUAL",
      },
      update: {
        scheduleId: schedule.id,
      },
      select: { id: true, scheduleId: true, createdAt: true, updatedAt: true },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
    else if (result.scheduleId === schedule.id) updated += 1;
  }

  const total = schedules.length;
  console.log(`Backfill attendance done. total=${total}, created=${created}, updated=${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
