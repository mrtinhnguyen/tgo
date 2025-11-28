import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Chat } from '@/types';
import { PlatformType } from '@/types';
import { DEFAULT_CHANNEL_TYPE } from '@/constants';
import { getChannelKey } from '@/utils/channelUtils';
import { useChannelStore } from '@/stores/channelStore';
import { useChatStore } from '@/stores';
import { toPlatformType } from '@/utils/platformUtils';
import { formatWeChatConversationTime } from '@/utils/timeFormatting';
import { ChatAvatar } from './ChatAvatar';
import { ChatPlatformIcon } from './ChatPlatformIcon';
import { ChatTags } from './ChatTags';
import { Bot } from 'lucide-react';
import { TbBrain } from 'react-icons/tb';

export interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: (chat: Chat) => void;
}

/**
 * Individual chat list item in the sidebar list. Memoized for performance.
 */
export const ChatListItem: React.FC<ChatListItemProps> = React.memo(({ chat, isActive, onClick }) => {
  const channelId = chat.channelId;
  const channelType = chat.channelType ?? DEFAULT_CHANNEL_TYPE;
  
  // 判断是否是 agent 会话（channelId 以 -agent 结尾）或 team 会话（channelId 以 -team 结尾）
  const isAgentChat = channelId?.endsWith('-agent') ?? false;
  const isTeamChat = channelId?.endsWith('-team') ?? false;

  const displayName = chat.channelInfo?.name || (
    isAgentChat 
      ? '智能体' 
      : isTeamChat 
        ? '智能体团队' 
        : `访客${String(channelId || chat.id).slice(-4)}`
  );
  const displayAvatar = chat.channelInfo?.avatar || '';

  const compositeKey = useMemo(() => {
    if (!channelId || channelType == null) return null;
    return getChannelKey(channelId, channelType);
  }, [channelId, channelType]);

  const channelInfoCache = useChannelStore(state => (channelId && channelType != null ? state.getChannel(channelId, channelType) : undefined));
  const isChannelFetching = useChannelStore(state => (compositeKey ? Boolean(state.inFlight[compositeKey]) : false));
  const channelStoreError = useChannelStore(state => (compositeKey ? state.errors[compositeKey] : null));
  const ensureChannelInfo = useChannelStore(state => state.ensureChannel);

  useEffect(() => {
    if (!channelId || channelType == null) return;
    if (channelInfoCache || isChannelFetching || channelStoreError) return;
    ensureChannelInfo({ channel_id: channelId, channel_type: channelType })
      .then(info => { if (info) { useChatStore.getState().applyChannelInfo(channelId, channelType, info); } })
      .catch(() => {});
  }, [channelId, channelType, channelInfoCache, isChannelFetching, channelStoreError, ensureChannelInfo]);

  const handleClick = useCallback(() => { onClick(chat); }, [onClick, chat]);

  // Unread fade-out animation when transitioning from >0 to 0
  const prevUnreadRef = useRef<number>(chat.unreadCount);
  const [fadeOut, setFadeOut] = useState(false);
  useEffect(() => {
    let tid: ReturnType<typeof setTimeout> | null = null;
    const prev = prevUnreadRef.current;
    if (prev > 0 && chat.unreadCount === 0) {
      setFadeOut(true);
      tid = setTimeout(() => {
        setFadeOut(false);
        prevUnreadRef.current = chat.unreadCount;
      }, 220);
    } else {
      prevUnreadRef.current = chat.unreadCount;
    }
    return () => { if (tid) clearTimeout(tid); };
  }, [chat.unreadCount]);
  const unreadToDisplay = chat.unreadCount > 0 ? chat.unreadCount : prevUnreadRef.current;

  return (
    <div
      className={`
        flex items-center p-3 rounded-lg cursor-pointer transition-colors duration-150
        ${isActive ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-100/70 dark:hover:bg-gray-700/70'}
      `}
      onClick={handleClick}
    >
      <ChatAvatar
        displayName={displayName}
        displayAvatar={displayAvatar}
        visitorStatus={chat.visitorStatus}
        lastSeenMinutes={chat.lastSeenMinutes}
      />

      <div className="flex-grow overflow-hidden">
        <div className="flex justify-between items-center">
          <h3 className={`text-sm font-semibold truncate flex items-center ${isActive ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
            <span className="truncate">{displayName}</span>
            {isAgentChat ? (
              <Bot className={`w-3.5 h-3.5 ml-1 flex-shrink-0 ${isActive ? 'text-blue-100' : 'text-purple-500 dark:text-purple-400'}`} />
            ) : isTeamChat ? (
              <TbBrain className={`w-3.5 h-3.5 ml-1 flex-shrink-0 ${isActive ? 'text-blue-100' : 'text-green-500 dark:text-green-400'}`} />
            ) : (
              <ChatPlatformIcon platformType={(() => {
                const extra: any = chat.channelInfo?.extra;
                const fromExtra: PlatformType | undefined = (extra && typeof extra === 'object' && 'platform_type' in extra)
                  ? (extra.platform_type as PlatformType)
                  : undefined;
                return fromExtra ?? toPlatformType(chat.platform);
              })()} />
            )}
          </h3>
          <span className={`text-xs flex-shrink-0 ml-2 ${isActive ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
            {formatWeChatConversationTime(chat.timestamp)}
          </span>
        </div>

        <div className="flex justify-between items-center mt-1">
          <p className={`text-xs truncate flex-1 ${isActive ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>{chat.lastMessage}</p>
          {(chat.unreadCount > 0 || fadeOut) && (
            <div className={`min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center px-1 flex-shrink-0 ml-2 transition-opacity duration-200 ${fadeOut && chat.unreadCount === 0 ? 'opacity-0' : 'opacity-100'}`}>
              {unreadToDisplay > 99 ? '99+' : unreadToDisplay}
            </div>
          )}
        </div>

        <ChatTags tags={chat.tags || []} isActive={isActive} />
      </div>
    </div>
  );
});

ChatListItem.displayName = 'ChatListItem';

