import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/accounts/accountService";
import { isAccountsEnabled } from "@/lib/db/client";
import {
  ACCOUNT_SESSION_COOKIE,
  readAccountSessionCookie,
} from "@/lib/security/accountSession";
import { getQuotaStatus, resolveDailyQuota } from "@/lib/security/quota";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  if (!isAccountsEnabled()) {
    return noStore(NextResponse.json({ enabled: false, user: null }));
  }

  const cookieValue = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value;
  const session = await readAccountSessionCookie(cookieValue);
  if (!session) {
    return noStore(NextResponse.json({ enabled: true, user: null }));
  }

  const user = await findUserById(session.userId);
  if (!user || user.tokenVersion !== session.tokenVersion || user.disabled) {
    return noStore(NextResponse.json({ enabled: true, user: null }));
  }

  const limit = resolveDailyQuota(user.dailyQuota);
  const quota = await getQuotaStatus(user.id, limit);

  return noStore(
    NextResponse.json({
      enabled: true,
      user: { id: user.id, email: user.email },
      quota,
    }),
  );
}
