/**
 * Widget 共享组件
 * 可在各 Widget 中复用的通用组件
 */

import React, { useCallback, useState } from 'react';
import styled from '@emotion/styled';
import { ExternalLink, Copy, MessageSquare, Check } from 'lucide-react';
import { parseActionURI, executeAction, type ActionProtocol } from '../../utils/actionUri';
import type { WidgetAction } from './types';

/**
 * 样式组件定义
 */

export const StyledWidgetCard = styled.div`
  border: 1px solid var(--border-primary, #e5e7eb);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  background-color: var(--bg-primary, #ffffff);
  margin: 12px 0;

  .dark &, .dark-mode & {
    border-color: #374151;
    background-color: #1f2937;
  }
`;

export const StyledWidgetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`;

export const HeaderIconBox = styled.div<{ bgColor?: string }>`
  padding: 8px;
  background-color: ${props => props.bgColor || '#eff6ff'};
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  .dark & {
    background-color: ${props => props.bgColor?.includes('blue-50') ? 'rgba(30, 58, 138, 0.3)' : 'rgba(30, 41, 59, 0.5)'};
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const HeaderTitle = styled.div`
  font-weight: 600;
  color: var(--text-primary, #111827);
  
  .dark &, .dark-mode & {
    color: #f9fafb;
  }
`;

export const HeaderSubtitle = styled.div`
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  
  .dark &, .dark-mode & {
    color: #9ca3af;
  }
`;

export const StyledStatusBadge = styled.span<{ bgColor?: string; textColor?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 500;
  background-color: ${props => props.bgColor || '#dbeafe'};
  color: ${props => props.textColor || '#1e40af'};

  .dark &, .dark-mode & {
    background-color: ${props => props.bgColor ? (props.bgColor.startsWith('#') ? `${props.bgColor}33` : 'rgba(31, 41, 55, 0.8)') : 'rgba(30, 58, 138, 0.3)'};
    color: ${props => props.textColor ? (props.textColor.startsWith('#') ? '#d1d5db' : '#d1d5db') : '#93c5fd'};
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

export const ActionButtonContainer = styled.div`
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const StyledActionButton = styled.button<{ actionStyle?: string }>`
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  ${props => {
    switch (props.actionStyle) {
      case 'primary':
        return `
          background-color: #2563eb;
          color: white;
          border: none;
          &:hover { background-color: #1d4ed8; }
          .dark & { background-color: #3b82f6; &:hover { background-color: #2563eb; } }
        `;
      case 'danger':
        return `
          background-color: #ef4444;
          color: white;
          border: none;
          &:hover { background-color: #dc2626; }
        `;
      case 'link':
        return `
          background-color: transparent;
          color: #2563eb;
          border: none;
          text-decoration: underline;
          padding: 0;
          &:hover { color: #1d4ed8; }
          .dark & { color: #60a5fa; &:hover { color: #3b82f6; } }
        `;
      default:
        return `
          background-color: transparent;
          color: #374151;
          border: 1px solid #d1d5db;
          &:hover { background-color: #f9fafb; }
          .dark & { 
            border-color: #4b5563; 
            color: #d1d5db;
            &:hover { background-color: #374151; } 
          }
        `;
    }
  }}
`;

export const StyledInfoRow = styled.div<{ highlight?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${props => props.highlight ? '8px' : '4px'};
  padding-top: ${props => props.highlight ? '8px' : '0'};
  border-top: ${props => props.highlight ? '1px solid #f3f4f6' : 'none'};
  font-size: ${props => props.highlight ? '16px' : '14px'};
  font-weight: ${props => props.highlight ? '600' : '400'};

  .dark &, .dark-mode & {
    border-top-color: #374151;
  }
`;

export const InfoLabel = styled.span<{ highlight?: boolean }>`
  color: ${props => props.highlight ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #6b7280)'};
  .dark &, .dark-mode & {
    color: ${props => props.highlight ? '#f9fafb' : '#9ca3af'};
  }
`;

export const InfoValue = styled.span<{ highlight?: boolean }>`
  color: ${props => props.highlight ? '#ef4444' : 'var(--text-primary, #374151)'};
  .dark &, .dark-mode & {
    color: ${props => props.highlight ? '#f87171' : '#d1d5db'};
  }
`;

export const StyledDivider = styled.div`
  border-top: 1px solid #f3f4f6;
  margin: 12px 0;
  .dark &, .dark-mode & {
    border-top-color: #374151;
  }
`;

export const ActionIcon = styled.span`
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-left: 4px;
  
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

const StyledToast = styled.div<{ type: 'success' | 'error' }>`
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  background-color: ${props => props.type === 'success' ? '#22c55e' : '#ef4444'};
  color: white;
  animation: widget-toast-slide-in 0.3s ease-out;

  @keyframes widget-toast-slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

/**
 * 获取 Action 图标
 */
const getActionIcon = (protocol: ActionProtocol | string): React.ReactNode => {
  switch (protocol) {
    case 'url':
      return <ActionIcon><ExternalLink /></ActionIcon>;
    case 'copy':
      return <ActionIcon><Copy /></ActionIcon>;
    case 'msg':
      return <ActionIcon><MessageSquare /></ActionIcon>;
    default:
      return null;
  }
};

const ToastMessage = styled.span`
  font-size: 14px;
  font-weight: 500;
`;

/**
 * 简单的内联 Toast 提示
 */
const InlineToast: React.FC<{
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}> = ({ message, type, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <StyledToast type={type}>
      {type === 'success' ? (
        <Check size={16} />
      ) : (
        <ExternalLink size={16} />
      )}
      <ToastMessage>{message}</ToastMessage>
    </StyledToast>
  );
};

/**
 * 操作按钮组件 Props
 */
interface ActionButtonsProps {
  actions?: WidgetAction[];
  /** 发送消息回调（用于 msg:// 协议） */
  onSendMessage?: (message: string) => void;
  /** 通用 action 回调（用于非标准 URI 或向后兼容） */
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
  /** 复制成功回调 */
  onCopySuccess?: (text: string) => void;
}

/**
 * 操作按钮组件
 */
export const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  actions, 
  onSendMessage,
  onAction,
  onCopySuccess,
}) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const handleClick = useCallback(async (action: WidgetAction) => {
    const parsed = parseActionURI(action.action);

    if (parsed.isValid) {
      const result = await executeAction(action.action, {
        onSendMessage: (msg) => {
          if (onSendMessage) {
            onSendMessage(msg);
            showToast('消息已发送', 'success');
          } else {
            console.warn('[ActionButtons] onSendMessage not provided');
            showToast('消息发送功能不可用', 'error');
          }
        },
        onCopySuccess: (text) => {
          showToast('已复制到剪贴板', 'success');
          onCopySuccess?.(text);
        },
        onCopyError: (error) => {
          console.error('[ActionButtons] Copy failed:', error);
          showToast('复制失败', 'error');
        },
        onUnknownProtocol: (uri) => {
          console.log('[ActionButtons] Unknown protocol, fallback:', uri.raw);
          onAction?.(uri.raw, action.payload);
        },
      });

      if (!result.success && parsed.protocol !== 'url') {
        console.warn('[ActionButtons] Action failed:', result.error);
      }
    } else if (action.url) {
      window.open(action.url, '_blank', 'noopener,noreferrer');
    } else {
      onAction?.(action.action, action.payload);
    }
  }, [onSendMessage, onAction, onCopySuccess, showToast]);

  if (!actions || actions.length === 0) return null;

  return (
    <>
      <ActionButtonContainer>
        {actions.map((action, index) => {
          const parsed = parseActionURI(action.action);
          const icon = parsed.isValid ? getActionIcon(parsed.protocol) : (action.url ? <ActionIcon><ExternalLink /></ActionIcon> : null);

          return (
            <StyledActionButton
              key={index}
              onClick={() => handleClick(action)}
              actionStyle={action.style}
            >
              {action.label}
              {icon}
            </StyledActionButton>
          );
        })}
      </ActionButtonContainer>
      {toast && (
        <InlineToast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </>
  );
};

/**
 * Widget 卡片容器
 */
export const WidgetCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children }) => (
  <StyledWidgetCard>
    {children}
  </StyledWidgetCard>
);

/**
 * Widget 头部
 */
export const WidgetHeader: React.FC<{
  icon?: React.ReactNode;
  iconBgColor?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ icon, iconBgColor, title, subtitle, badge }) => (
  <StyledWidgetHeader>
    <HeaderContent>
      {icon && (
        <HeaderIconBox bgColor={iconBgColor}>
          {icon}
        </HeaderIconBox>
      )}
      <div>
        {subtitle && <HeaderSubtitle>{subtitle}</HeaderSubtitle>}
        <HeaderTitle>{title}</HeaderTitle>
      </div>
    </HeaderContent>
    {badge}
  </StyledWidgetHeader>
);

/**
 * 状态徽章
 */
export const StatusBadge: React.FC<{
  children: React.ReactNode;
  icon?: React.ReactNode;
  bgColor?: string;
  textColor?: string;
}> = ({ 
  children, 
  icon, 
  bgColor, 
  textColor 
}) => (
  <StyledStatusBadge bgColor={bgColor} textColor={textColor}>
    {icon}
    {children}
  </StyledStatusBadge>
);

/**
 * 信息行
 */
export const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <StyledInfoRow highlight={highlight}>
    <InfoLabel highlight={highlight}>{label}</InfoLabel>
    <InfoValue highlight={highlight}>{value}</InfoValue>
  </StyledInfoRow>
);

/**
 * 分隔线
 */
export const Divider: React.FC<{ className?: string }> = () => (
  <StyledDivider />
);

/**
 * 格式化价格
 */
export function formatPrice(price: number | undefined | null, currency: string = '¥'): string {
  if (price === undefined || price === null) {
    return `${currency}0.00`;
  }
  return `${currency}${price.toFixed(2)}`;
}

/**
 * 工具栏按钮样式组件（支持动态颜色）
 */
export const ToolbarButton = styled.button<{
  toolbarColor?: {
    color: string;
    background: string;
    hoverBackground: string;
    darkColor: string;
    darkBackground: string;
    darkHoverBackground: string;
  };
}>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  
  color: ${props => props.toolbarColor?.color || '#374151'};
  background-color: ${props => props.toolbarColor?.background || '#f3f4f6'};
  
  &:hover {
    background-color: ${props => props.toolbarColor?.hoverBackground || '#e5e7eb'};
  }

  .dark &, .dark-mode & {
    color: ${props => props.toolbarColor?.darkColor || '#d1d5db'};
    background-color: ${props => props.toolbarColor?.darkBackground || 'rgba(55, 65, 81, 0.5)'};
    
    &:hover {
      background-color: ${props => props.toolbarColor?.darkHoverBackground || 'rgba(55, 65, 81, 0.8)'};
    }
  }
`;
