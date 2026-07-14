import { NextRequest, NextResponse } from "next/server";
import { appDb } from "@/store/storage/storageConfig";

export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } },
) {
  try {
    const { shareId } = params;

    // Load shared chat from IndexedDB
    const sharedChat = await appDb.sharedChats.get(shareId);
    if (!sharedChat) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Check expiration
    if (sharedChat.expiresAt && Date.now() > sharedChat.expiresAt) {
      return NextResponse.json({ error: "Share has expired" }, { status: 410 });
    }

    // Increment view count
    await appDb.sharedChats.update(shareId, {
      viewCount: sharedChat.viewCount + 1,
    });

    return NextResponse.json({
      title: sharedChat.title,
      messages: sharedChat.messages,
      model: sharedChat.model,
      createdAt: sharedChat.createdAt,
    });
  } catch (error) {
    console.error("Get share error:", error);
    return NextResponse.json(
      { error: "Failed to load share" },
      { status: 500 },
    );
  }
}
