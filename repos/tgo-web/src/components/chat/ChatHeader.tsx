import React from 'react';
import type { Chat, PlatformType } from '@/types';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import { TbBrain } from 'react-icons/tb';

import { getPlatformIconComponent, getPlatformLabel, toPlatformType, getPlatformColor } from '@/utils/platformUtils';

/**
 * Props for the ChatHeader component
 */
export interface ChatHeaderProps {
  /** The active chat to display in the header */
  activeChat: Chat;
}

/**
 * Chat header component displaying visitor name and platform icon
 * Memoized to prevent unnecessary re-renders
 */
const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({ activeChat }) => {
  const { t } = useTranslation();
  
  // 判断是否是 agent 会话（channelId 以 -agent 结尾）或 team 会话（channelId 以 -team 结尾）
  const isAgentChat = activeChat.channelId?.endsWith('-agent') ?? false;
  const isTeamChat = activeChat.channelId?.endsWith('-team') ?? false;
  
  // 获取显示名称
  const displayName = activeChat.channelInfo?.name || (
    isAgentChat 
      ? t('chat.header.agentFallback', '智能体')
      : isTeamChat
        ? t('chat.header.teamFallback', '智能体团队')
        : t('chat.header.visitorFallback', 'Visitor{{suffix}}', { suffix: String(activeChat.channelId || activeChat.id).slice(-4) })
  );
  
  return (
    <header className="px-6 py-3 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
          <span>{displayName}</span>
          {isAgentChat ? (
            <span title={t('chat.header.agentTooltip', '智能体会话')}>
              <Bot className="w-4 h-4 inline-block ml-1.5 -mt-0.5 text-purple-500 dark:text-purple-400" />
            </span>
          ) : isTeamChat ? (
            <span title={t('chat.header.teamTooltip', '团队会话')}>
              <TbBrain className="w-4 h-4 inline-block ml-1.5 -mt-0.5 text-green-500 dark:text-green-400" />
            </span>
          ) : (
            (() => {
              const extra: any = activeChat.channelInfo?.extra;
              const fromExtra: PlatformType | undefined = (extra && typeof extra === 'object' && 'platform_type' in extra)
                ? (extra.platform_type as PlatformType)
                : undefined;
              const type = fromExtra ?? toPlatformType(activeChat.platform);
              const IconComp = getPlatformIconComponent(type);
              const label = getPlatformLabel(type);
              return (
                <span title={label}>
                  <IconComp size={16} className={`w-3.5 h-3.5 inline-block ml-1 -mt-0.5 ${getPlatformColor(type)}`} />
                </span>
              );
            })()
          )}
        </h2>
      </div>
      {/* <div className="flex items-center space-x-2">
        <button className="p-1.5 text-gray-500 hover:bg-gray-200/50 rounded-md transition-colors duration-200">
          <img
            src="https://unpkg.com/lucide-static@latest/icons/ellipsis.svg"
            alt="More"
            className="w-5 h-5"
          />
        </button>
      </div> */}
    </header>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;
