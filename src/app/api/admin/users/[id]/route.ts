import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/accounts/requireAdmin";
import {
  updateUserDisabled,
  updateUserQuota,
} from "@/lib/accounts/adminService";
import { createApiErrorResponse, readJsonRequestBody } from "@/lib/api/middleware";
import { AdminUpdateUserSchema } from "@/lib/api/schemas";
import { ApiError } from "@/lib/errors";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const body = await readJsonRequestBody(request);
    const parsed = AdminUpdateUserSchema.parse(body);

    // Guard: an admin must not be able to disable their own account, which
    // would immediately lock them out of the panel they're acting from.
    if (id === admin.id && parsed.disabled === true) {
      throw new ApiError(
        "You cannot disable your own account.",
        400,
        "CANNOT_DISABLE_SELF",
      );
    }

    let updated = null;
    if (parsed.dailyQuota !== undefined) {
      updated = await updateUserQuota(id, parsed.dailyQuota);
    }
    if (parsed.disabled !== undefined) {
      updated = await updateUserDisabled(id, parsed.disabled);
    }

    if (!updated) {
      throw new ApiError("User not found.", 404, "USER_NOT_FOUND");
    }

    return noStore(
      NextResponse.json({
        ok: true,
        user: {
          id: updated.id,
          email: updated.email,
          disabled: updated.disabled,
          dailyQuota: updated.dailyQuota,
        },
      }),
    );
  } catch (error) {
    return noStore(createApiErrorResponse(error));
  }
}
