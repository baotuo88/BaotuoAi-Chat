import { NextRequest, NextResponse } from "next/server";
import { listUsersWithUsage } from "@/lib/accounts/adminService";
import { requireAdmin } from "@/lib/accounts/requireAdmin";
import { createApiErrorResponse } from "@/lib/api/middleware";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const users = await listUsersWithUsage();
    return noStore(NextResponse.json({ ok: true, users }));
  } catch (error) {
    return noStore(createApiErrorResponse(error));
  }
}
