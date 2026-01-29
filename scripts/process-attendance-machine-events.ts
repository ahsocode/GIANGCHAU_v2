import "dotenv/config";
import { processAttendanceMachineEvents } from "../lib/attendance-machine";
import { prisma } from "../lib/prisma";

const BATCH_SIZE = 5000;

async function main() {
  const result = await processAttendanceMachineEvents({ batchSize: BATCH_SIZE });

  console.log(
    `Process attendance events done. batches=${result.batches}, lastEpochMs=${result.lastEpochMs}, skippedNoMapping=${result.skippedNoMapping}`
  );
  if (result.skippedNoMapping > 0) {
    console.warn(`Skipped ${result.skippedNoMapping} machine events due to missing mapping.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
