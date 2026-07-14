import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/accounts/requireAdmin";
import { resetUserPassword } from "@/lib/accounts/adminService";
import { createApiErrorResponse, readJsonRequestBody } from "@/lib/api/middleware";
import { AdminResetPasswordSchema } from "@/lib/api/schemas";
import { ApiError } from "@/lib/errors";
import { hashPassword } from "@/lib/security/passwordHash";

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
    const body = await readJsonRequestBody(request);
    const parsed = AdminResetPasswordSchema.parse(body);

    const passwordHash = await hashPassword(parsed.password);
    const updated = await resetUserPassword(id, passwordHash);
    if (!updated) {
      throw new ApiError("User not found.", 404, "USER_NOT_FOUND");
    }

    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return noStore(createApiErrorResponse(error));
  }
}
