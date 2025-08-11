import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { ChatService } from '../services/chatService';
import { ChatMessage, ChatState } from '../types/chat';
import { getStoredUid } from '../shared/firebase';
import { Tooltip } from './Tooltip';
// LLM-UI imports for future use
// import { useLLMOutput } from '@llm-ui/react';
// import { markdownLookBack } from '@llm-ui/markdown';
// import { codeBlockLookBack } from '@llm-ui/code';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatProps {
  boardId: string;
}

export const Chat: React.FC<ChatProps> = ({ boardId }) => {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileCount, setUploadedFileCount] = useState(0);
  const FILE_LIMIT = 5;

  const serviceRef = useRef(new ChatService());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const uid = getStoredUid() || 'anonymous';

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, scrollToBottom]);

  // Subscribe to real-time messages
  useEffect(() => {
    const unsubscribe = serviceRef.current.subscribeToMessages(
      boardId,
      (messages) => {
        setChatState(prev => ({
          ...prev,
          messages,
          isLoading: false,
        }));
      }
    );

    return unsubscribe;
  }, [boardId]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    setChatState(prev => ({ ...prev, isLoading: true }));

    try {
      await serviceRef.current.addTextMessage(boardId, uid, content);
      setInputValue('');
    } catch (error) {
      setChatState(prev => ({
        ...prev,
        error: 'Failed to send message',
        isLoading: false,
      }));
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (uploadedFileCount >= FILE_LIMIT) {
      setChatState(prev => ({
        ...prev,
        error: '5-file upload limit reached',
      }));
      return;
    }

    setIsUploading(true);
    setChatState(prev => ({ ...prev, isLoading: true }));

    try {
      const fileMetadata = await serviceRef.current.uploadFile(file, uid);
      await serviceRef.current.addFileMessage(boardId, uid, fileMetadata);
      setUploadedFileCount(prev => prev + 1);
    } catch (error) {
      setChatState(prev => ({
        ...prev,
        error: 'Failed to upload file',
        isLoading: false,
      }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleClearChat = useCallback(async () => {
    try {
      await serviceRef.current.clearAllMessages(boardId);
    } catch (error) {
      setChatState(prev => ({
        ...prev,
        error: 'Failed to clear chat'
      }));
    }
  }, [boardId]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate consistent colors for users based on their UID
  const getUserColor = (uid: string) => {
    const colors = [
      '#f8bbd9', // light pink
      '#d1ecf1', // light blue
      '#e8f5e8', // light green
      '#fff2cc', // light yellow
      '#e1d5e7', // light purple
      '#fadbd8', // light coral
      '#d5dbdb', // light gray
    ];

    // Create a simple hash from the UID to consistently assign colors
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  const getUserDisplayName = (uid: string) => {
    return uid.substring(0, 5);
  };

  const renderFileMessage = (message: ChatMessage) => {
    const { fileMetadata } = message;
    if (!fileMetadata) return null;

    const isImage = fileMetadata.type.startsWith('image/');

    return (
      <div className="file-message">
        {isImage ? (
          <Image
            src={fileMetadata.url}
            alt={fileMetadata.name}
            className="file-preview-image"
            style={{ borderRadius: '8px' }}
            width={200}
            height={150}
          />
        ) : (
          <a
            href={fileMetadata.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-800 hover:text-gray-600 text-sm cursor-pointer"
          >
            📎 {fileMetadata.name}
          </a>
        )}
      </div>
    );
  };

  const MessageContent: React.FC<{ message: ChatMessage }> = ({ message }) => {
    if (message.type === 'file') {
      return (
        <div className="message-content">
          {renderFileMessage(message)}
        </div>
      );
    }

    // For regular text messages, use ReactMarkdown with enhanced rendering
    return (
      <div className="message-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-white flex justify-between items-center flex-shrink-0" style={{ borderBottom: '1px solid #fecdd3' }}>
        <h3 className="text-base font-medium text-gray-800">
          💬 Chat
        </h3>
        <div className="flex items-center gap-3">
          {chatState.isLoading && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#f43f5e' }}>
              <div className="animate-pulse">💬</div>
              <span>Sending...</span>
            </div>
          )}
          {/* Clear Chat Button */}
          <button
            onClick={handleClearChat}
            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white font-medium text-xs rounded-md shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 hover:scale-105"
            title="Clear all messages"
          >
            <span className="text-white">🗑</span> Clear
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 bg-white p-3">
        {chatState.messages.map((message) => (
          <div key={message.id} className="w-full">
            {/* User ID and Timestamp */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-600">
                {getUserDisplayName(message.uid)}
              </span>
              <span className="text-xs text-gray-500" style={{ fontSize: '10px' }}>
                {formatTimestamp(message.timestamp)}
              </span>
            </div>

            {/* Message Balloon */}
            <div
              className="max-w-[300px] text-sm text-gray-800 shadow-sm"
              style={{
                backgroundColor: getUserColor(message.uid),
                marginBottom: '16px',
                borderRadius: '20px',
                padding: '2px 3px'
              }}
            >
              <MessageContent message={message} />
            </div>
          </div>
        ))}

        {chatState.error && (
          <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm">
            <span>❌</span>
            <span>{chatState.error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50 px-4 py-5 flex-shrink-0">
        {/* Message Input with File Upload */}
        <div className="w-full flex items-center gap-3">

          {/* Textarea Input */}
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none overflow-y-auto shadow-sm"
            disabled={chatState.isLoading}
            style={{ minHeight: '36px', maxHeight: '60px' }}
          />

          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            {/* File Upload Button */}
            {uploadedFileCount >= FILE_LIMIT ? (
              <Tooltip content="5-file upload limit reached" position="top">
                <button
                  disabled={true}
                  className="p-2 text-gray-400 border border-gray-300 rounded-md text-sm cursor-not-allowed bg-white shadow-sm"
                  title="Upload limit reached"
                >
                  🚫
                </button>
              </Tooltip>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2 text-gray-600 border border-gray-300 rounded-md text-sm hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
                title={`Upload file (${uploadedFileCount}/${FILE_LIMIT} used)`}
              >
                {isUploading ? '⏳' : '📎'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
            />
            {/* Send Button */}
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={chatState.isLoading || !inputValue.trim()}
              className="w-9 h-9 text-white rounded-md flex items-center justify-center transition-colors focus:outline-none disabled:cursor-not-allowed text-sm shadow-sm"
              style={{
                backgroundColor: chatState.isLoading || !inputValue.trim() ? '#d1d5db' : '#fb7185'
              }}
              onMouseEnter={(e) => {
                if (!chatState.isLoading && inputValue.trim()) {
                  e.currentTarget.style.backgroundColor = '#f43f5e';
                }
              }}
              onMouseLeave={(e) => {
                if (!chatState.isLoading && inputValue.trim()) {
                  e.currentTarget.style.backgroundColor = '#fb7185';
                }
              }}
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
