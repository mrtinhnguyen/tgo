import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AgentCard from './AgentCard';
import CreateAgentModal from './CreateAgentModal';
import AgentDetailModal from './AgentDetailModal';
import EditAgentModal from './EditAgentModal';
import TeamInfoModal from './TeamInfoModal';
// import MCPToolDetailModal from '@/components/ui/MCPToolDetailModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { AgentsGridSkeleton, AgentsErrorState, AgentsEmptyState } from '@/components/ui/AgentsSkeleton';
import { useAIStore } from '@/stores';
import { useToast } from '@/hooks/useToast';
import { LuPlus, LuChevronLeft, LuChevronRight, LuUsers } from 'react-icons/lu';
import { MessageCircle } from 'lucide-react';
import type { Agent, AgentToolResponse } from '@/types';
import { aiTeamsApiService, TeamWithDetailsResponse } from '@/services/aiTeamsApi';

/**
 * Agent management page component
 */
// Stable selectors to prevent unnecessary re-renders
const selectAgents = (state: any) => state.agents;
const selectCurrentPage = (state: any) => state.agentCurrentPage;
const selectPageSize = (state: any) => state.agentPageSize;
const selectIsLoadingAgents = (state: any) => state.isLoadingAgents;
const selectAgentsError = (state: any) => state.agentsError;
const selectSetCurrentPage = (state: any) => state.setAgentCurrentPage;
const selectCreateAgent = (state: any) => state.createAgent;
const selectUpdateAgent = (state: any) => state.updateAgent;
const selectDeleteAgent = (state: any) => state.deleteAgent;
const selectSetShowCreateAgentModal = (state: any) => state.setShowCreateAgentModal;
const selectLoadAgents = (state: any) => state.loadAgents;

const AgentManagement: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const agents = useAIStore(selectAgents);
  const currentPage = useAIStore(selectCurrentPage);
  const pageSize = useAIStore(selectPageSize);
  const isLoadingAgents = useAIStore(selectIsLoadingAgents);
  const agentsError = useAIStore(selectAgentsError);
  const setCurrentPage = useAIStore(selectSetCurrentPage);
  const createAgent = useAIStore(selectCreateAgent);
  const updateAgent = useAIStore(selectUpdateAgent);
  const deleteAgent = useAIStore(selectDeleteAgent);
  const setShowCreateAgentModal = useAIStore(selectSetShowCreateAgentModal);
  const loadAgents = useAIStore(selectLoadAgents);

  const { showSuccess, showError } = useToast();

  // 模态框状态
  // const [selectedTool, setSelectedTool] = useState<AgentToolResponse | null>(null);
  // const [showToolDetail, setShowToolDetail] = useState(false);
  const [showAgentDetail, setShowAgentDetail] = useState(false);
  const [showEditAgent, setShowEditAgent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTeamInfo, setShowTeamInfo] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Team state
  const [defaultTeam, setDefaultTeam] = useState<TeamWithDetailsResponse | null>(null);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);

  // Track if agents have been loaded to prevent multiple API calls
  const hasLoadedAgents = useRef(false);
  const hasLoadedTeam = useRef(false);

  // Load default team info
  const loadDefaultTeam = useCallback(async () => {
    if (hasLoadedTeam.current) return;
    setIsLoadingTeam(true);
    try {
      hasLoadedTeam.current = true;
      const teamData = await aiTeamsApiService.getDefaultTeam(false);
      setDefaultTeam(teamData);
    } catch (error) {
      hasLoadedTeam.current = false;
      console.error('Failed to load default team:', error);
      // Don't show error toast for team loading - it's not critical
    } finally {
      setIsLoadingTeam(false);
    }
  }, []);

  // Load agents and team on component mount
  useEffect(() => {
    if (hasLoadedAgents.current) {
      return; // Already loaded, don't load again
    }

    const loadInitialAgents = async () => {
      try {
        hasLoadedAgents.current = true;
        await loadAgents();
      } catch (error) {
        hasLoadedAgents.current = false; // Reset on error so we can retry
        console.error('Failed to load agents on mount:', error);
        showError(
          t('agents.messages.loadFailed', '加载失败'),
          t('agents.messages.loadFailedDesc', '无法加载智能体列表，请稍后重试')
        );
      }
    };

    loadInitialAgents();
    loadDefaultTeam();
  }, [loadDefaultTeam]); // Empty dependency array - only run on mount

  // 在组件中计算分页
  const { paginatedAgents, totalPages } = React.useMemo(() => {
    const filtered = agents; // 这里可以添加筛选逻辑
    const total = Math.ceil(filtered.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);
    return { paginatedAgents: paginated, totalPages: total };
  }, [agents, currentPage, pageSize]);

  const handleCreateAgent = (): void => {
    setShowCreateAgentModal(true);
  };

  const handleOpenTeamInfo = (): void => {
    setShowTeamInfo(true);
  };

  const handleChatWithTeam = (): void => {
    if (!defaultTeam) {
      showError(
        t('agents.messages.noTeam', '团队未加载'),
        t('agents.messages.noTeamDesc', '请稍后重试')
      );
      return;
    }
    if (agents.length === 0) {
      showError(
        t('agents.messages.noAgentsForTeamChat', '无法发起团队对话'),
        t('agents.messages.noAgentsForTeamChatDesc', '请先创建至少一个智能体')
      );
      return;
    }
    const channelId = `${defaultTeam.id}-team`;
    navigate(`/chat/1/${channelId}`, {
      state: {
        agentName: defaultTeam.name || t('agents.teamChat.defaultName', '智能体团队'),
        platform: 'team'
      }
    });
  };

  const handleTeamUpdated = useCallback(async () => {
    // Refresh team data after update
    hasLoadedTeam.current = false;
    await loadDefaultTeam();
  }, [loadDefaultTeam]);

  // Handle retry on error
  const handleRetry = useCallback(async (): Promise<void> => {
    try {
      await loadAgents();
    } catch (error) {
      console.error('Failed to retry loading agents:', error);
      showError(
        t('agents.messages.retryFailed', '重试失败'),
        t('agents.messages.retryFailedDesc', '无法加载智能体列表，请稍后重试')
      );
    }
  }, [loadAgents, showError, t]);

  const handleAgentAction = (actionType: string, agent: Agent): void => {
    setSelectedAgent(agent);

    switch (actionType) {
      case 'view':
        setShowAgentDetail(true);
        break;
      case 'edit':
        setShowEditAgent(true);
        break;
      case 'delete':
        setShowDeleteConfirm(true);
        break;
      case 'deleted':
        // Agent was successfully deleted by the card component
        // No additional action needed as the store will update automatically
        console.log('Agent deleted:', agent.name);
        break;
      case 'copy':
        handleCopyAgent(agent);
        break;
      case 'refresh':
        handleRefreshAgent(agent);
        break;
      default:
        console.log('Unknown action:', actionType);
    }
  };

  const handleCopyAgent = async (agent: Agent): Promise<void> => {
    try {
      await createAgent({
        name: `${agent.name}${t('agents.copy.suffix', ' (副本)')}`,
        profession: agent.role || t('agents.copy.defaultProfession', '专家'),
        description: agent.description,
        llmModel: agent.llmModel || 'gemini-1.5-pro',
        mcpTools: agent.mcpTools,
        mcpToolConfigs: {},
        knowledgeBases: agent.knowledgeBases
      });
      showSuccess(
        t('agents.messages.copySuccess', '复制成功'),
        t('agents.messages.copySuccessDesc', `智能体 "${agent.name}" 已成功复制`, { name: agent.name })
      );
    } catch (error) {
      showError(
        t('agents.messages.copyFailed', '复制失败'),
        t('agents.messages.copyFailedDesc', '复制智能体时发生错误')
      );
    }
  };

  const handleRefreshAgent = async (agent: Agent): Promise<void> => {
    try {
      await updateAgent(agent.id, {
        status: agent.status === 'active' ? 'inactive' : 'active'
      });
      showSuccess(
        t('agents.messages.statusUpdateSuccess', '刷新成功'),
        t('agents.messages.statusUpdateSuccessDesc', `智能体 "${agent.name}" 状态已更新`, { name: agent.name })
      );
    } catch (error) {
      console.error('Failed to refresh agent:', error);
      showError(
        t('agents.messages.statusUpdateFailed', '刷新失败'),
        t('agents.messages.statusUpdateFailedDesc', '更新智能体状态时发生错误')
      );
    }
  };

  const handleDeleteAgent = async (): Promise<void> => {
    if (!selectedAgent) return;

    setIsDeleting(true);
    try {
      await deleteAgent(selectedAgent.id);
      showSuccess(
        t('agents.messages.deleteSuccess', '删除成功'),
        t('agents.messages.deleteSuccessDesc', `智能体 "${selectedAgent.name}" 已删除`, { name: selectedAgent.name })
      );
      setShowDeleteConfirm(false);
      setSelectedAgent(null);
    } catch (error) {
      showError(
        t('agents.messages.deleteFailed', '删除失败'),
        t('agents.messages.deleteFailedDesc', '删除智能体时发生错误')
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToolClick = (tool: AgentToolResponse): void => {
    // TODO: Create AgentToolDetailModal for AgentToolResponse objects
    console.log('Tool clicked:', tool);
    // setSelectedTool(tool);
    // setShowToolDetail(true);
  };



  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
  };

  return (
    <main className="flex-grow flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {t('agents.title', '智能体管理')}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="flex items-center px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded-md hover:bg-green-200 dark:hover:bg-green-900/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleChatWithTeam}
            disabled={!defaultTeam || isLoadingTeam || agents.length === 0}
            title={agents.length === 0 ? t('agents.actions.teamChatNoAgents', '请先创建智能体') : t('agents.actions.teamChatTooltip', '与智能体团队对话')}
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            <span>{t('agents.actions.teamChat', '团队对话')}</span>
          </button>
          <button
            className="flex items-center px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 transition-colors duration-200"
            onClick={handleOpenTeamInfo}
          >
            <LuUsers className="w-4 h-4 mr-1" />
            <span>{t('agents.actions.teamInfo', '团队信息')}</span>
          </button>
          <button
            className="flex items-center px-3 py-1.5 bg-blue-500 dark:bg-blue-600 text-white text-sm rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors duration-200"
            onClick={handleCreateAgent}
          >
            <LuPlus className="w-4 h-4 mr-1" />
            <span>{t('agents.actions.create', '创建智能体')}</span>
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-grow overflow-y-auto p-6" style={{ height: 0 }}>
        {/* Error State */}
        {agentsError ? (
          <AgentsErrorState
            error={agentsError}
            onRetry={handleRetry}
          />
        ) : isLoadingAgents ? (
          <AgentsGridSkeleton count={9} />
        ) : agents.length === 0 ? (
          <AgentsEmptyState
            title={t('agents.empty.title', '暂无智能体')}
            description={t('agents.empty.description', '点击「创建智能体」按钮开始创建您的第一个智能体')}
            actionButton={
              <button
                onClick={handleCreateAgent}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <LuPlus className="w-4 h-4 mr-2" />
                {t('agents.actions.create', '创建智能体')}
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedAgents.map((agent: Agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onAction={handleAgentAction}
                onToolClick={handleToolClick}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <nav className="inline-flex rounded-md shadow-sm -space-x-px bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700" aria-label="Pagination">
              <button
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border-r border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <span className="sr-only">{t('agents.pagination.previous', 'Previous')}</span>
                <LuChevronLeft className="h-5 w-5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`relative inline-flex items-center px-4 py-2 border-r border-gray-300 dark:border-gray-700 text-sm font-medium ${
                    page === currentPage
                      ? 'z-10 bg-blue-500 dark:bg-blue-600 border-blue-500 dark:border-blue-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                className="relative inline-flex items-center px-2 py-2 rounded-r-md text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only">{t('agents.pagination.next', 'Next')}</span>
                <LuChevronRight className="h-5 w-5" />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* 智能体创建模态框 */}
      <CreateAgentModal />

      {/* 团队信息模态框 */}
      <TeamInfoModal
        isOpen={showTeamInfo}
        onClose={() => setShowTeamInfo(false)}
        team={defaultTeam}
        onTeamUpdated={handleTeamUpdated}
      />

      {/* 智能体详情模态框 */}
      <AgentDetailModal
        agent={selectedAgent}
        isOpen={showAgentDetail}
        onClose={() => setShowAgentDetail(false)}
        onToolClick={handleToolClick}
      />

      {/* 智能体编辑模态框 */}
      <EditAgentModal
        agentId={selectedAgent?.id || null}
        isOpen={showEditAgent}
        onClose={() => setShowEditAgent(false)}
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('agents.modal.delete.title', '删除智能体')}
        message={t('agents.modal.delete.message', `确定要删除智能体 "${selectedAgent?.name}" 吗？此操作不可撤销。`, { name: selectedAgent?.name })}
        confirmText={t('agents.modal.delete.confirm', '删除')}
        cancelText={t('agents.modal.delete.cancel', '取消')}
        confirmVariant="danger"
        onConfirm={handleDeleteAgent}
        onCancel={() => setShowDeleteConfirm(false)}
        isLoading={isDeleting}
      />

      {/* TODO: Create AgentToolDetailModal for AgentToolResponse objects */}
      {/* <MCPToolDetailModal
        tool={selectedTool}
        isOpen={showToolDetail}
        onClose={() => {
          setShowToolDetail(false);
          setSelectedTool(null);
        }}
      /> */}
    </main>
  );
};

export default AgentManagement;
