/**
 * 物流 Widget 组件
 */

import React from 'react';
import styled from '@emotion/styled';
import { Truck, Phone, MapPin, Clock } from 'lucide-react';
import type { WidgetDefinition, WidgetComponentProps, LogisticsWidgetData, LogisticsStatus } from './types';
import { WidgetCard, WidgetHeader, StatusBadge, ActionButtons } from './shared';

/**
 * 样式组件
 */

const CarrierLogo = styled.img`
  width: 20px;
  height: 20px;
  border-radius: 4px;
`;

const EstimatedDeliveryBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #16a34a;
  margin-bottom: 16px;
  padding: 8px;
  background-color: #f0fdf4;
  border-radius: 8px;

  .dark & {
    color: #4ade80;
    background-color: rgba(20, 83, 45, 0.2);
  }
`;

const CourierInfoBox = styled.div`
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 8px;
  margin-bottom: 16px;

  .dark & {
    background-color: rgba(55, 65, 81, 0.5);
  }
`;

const CourierFlex = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CourierLabel = styled.span`
  font-size: 14px;
  color: #4b5563;
  .dark & { color: #9ca3af; }
`;

const CourierName = styled.span`
  font-weight: 500;
  color: #111827;
  .dark & { color: #f9fafb; }
`;

const CourierPhoneLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #2563eb;
  text-decoration: none;
  font-size: 14px;
  &:hover { color: #1d4ed8; }
  .dark & { color: #60a5fa; &:hover { color: #3b82f6; } }
`;

const TimelineContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const TimelineItem = styled.div`
  display: flex;
  gap: 12px;
`;

const TimelineLeft = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const TimelineDot = styled.div<{ bgColor?: string }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => props.bgColor || '#d1d5db'};
  box-shadow: 0 0 0 4px #ffffff;
  z-index: 1;

  .dark & {
    box-shadow: 0 0 0 4px #1f2937;
  }
`;

const TimelineLine = styled.div`
  width: 2px;
  flex: 1;
  background-color: #e5e7eb;
  margin: 4px 0;
  min-height: 24px;

  .dark & {
    background-color: #374151;
  }
`;

const TimelineContent = styled.div`
  flex: 1;
  padding-bottom: 16px;
`;

const TimelineTime = styled.p`
  font-size: 12px;
  color: #6b7280;
  margin: 0;
  .dark & { color: #9ca3af; }
`;

const TimelineDescription = styled.p<{ active?: boolean }>`
  font-size: 14px;
  margin: 4px 0 0 0;
  font-weight: ${props => props.active ? '500' : '400'};
  color: ${props => props.active ? '#111827' : '#374151'};

  .dark & {
    color: ${props => props.active ? '#f9fafb' : '#d1d5db'};
  }
`;

const TimelineLocation = styled.p`
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  .dark & { color: #9ca3af; }
`;

/**
 * 物流状态配色映射
 */
const logisticsStatusConfig: Record<LogisticsStatus, { bgColor: string }> = {
  pending: { bgColor: '#9ca3af' }, // bg-gray-400
  picked_up: { bgColor: '#3b82f6' }, // bg-blue-500
  in_transit: { bgColor: '#a855f7' }, // bg-purple-500
  out_for_delivery: { bgColor: '#f97316' }, // bg-orange-500
  delivered: { bgColor: '#22c55e' }, // bg-green-500
  exception: { bgColor: '#ef4444' }, // bg-red-500
  returned: { bgColor: '#6b7280' }, // bg-gray-500
};

/**
 * 物流 Widget 组件
 */
const LogisticsWidgetComponent: React.FC<WidgetComponentProps<LogisticsWidgetData>> = ({ 
  data, 
  onAction,
  onSendMessage,
  onCopySuccess,
}) => {
  return (
    <WidgetCard>
      {/* 头部 */}
      <WidgetHeader
        icon={
          data.carrier_logo ? (
            <CarrierLogo src={data.carrier_logo} alt={data.carrier} />
          ) : (
            <Truck size={20} color="#9333ea" />
          )
        }
        iconBgColor="#f5f3ff"
        title={data.carrier}
        subtitle={<span style={{ fontFamily: 'monospace' }}>{data.tracking_number}</span>}
        badge={
          <StatusBadge>
            {data.status_text || data.status}
          </StatusBadge>
        }
      />

      {/* 预计送达 */}
      {data.estimated_delivery && (
        <EstimatedDeliveryBox>
          <Clock size={16} />
          <span>预计送达: {data.estimated_delivery}</span>
        </EstimatedDeliveryBox>
      )}

      {/* 配送员信息 */}
      {data.courier_name && (
        <CourierInfoBox>
          <CourierFlex>
            <CourierLabel>
              配送员: <CourierName>{data.courier_name}</CourierName>
            </CourierLabel>
            {data.courier_phone && (
              <CourierPhoneLink href={`tel:${data.courier_phone}`}>
                <Phone size={16} />
                <span>{data.courier_phone}</span>
              </CourierPhoneLink>
            )}
          </CourierFlex>
        </CourierInfoBox>
      )}

      {/* 时间线 */}
      <TimelineContainer>
        {(data.timeline || []).map((event, index) => {
          const eventStatusStyle = event.status
            ? logisticsStatusConfig[event.status]
            : (index === 0 ? { bgColor: '#3b82f6' } : { bgColor: '#e5e7eb' });

          return (
            <TimelineItem key={index}>
              <TimelineLeft>
                <TimelineDot bgColor={eventStatusStyle.bgColor} />
                {index < (data.timeline || []).length - 1 && (
                  <TimelineLine />
                )}
              </TimelineLeft>
              <TimelineContent>
                <TimelineTime>{event.time}</TimelineTime>
                <TimelineDescription active={index === 0}>
                  {event.description}
                </TimelineDescription>
                {event.location && (
                  <TimelineLocation>
                    <MapPin size={12} />
                    {event.location}
                  </TimelineLocation>
                )}
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </TimelineContainer>

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

export default LogisticsWidgetComponent;
