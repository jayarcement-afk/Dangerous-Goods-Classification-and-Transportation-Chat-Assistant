import { ChatPage } from "@/components/chat/chat-page";

type ChatPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ChatRoute({ searchParams }: ChatPageProps) {
  const { q } = await searchParams;
  return <ChatPage initialQuestion={q?.trim() ?? ""} />;
}
