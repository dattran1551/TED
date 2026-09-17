export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: number
  conversationId: number
  role: ChatRole
  content: string
  createdAt: string
}

export interface ChatConversation {
  id: number
  createdAt: string
  messages: ChatMessage[]
}

export interface ChatConversationSummary {
  id: number
  createdAt: string
  preview: string
}
