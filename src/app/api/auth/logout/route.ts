import { NextResponse } from "next/server";
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_UID_COOKIE,
} from "@/lib/security/accountSession";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST() {
  const response = noStore(NextResponse.json({ ok: true }));
  response.cookies.set(ACCOUNT_SESSION_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
  // Clear the non-httpOnly companion uid cookie too (matching attributes).
  response.cookies.set(ACCOUNT_UID_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
