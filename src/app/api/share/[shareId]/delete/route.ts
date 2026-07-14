import { NextRequest, NextResponse } from "next/server";
import { appDb } from "@/store/storage/storageConfig";
import { requireUser } from "@/lib/api/requireUser";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { shareId: string } },
) {
  try {
    const user = await requireUser(request);
    const { shareId } = params;

    // Load shared chat
    const sharedChat = await appDb.sharedChats.get(shareId);
    if (!sharedChat) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Verify ownership
    if (sharedChat.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete share
    await appDb.sharedChats.delete(shareId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete share error:", error);
    return NextResponse.json(
      { error: "Failed to delete share" },
      { status: 500 },
    );
  }
}
