import { NextRequest, NextResponse } from "next/server";
import { appDb } from "@/store/storage/storageConfig";
import { v7 as uuidv7 } from "uuid";
import type { CreateShareRequest, SharedChat } from "@/types/share";
import { requireUser } from "@/lib/api/requireUser";
import { getActiveMessagePath } from "@/lib/chat/messageTree";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = (await request.json()) as CreateShareRequest;
    const { sessionId, expiresIn } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    // Load session from IndexedDB
    const session = await appDb.sessions.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify ownership
    if (session.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Load messages
    const messageTree = await appDb.messageTrees.get(sessionId);
    if (!messageTree) {
      return NextResponse.json(
        { error: "No messages found" },
        { status: 404 },
      );
    }

    // Get active message path
    const activePath = getActiveMessagePath(messageTree);
    const messages = activePath.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    }));

    // Create share record
    const shareId = uuidv7();
    const sharedChat: SharedChat = {
      id: shareId,
      sessionId,
      userId: user.id,
      title: session.title,
      messages,
      model: session.model,
      createdAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
      viewCount: 0,
    };

    // Save to IndexedDB
    await appDb.sharedChats.add(sharedChat);

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/share/${shareId}`;

    return NextResponse.json({
      shareId,
      shareUrl,
    });
  } catch (error) {
    console.error("Create share error:", error);
    return NextResponse.json(
      { error: "Failed to create share" },
      { status: 500 },
    );
  }
}
