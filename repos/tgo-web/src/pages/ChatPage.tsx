import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ChatList from '../components/layout/ChatList';
import ChatWindow from '../components/layout/ChatWindow';
import VisitorPanel from '../components/layout/VisitorPanel';
import { useChatStore, chatSelectors } from '@/stores';
import { getChannelKey } from '@/utils/channelUtils';

/**
 * Chat page component - contains the original chat interface
 */
interface ChatPageLocationState {
  agentName?: string;
  agentAvatar?: string;
  platform?: string;
}

const ChatPage: React.FC = () => {
  const { channelType: urlChannelType, channelId: urlChannelId } = useParams<{ channelType: string; channelId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as ChatPageLocationState | null;
  
  const activeChat = useChatStore(chatSelectors.activeChat);
  const setActiveChat = useChatStore(state => state.setActiveChat);
  const chats = useChatStore(state => state.chats);
  const syncConversationsIfNeeded = useChatStore(state => state.syncConversationsIfNeeded);
  const loadHistoricalMessages = useChatStore(state => state.loadHistoricalMessages);
  const clearConversationUnread = useChatStore(state => state.clearConversationUnread);

  // Track if we're syncing from URL to prevent loops
  const isSyncingFromUrl = useRef(false);
  // Track if initial URL sync has been attempted
  const hasAttemptedUrlSync = useRef(false);

  // 页面加载时仅在未同步过时同步对话（之后由 WebSocket 实时消息更新）
  useEffect(() => {
    syncConversationsIfNeeded();
  }, [syncConversationsIfNeeded]);

  const createChatByChannel = useChatStore(state => state.createChatByChannel);
  const isSyncing = useChatStore(state => state.isSyncing);

  // 从 URL 参数定位会话（仅在 URL 变化或同步完成时执行一次）
  useEffect(() => {
    // Only attempt URL sync once per URL change, after sync is complete
    if (urlChannelType && urlChannelId && !isSyncing && !hasAttemptedUrlSync.current) {
      hasAttemptedUrlSync.current = true;
      const targetChannelType = parseInt(urlChannelType, 10);
      
      // 使用 getState() 获取最新的 chats，避免依赖 chats 数组导致重复触发
      const currentChats = useChatStore.getState().chats;
      const currentActiveChat = useChatStore.getState().activeChat;
      
      // 如果当前 activeChat 已经是目标会话，不需要再设置
      if (currentActiveChat?.channelId === urlChannelId && currentActiveChat?.channelType === targetChannelType) {
        return;
      }
      
      const targetChat = currentChats.find(
        c => c.channelId === urlChannelId && c.channelType === targetChannelType
      );
      
      if (targetChat) {
        // Found the chat, select it
        isSyncingFromUrl.current = true;
        setActiveChat(targetChat);
        loadHistoricalMessages(targetChat.channelId, targetChat.channelType);
        // Clear unread
        if ((targetChat.unreadCount || 0) > 0) {
          clearConversationUnread(targetChat.channelId, targetChat.channelType);
        }
        isSyncingFromUrl.current = false;
      } else {
        // Chat not found, create a new one
        isSyncingFromUrl.current = true;
        const newChat = createChatByChannel(urlChannelId, targetChannelType, {
          platform: locationState?.platform,
          name: locationState?.agentName,
          avatar: locationState?.agentAvatar
        });
        setActiveChat(newChat);
        loadHistoricalMessages(urlChannelId, targetChannelType);
        isSyncingFromUrl.current = false;
      }
    }
  }, [urlChannelType, urlChannelId, isSyncing, setActiveChat, loadHistoricalMessages, clearConversationUnread, createChatByChannel, locationState]);

  // Reset URL sync flag when URL params change
  useEffect(() => {
    hasAttemptedUrlSync.current = false;
  }, [urlChannelType, urlChannelId]);

  // 设置默认活跃聊天（仅当没有 URL 参数时）
  useEffect(() => {
    // If URL has params, don't auto-select first chat
    if (urlChannelType && urlChannelId) return;
    
    if (!activeChat && chats.length > 0) {
      const firstChat = chats[0];
      setActiveChat(firstChat);
      // Update URL for the default chat
      navigate(`/chat/${firstChat.channelType}/${firstChat.channelId}`, { replace: true });
    }
  }, [activeChat, chats, setActiveChat, urlChannelType, urlChannelId, navigate]);

  const handleChatSelect = (chat: any): void => {
    const prev = activeChat;

    // Clear unread for the conversation we're leaving (if different)
    if (prev && !(prev.channelId === chat.channelId && prev.channelType === chat.channelType)) {
      const prevInList = chats.find(c => c.channelId === prev.channelId && c.channelType === prev.channelType);
      if ((prevInList?.unreadCount || 0) > 0) {
        clearConversationUnread(prev.channelId, prev.channelType);
      }
    }

    // Clear unread for the clicked/active conversation
    const clickedInList = chats.find(c => c.channelId === chat.channelId && c.channelType === chat.channelType);
    if ((clickedInList?.unreadCount || 0) > 0) {
      clearConversationUnread(chat.channelId, chat.channelType);
    }

    setActiveChat(chat);
    
    // Update URL with the selected chat's channel info
    if (chat.channelId && chat.channelType != null) {
      navigate(`/chat/${chat.channelType}/${chat.channelId}`, { replace: true });
      loadHistoricalMessages(chat.channelId, chat.channelType);
    }
  };


  // When returning focus to the tab/window, clear unread for the currently open conversation
  useEffect(() => {
    const onFocus = () => {
      const { activeChat: cur, chats: curChats, clearConversationUnread: clearFn } = useChatStore.getState() as any;
      if (cur?.channelId && cur.channelType != null) {
        const found = curChats.find((c: any) => c.channelId === cur.channelId && c.channelType === cur.channelType);
        if ((found?.unreadCount || 0) > 0) {
          clearFn(cur.channelId, cur.channelType);
        }
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // 判断当前会话是否是 agent 会话（channelId 以 -agent 结尾）或 team 会话（channelId 以 -team 结尾）
  const isAgentChat = activeChat?.channelId?.endsWith('-agent') ?? false;
  const isTeamChat = activeChat?.channelId?.endsWith('-team') ?? false;
  const isAIChat = isAgentChat || isTeamChat;

  return (
    <div className="flex h-full w-full bg-gray-50 dark:bg-gray-900">
      {/* Chat List */}
      <ChatList
        activeChat={activeChat}
        onChatSelect={handleChatSelect}
      />

      {/* Main Chat Window */}
      <ChatWindow
        key={activeChat ? getChannelKey(activeChat.channelId, activeChat.channelType) : 'no-active'}
        activeChat={activeChat}
      />

      {/* Visitor Info Panel - 仅在非 AI 会话（非 agent 和非 team）时显示 */}
      {!isAIChat && <VisitorPanel activeChat={activeChat} />}
    </div>
  );
};

export default ChatPage;
