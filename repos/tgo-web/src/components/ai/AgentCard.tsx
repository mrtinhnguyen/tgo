import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, ChevronDown, ChevronUp, Wrench, MessageCircle } from 'lucide-react';
import AgentToolTag from '@/components/ui/AgentToolTag';
import KnowledgeBaseTag from '@/components/ui/KnowledgeBaseTag';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { generateDefaultAvatar, hasValidAvatar } from '@/utils/avatarUtils';
import { useAIStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import type { Agent, AgentToolResponse } from '@/types';
// Removed extra MCP tool tags to avoid duplication on cards

interface AgentCardProps {
  agent: Agent;
  onAction: (actionType: string, agent: Agent) => void;
  onToolClick?: (tool: AgentToolResponse) => void;
}

/**
 * Agent card component displaying agent information and actions
 */
const AgentCard: React.FC<AgentCardProps> = ({ agent, onAction, onToolClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAllCollections, setShowAllCollections] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get store functions and toast
  const { deleteAgent } = useAIStore();
  const { showToast } = useToast();

  // Navigate to chat with this agent
  const handleChatWithAgent = (): void => {
    // Channel type 1 for agent chat, channel ID is agent.id + "-agent"
    const channelId = `${agent.id}-agent`;
    navigate(`/chat/1/${channelId}`, {
      state: {
        agentName: agent.name,
        agentAvatar: agent.avatar,
        platform: 'agent'
      }
    });
  };

  const handleAction = (actionType: string): void => {
    if (actionType === 'delete') {
      setShowDeleteConfirm(true);
    } else {
      onAction?.(actionType, agent);
    }
  };

  const handleDeleteAgent = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await deleteAgent(agent.id);
      showToast('success', t('agents.messages.deleteSuccess', '删除成功'), t('agents.messages.deleteSuccessDesc', `智能体 "${agent.name}" 已删除`, { name: agent.name }));
      setShowDeleteConfirm(false);
      // Optionally notify parent component about the deletion
      onAction?.('deleted', agent);
    } catch (error) {
      console.error('Failed to delete agent:', error);
      showToast('error', t('agents.messages.deleteFailed', '删除失败'), t('agents.messages.deleteFailedDesc', '删除智能体时发生错误'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToolClick = (tool: AgentToolResponse): void => {
    onToolClick?.(tool);
  };

  // Only display AgentToolResponse-based tags here to prevent duplication

  // Check if agent has a valid avatar URL
  const hasValidAvatarUrl = hasValidAvatar(agent.avatar);

  // Generate default avatar if needed
  const defaultAvatar = !hasValidAvatarUrl ? generateDefaultAvatar(agent.name) : null;

  const getStatusIndicator = (status: string): { color: string; title: string } => {
    switch (status) {
      case 'active':
        return { color: 'bg-green-500', title: t('agents.card.status.active', '运行中') };
      case 'inactive':
        return { color: 'bg-gray-400', title: t('agents.card.status.inactive', '已停止') };
      case 'error':
        return { color: 'bg-red-500', title: t('agents.card.status.error', '错误') };
      default:
        return { color: 'bg-gray-400', title: t('agents.card.status.unknown', '未知') };
    }
  };

  const statusIndicator = getStatusIndicator(agent.status);

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg p-5 flex flex-col justify-between shadow-sm border border-gray-200/60 dark:border-gray-700">
      <div>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {hasValidAvatarUrl ? (
                <img
                  src={agent.avatar}
                  alt={agent.name}
                  className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600"
                  onError={(e) => {
                    // If image fails to load, hide it and show default avatar
                    e.currentTarget.style.display = 'none';
                    const defaultAvatarElement = e.currentTarget.nextElementSibling as HTMLElement;
                    if (defaultAvatarElement) {
                      defaultAvatarElement.style.display = 'flex';
                    }
                  }}
                />
              ) : null}

              {/* Default avatar - shown when no valid avatar or image load fails */}
              <div
                className={`w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-sm border border-gray-200 dark:border-gray-600 ${
                  hasValidAvatarUrl ? 'hidden' : ''
                } ${defaultAvatar?.colorClass || 'bg-gradient-to-br from-gray-400 to-gray-500'}`}
                style={{ display: hasValidAvatarUrl ? 'none' : 'flex' }}
              >
                {defaultAvatar?.letter || '?'}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">{agent.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{agent.role || t('agents.card.defaultRole', '智能体')}</p>
            </div>
          </div>
          <div className="flex items-center">
            <span
              className={`w-2.5 h-2.5 ${statusIndicator.color} rounded-full flex-shrink-0`}
              title={statusIndicator.title}
            ></span>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3 h-16 overflow-hidden text-ellipsis">
          {agent.description}
        </p>

        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          <p>{t('agents.card.llmLabel', 'LLM')}: <span className="font-mono text-gray-700 dark:text-gray-200">{agent.llmModel || 'gemini-1.5-pro'}</span></p>
        </div>

        {/* 工具显示（紧凑，可展开） */}
        <div className="mb-1">
          {agent.tools && agent.tools.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {/* Display up to 3 tools by default, or all if showAllTools is true */}
              {(showAllTools ? agent.tools : agent.tools.slice(0, 3)).map((tool) => (
                <AgentToolTag
                  key={tool.id}
                  tool={tool}
                  onClick={handleToolClick}
                  size="xs"
                  showIcon={true}
                />
              ))}

              {/* Show "View More" button if there are more than 3 tools */}
              {agent.tools.length > 3 && (
                <button
                  onClick={() => setShowAllTools(!showAllTools)}
                  className="inline-flex items-center rounded-md border bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700 px-1.5 py-0.5 text-[11px] hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  {showAllTools ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-0.5" />
                      {t('agents.actions.collapse', '收起')}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-0.5" />
                      {t('agents.actions.viewMore', '查看更多')} (+{agent.tools.length - 3})
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center text-gray-400 dark:text-gray-500">
              <Wrench className="w-4 h-4 mr-2 opacity-50" />
              <span className="text-[12px]">{t('agents.card.noTools', '未关联工具')}</span>
            </div>
          )}
        </div>

        {/* MCP tool tags removed on cards; detailed view still shows extras if needed */}

        {/* 知识库标签（紧凑，区分颜色） */}
        <div className="mt-1">
          {agent.collections && agent.collections.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {/* Display up to 5 collections by default, or all if showAllCollections is true */}
              {(showAllCollections ? agent.collections : agent.collections.slice(0, 5)).map((collection) => {
                // Extract icon from collection metadata if available
                const icon = collection.collection_metadata?.icon;
                return (
                  <KnowledgeBaseTag
                    key={collection.id}
                    name={collection.display_name}
                    size="xs"
                    icon={icon}
                  />
                );
              })}

              {/* Show "View More" button if there are more than 5 collections */}
              {agent.collections.length > 5 && (
                <button
                  onClick={() => setShowAllCollections(!showAllCollections)}
                  className="inline-flex items-center rounded-md border bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700 px-1.5 py-0.5 text-[11px] hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  {showAllCollections ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-0.5" />
                      {t('agents.actions.collapse', '收起')}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-0.5" />
                      {t('agents.actions.viewMore', '查看更多')} (+{agent.collections.length - 5})
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-gray-400 dark:text-gray-500">{t('agents.card.noKnowledgeBases', '未关联知识库')}</div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-gray-700 flex justify-end space-x-3">
        <button
          className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
          title={t('agents.card.chatTooltip', '与智能体对话')}
          onClick={handleChatWithAgent}
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        <button
          className="text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200 p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/30"
          title={t('agents.card.editTooltip', '编辑智能体')}
          onClick={() => handleAction('edit')}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          className="transition-colors duration-200 p-1 rounded text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
          title={t('agents.card.deleteTooltip', '删除智能体')}
          onClick={() => handleAction('delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('agents.modal.delete.title', '删除智能体')}
        message={t('agents.modal.delete.message', `确定要删除智能体 "${agent.name}" 吗？此操作不可撤销。`, { name: agent.name })}
        confirmText={t('agents.modal.delete.confirm', '删除')}
        cancelText={t('agents.modal.delete.cancel', '取消')}
        confirmVariant="danger"
        onConfirm={handleDeleteAgent}
        onCancel={() => setShowDeleteConfirm(false)}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default AgentCard;
