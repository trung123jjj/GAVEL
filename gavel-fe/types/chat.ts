export type ChatUser = {
  id: number;
  username: string;
  avatar: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: number;
  senderId: number;
  senderName: string;
  avatar: string | null;
  content: string;
  read: boolean;
  createdAt: string;
};

export type Conversation = {
  id: number;
  otherUser: ChatUser;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
};

export type ConversationDetail = {
  id: number;
  otherUser: ChatUser;
  messages: ChatMessage[];
};
