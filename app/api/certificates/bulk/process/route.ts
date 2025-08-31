import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
// Using require to avoid type resolution issues at build time
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { processBulkJob } = require("@/scripts/process-bulk-job");
import { z } from "zod";

const schema = z.object({ jobId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Validation failed" }, { status: 400 });

  // Fire-and-forget processing; in production use a job queue
  processBulkJob(parsed.data.jobId).catch(() => {});
  return NextResponse.json({ message: "Processing started" });
}


