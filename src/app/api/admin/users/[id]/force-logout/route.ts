import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/accounts/requireAdmin";
import { forceUserLogout } from "@/lib/accounts/adminService";
import { createApiErrorResponse } from "@/lib/api/middleware";
import { ApiError } from "@/lib/errors";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    const updated = await forceUserLogout(id);
    if (!updated) {
      throw new ApiError("User not found.", 404, "USER_NOT_FOUND");
    }

    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return noStore(createApiErrorResponse(error));
  }
}
