import { Metadata } from "next";
import SharedChatView from "@/components/chat/SharedChatView";

interface PageProps {
  params: {
    locale: string;
    shareId: string;
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  return {
    title: `Shared Conversation - Baotuo Chat`,
    description: "View shared conversation",
  };
}

export default function SharedChatPage({ params }: PageProps) {
  return <SharedChatView shareId={params.shareId} />;
}
