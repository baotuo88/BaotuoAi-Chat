import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/accounts/requireAdmin";
import {
  isRegistrationEnabled,
  setRegistrationEnabled,
} from "@/lib/accounts/appSettingsService";
import { createApiErrorResponse, readJsonRequestBody } from "@/lib/api/middleware";
import { AdminUpdateSettingsSchema } from "@/lib/api/schemas";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const registrationEnabled = await isRegistrationEnabled();
    return noStore(NextResponse.json({ ok: true, registrationEnabled }));
  } catch (error) {
    return noStore(createApiErrorResponse(error));
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await readJsonRequestBody(request);
    const parsed = AdminUpdateSettingsSchema.parse(body);
    await setRegistrationEnabled(parsed.registrationEnabled);
    return noStore(
      NextResponse.json({
        ok: true,
        registrationEnabled: parsed.registrationEnabled,
      }),
    );
  } catch (error) {
    return noStore(createApiErrorResponse(error));
  }
}
