import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '../../../../server/src/schema';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUserId: number;
}

export function ChatPanel({ messages, onSendMessage, currentUserId }: ChatPanelProps) {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(messageText.trim());
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageAlignment = (message: ChatMessage) => {
    return message.user_id === currentUserId ? 'ml-auto' : 'mr-auto';
  };

  const getMessageColor = (message: ChatMessage) => {
    return message.user_id === currentUserId 
      ? 'bg-blue-500 text-white' 
      : 'bg-gray-200 text-gray-800';
  };

  return (
    <Card className="h-96">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          💬 Chat
          {messages.length > 0 && (
            <Badge variant="secondary">{messages.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-full">
        {/* Messages Area */}
        <ScrollArea className="flex-1 mb-4 pr-4">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                <div className="text-2xl mb-2">💭</div>
                <p>No messages yet.</p>
                <p>Say hello to start the conversation!</p>
              </div>
            ) : (
              messages.map((message: ChatMessage) => (
                <div key={message.id} className={`max-w-[80%] ${getMessageAlignment(message)}`}>
                  <div className={`px-3 py-2 rounded-lg text-sm ${getMessageColor(message)}`}>
                    <p>{message.message}</p>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 px-2">
                    {message.user_id === currentUserId ? 'You' : `Player #${message.user_id}`} • {formatTime(message.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            disabled={isSending}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!messageText.trim() || isSending}
            size="sm"
          >
            {isSending ? '...' : '📤'}
          </Button>
        </form>

        {/* Character Counter */}
        <div className="text-xs text-gray-500 mt-1 text-right">
          {messageText.length}/500
        </div>

        {/* Quick Messages */}
        <div className="flex flex-wrap gap-1 mt-2">
          {['Good luck! 🍀', 'Nice move! 👏', 'GG! 🎉'].map((quickMessage) => (
            <Button
              key={quickMessage}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setMessageText(quickMessage)}
              disabled={isSending}
            >
              {quickMessage}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}