import Dexie, { type Table } from "dexie";
import type { SharedChat } from "@/types/share";

export class ShareDatabase extends Dexie {
  sharedChats!: Table<SharedChat, string>;

  constructor() {
    super("BaotuoChatShares");
    this.version(1).stores({
      sharedChats: "id, sessionId, userId, createdAt, expiresAt",
    });
  }
}

export const shareDb = new ShareDatabase();
