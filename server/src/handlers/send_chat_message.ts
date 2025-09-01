import { type SendMessageInput, type ChatMessage } from '../schema';

export const sendChatMessage = async (input: SendMessageInput): Promise<ChatMessage> => {
  // This is a placeholder declaration! Real code should be implemented here.
  // The goal of this handler is storing chat messages for a match,
  // validating message content, and broadcasting to connected players via WebSocket.
  return Promise.resolve({
    id: 0,
    match_id: input.match_id,
    user_id: input.user_id,
    message: input.message,
    created_at: new Date()
  });
};