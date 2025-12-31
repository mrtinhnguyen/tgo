/**
 * 价格对比 Widget 组件
 */

import React from 'react';
import styled from '@emotion/styled';
import { Table2 } from 'lucide-react';
import type { WidgetDefinition, WidgetComponentProps, PriceComparisonWidgetData } from './types';
import { WidgetCard, ActionButtons } from './shared';

/**
 * 样式组件
 */

const WidgetTitle = styled.h3`
  font-weight: 600;
  font-size: 18px;
  color: #111827;
  margin-bottom: 16px;
  margin-top: 0;

  .dark & {
    color: #f9fafb;
  }
`;

const TableWrapper = styled.div`
  overflow-x: auto;
  margin-left: -8px;
  margin-right: -8px;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 100%;
`;

const Th = styled.th`
  padding: 8px 12px;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  background-color: #f3f4f6;
  border: 1px solid #e5e7eb;

  .dark & {
    color: #f9fafb;
    background-color: #374151;
    border-color: #4b5563;
  }
`;

const Td = styled.td<{ recommended?: boolean }>`
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #e5e7eb;
  color: ${props => props.recommended ? '#166534' : '#374151'};

  .dark & {
    border-color: #4b5563;
    color: ${props => props.recommended ? '#86efac' : '#d1d5db'};
  }
`;

const Tr = styled.tr<{ recommended?: boolean }>`
  background-color: ${props => props.recommended ? '#f0fdf4' : 'transparent'};

  .dark & {
    background-color: ${props => props.recommended ? 'rgba(20, 83, 45, 0.2)' : 'transparent'};
  }
`;

const RecommendedBadge = styled.span`
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background-color: #dcfce7;
  color: #15803d;

  .dark & {
    background-color: #064e3b;
    color: #a7f3d0;
  }
`;

const RecommendationReason = styled.p`
  margin-top: 12px;
  font-size: 14px;
  color: #16a34a;
  display: flex;
  align-items: start;
  gap: 6px;
  margin-bottom: 0;

  .dark & {
    color: #4ade80;
  }
`;

/**
 * 价格对比 Widget 组件
 */
const PriceComparisonWidgetComponent: React.FC<WidgetComponentProps<PriceComparisonWidgetData>> = ({ 
  data, 
  onAction,
  onSendMessage,
  onCopySuccess,
}) => {
  return (
    <WidgetCard>
      {/* 标题 */}
      {data.title && (
        <WidgetTitle>{data.title}</WidgetTitle>
      )}

      {/* 表格 */}
      <TableWrapper>
        <StyledTable>
          <thead>
            <tr>
              {(data.columns || []).map((col, i) => (
                <Th key={i}>
                  {col}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.items || []).map((item, i) => (
              <Tr
                key={i}
                recommended={i === data.recommended_index}
              >
                {(data.columns || []).map((col, j) => (
                  <Td
                    key={j}
                    recommended={i === data.recommended_index}
                  >
                    {item[col]}
                    {i === data.recommended_index && j === 0 && (
                      <RecommendedBadge>
                        推荐
                      </RecommendedBadge>
                    )}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </StyledTable>
      </TableWrapper>

      {/* 推荐原因 */}
      {data.recommendation_reason && (
        <RecommendationReason>
          <span style={{ fontSize: '16px' }}>💡</span>
          <span>{data.recommendation_reason}</span>
        </RecommendationReason>
      )}

      {/* 操作按钮 */}
      <ActionButtons 
        actions={data.actions} 
        onAction={onAction}
        onSendMessage={onSendMessage}
        onCopySuccess={onCopySuccess}
      />
    </WidgetCard>
  );
};

export default PriceComparisonWidgetComponent;
