/**
 * 未知类型 Widget 组件
 * 当遇到未注册的 Widget 类型时显示
 */

import React from 'react';
import styled from '@emotion/styled';
import { AlertCircle } from 'lucide-react';
import type { WidgetComponentProps, WidgetData } from './types';

const UnknownContainer = styled.div`
  padding: 16px;
  background-color: #fefce8;
  border: 1px solid #fef08a;
  border-radius: 8px;
  margin: 12px 0;

  .dark & {
    background-color: rgba(113, 63, 18, 0.2);
    border-color: #a16207;
  }
`;

const Message = styled.p`
  color: #854d0e;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;

  .dark & {
    color: #fde047;
  }
`;

const Details = styled.details`
  margin-top: 8px;
`;

const Summary = styled.summary`
  font-size: 14px;
  color: #ca8a04;
  cursor: pointer;

  .dark & {
    color: #facc15;
  }
`;

const RawData = styled.pre`
  margin-top: 8px;
  padding: 8px;
  background-color: #fef9c3;
  border-radius: 4px;
  font-size: 12px;
  overflow: auto;
  max-height: 160px;

  .dark & {
    background-color: rgba(113, 63, 18, 0.3);
  }
`;

/**
 * 未知 Widget 组件
 */
const UnknownWidgetComponent: React.FC<WidgetComponentProps<WidgetData>> = ({ data }) => (
  <UnknownContainer>
    <Message>
      <AlertCircle size={20} />
      未知的 UI 组件类型: {data.type}
    </Message>
    <Details>
      <Summary>
        查看原始数据
      </Summary>
      <RawData>
        {JSON.stringify(data, null, 2)}
      </RawData>
    </Details>
  </UnknownContainer>
);

export default UnknownWidgetComponent;
