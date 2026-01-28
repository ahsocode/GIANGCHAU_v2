import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type IncomingLog = {
  deviceCode?: string;
  userCode: string;
  epochMs: number;
  verifyType?: string | null;
  inOut?: string | null;
  raw?: unknown;
  userSn?: number | null;
  deviceIp?: string | null;
};

function makeDedupeKey(x: {
  deviceCode: string;
  userCode: string;
  epochMs: number;
  verifyType?: string | null;
  inOut?: string | null;
}) {
  return [x.deviceCode, x.userCode, x.epochMs, x.verifyType ?? "", x.inOut ?? ""].join("|");
}

function normalizeRaw(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ATTENDANCE_API_KEY;
    if (apiKey) {
      const header = req.headers.get("x-api-key");
      if (header !== apiKey) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = (await req.json()) as {
      deviceCode?: string;
      machineId?: number | string | null;
      logs?: IncomingLog[];
    };

    const rootDeviceCode = String(body.deviceCode || "");
    const machineId = body.machineId != null ? Number(body.machineId) : null;
    const logs: IncomingLog[] = Array.isArray(body.logs) ? body.logs : [];

    if (!rootDeviceCode || logs.length === 0) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const data = logs
      .map((log) => {
        const deviceCode = String(log.deviceCode || rootDeviceCode);
        const deviceUserCode = String(log.userCode || "");
        const epochMsNum = Number(log.epochMs);

        if (!deviceCode || !deviceUserCode || !Number.isFinite(epochMsNum)) return null;

        const occurredAt = new Date(epochMsNum);
        const dedupeKey = makeDedupeKey({
          deviceCode,
          userCode: deviceUserCode,
          epochMs: epochMsNum,
          verifyType: log.verifyType ?? null,
          inOut: log.inOut ?? null,
        });

        return {
          deviceCode,
          machineId,
          deviceIp: log.deviceIp ?? null,
          deviceUserCode,
          userSn: log.userSn ?? null,
          epochMs: BigInt(epochMsNum),
          occurredAt,
          verifyType: log.verifyType ?? null,
          inOut: log.inOut ?? null,
          dedupeKey,
          raw: normalizeRaw(log.raw),
        };
      })
      .filter(Boolean) as Array<{
      deviceCode: string;
      machineId: number | null;
      deviceIp: string | null;
      deviceUserCode: string;
      userSn: number | null;
      epochMs: bigint;
      occurredAt: Date;
      verifyType: string | null;
      inOut: string | null;
      dedupeKey: string;
      raw: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    }>;

    if (data.length === 0) {
      return NextResponse.json({ ok: true, received: logs.length, inserted: 0, skipped: logs.length });
    }

    const CHUNK_SIZE = 500;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      await prisma.$transaction(
        chunk.map((item) =>
          prisma.attendanceMachineEvent.upsert({
            where: { dedupeKey: item.dedupeKey },
            create: item,
            update: item,
          })
        )
      );
    }

    return NextResponse.json({
      ok: true,
      received: logs.length,
      inserted: data.length,
      skipped: logs.length - data.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
