import React from 'react';
import MarkdownContent from '../MarkdownContent';
import type { Message } from '@/types';
import { MessagePayloadType } from '@/types';

/**
 * Streaming cursor animation component
 */
const StreamingCursor: React.FC<{ isWhite?: boolean }> = ({ isWhite }) => (
  <span
    className={`inline-block w-2 h-4 ml-0.5 animate-pulse ${
      isWhite ? 'bg-white/80' : 'bg-gray-500 dark:bg-gray-400'
    }`}
    style={{ verticalAlign: 'text-bottom' }}
  />
);

/**
 * TextMessage renders plain text messages.
 */
export interface MessageComponentProps {
  message: Message;
  isStaff: boolean; // true for staff (right), false for visitor (left)
}

const TextMessage: React.FC<MessageComponentProps> = ({ message, isStaff }) => {
  const typedPayload = message.payload as any | undefined;
  // Prefer message.content for streaming updates; fall back to payload content
  const textContent: string =
    (typeof message.content === 'string' && message.content.length > 0)
      ? message.content
      : ((typedPayload?.type === MessagePayloadType.TEXT && typeof typedPayload?.content === 'string')
          ? typedPayload.content
          : '');

  // Render streamed markdown only when has_stream_data flag exists
  const hasStreamData = Boolean(message.metadata?.has_stream_data);
  const shouldRenderMarkdown = hasStreamData;

  // Check if message is still streaming (AI response in progress)
  const isStreaming = Boolean(message.metadata?.is_streaming);

  const hasLink = (message as any).hasLink;

  if (isStaff) {
    return (
      <div className="bg-blue-500 dark:bg-blue-600 text-white p-3 rounded-lg rounded-tr-none shadow-sm overflow-hidden max-w-full">
        {shouldRenderMarkdown ? (
          <>
            <MarkdownContent content={textContent} className="text-sm markdown-white" />
            {isStreaming && <StreamingCursor isWhite />}
          </>
        ) : (
          <p className="text-sm break-words">
            {hasLink ? (
              <>
                {textContent.split('耳机连接指南')[0]}
                <a href="#" className="underline">耳机连接指南</a>
              </>
            ) : (
              textContent
            )}
            {isStreaming && <StreamingCursor isWhite />}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg rounded-tl-none shadow-sm border border-gray-100 dark:border-gray-600 overflow-hidden max-w-full">
      {shouldRenderMarkdown ? (
        <>
          <MarkdownContent content={textContent} className="text-sm dark:text-gray-200" />
          {isStreaming && <StreamingCursor />}
        </>
      ) : (
        <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
          {textContent}
          {isStreaming && <StreamingCursor />}
        </p>
      )}
    </div>
  );
};

export default TextMessage;

