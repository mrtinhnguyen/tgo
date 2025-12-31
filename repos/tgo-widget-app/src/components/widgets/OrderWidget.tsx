/**
 * 订单 Widget 组件
 */

import React from 'react';
import styled from '@emotion/styled';
import { Package, Truck, MapPin, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { WidgetDefinition, WidgetComponentProps, OrderWidgetData, OrderStatus } from './types';
import { WidgetCard, WidgetHeader, StatusBadge, ActionButtons, InfoRow, formatPrice } from './shared';

/**
 * 样式组件
 */

const ProductListContainer = styled.div`
  border-top: 1px solid #f3f4f6;
  border-bottom: 1px solid #f3f4f6;
  padding: 12px 0;
  margin: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .dark &, .dark-mode & {
    border-color: #374151;
  }
`;

const ProductItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const ProductInfo = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
`;

const ProductImage = styled.img`
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #f3f4f6;

  .dark &, .dark-mode & {
    border-color: #4b5563;
  }
`;

const ProductName = styled.p`
  font-weight: 500;
  color: #111827;
  margin: 0;
  font-size: 14px;

  .dark &, .dark-mode & {
    color: #f3f4f6;
  }
`;

const ProductAttributes = styled.p`
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0 0 0;

  .dark &, .dark-mode & {
    color: #9ca3af;
  }
`;

const ProductSKU = styled.p`
  font-size: 12px;
  color: #9ca3af;
  margin: 2px 0 0 0;

  .dark &, .dark-mode & {
    color: #6b7280;
  }
`;

const ProductPriceBox = styled.div`
  text-align: right;
  margin-left: 12px;
`;

const ProductQuantity = styled.p`
  font-size: 13px;
  color: #6b7280;
  margin: 0;

  .dark &, .dark-mode & {
    color: #9ca3af;
  }
`;

const ProductTotalPrice = styled.p`
  font-weight: 500;
  color: #111827;
  margin: 2px 0 0 0;
  font-size: 14px;

  .dark &, .dark-mode & {
    color: #f3f4f6;
  }
`;

const DiscountRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #ef4444;

  .dark &, .dark-mode & {
    color: #f87171;
  }
`;

const ShippingInfoBox = styled.div`
  margin-top: 16px;
  padding: 16px;
  background-color: #f9fafb;
  border-radius: 12px;
  font-size: 14px;

  .dark &, .dark-mode & {
    background-color: rgba(55, 65, 81, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
`;

const ShippingFlex = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const ReceiverInfo = styled.p`
  font-weight: 600;
  color: #111827;
  margin: 0;

  .dark &, .dark-mode & {
    color: #f9fafb;
  }
`;

const ShippingAddress = styled.p`
  color: #4b5563;
  margin: 6px 0 0 0;
  line-height: 1.5;

  .dark &, .dark-mode & {
    color: #d1d5db;
  }
`;

const TrackingInfo = styled.div`
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b7280;

  .dark &, .dark-mode & {
    color: #9ca3af;
  }
`;

/**
 * 订单状态配色映射
 */
const orderStatusConfig: Record<OrderStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: '#fef9c3', text: '#854d0e', icon: <Clock size={16} /> },
  paid: { bg: '#dbeafe', text: '#1e40af', icon: <CheckCircle size={16} /> },
  processing: { bg: '#e0e7ff', text: '#3730a3', icon: <Package size={16} /> },
  shipped: { bg: '#f3e8ff', text: '#6b21a8', icon: <Truck size={16} /> },
  delivered: { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={16} /> },
  completed: { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={16} /> },
  cancelled: { bg: '#f3f4f6', text: '#374151', icon: <XCircle size={16} /> },
  refunded: { bg: '#fee2e2', text: '#991b1b', icon: <AlertCircle size={16} /> },
};

/**
 * 订单 Widget 组件
 */
const OrderWidgetComponent: React.FC<WidgetComponentProps<OrderWidgetData>> = ({ 
  data, 
  onAction,
  onSendMessage,
  onCopySuccess,
}) => {
  const statusStyle = orderStatusConfig[data.status] || orderStatusConfig.pending;
  const currency = data.currency || '¥';

  return (
    <WidgetCard>
      {/* 头部 */}
      <WidgetHeader
        icon={<Package size={20} color="#2563eb" />}
        iconBgColor="#eff6ff"
        subtitle="订单号"
        title={<span style={{ fontFamily: 'monospace' }}>{data.order_id}</span>}
        badge={
          <StatusBadge bgColor={statusStyle.bg} textColor={statusStyle.text} icon={statusStyle.icon}>
            {data.status_text || data.status}
          </StatusBadge>
        }
      />

      {/* 商品列表 */}
      <ProductListContainer>
        {(data.items || []).map((item, index) => (
          <ProductItem key={index}>
            <ProductInfo>
              {item.image && (
                <ProductImage
                  src={item.image.url}
                  alt={item.image.alt || item.name}
                />
              )}
              <div>
                <ProductName>{item.name}</ProductName>
                {item.attributes && (
                  <ProductAttributes>
                    {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                  </ProductAttributes>
                )}
                {item.sku && (
                  <ProductSKU>SKU: {item.sku}</ProductSKU>
                )}
              </div>
            </ProductInfo>
            <ProductPriceBox>
              <ProductQuantity>×{item.quantity}</ProductQuantity>
              <ProductTotalPrice>{formatPrice(item.total_price, currency)}</ProductTotalPrice>
            </ProductPriceBox>
          </ProductItem>
        ))}
      </ProductListContainer>

      {/* 金额信息 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <InfoRow label="商品小计" value={formatPrice(data.subtotal, currency)} />
        {data.shipping_fee !== undefined && data.shipping_fee > 0 && (
          <InfoRow label="运费" value={formatPrice(data.shipping_fee, currency)} />
        )}
        {data.discount !== undefined && data.discount > 0 && (
          <DiscountRow>
            <span>优惠</span>
            <span>-{formatPrice(data.discount, currency)}</span>
          </DiscountRow>
        )}
        <InfoRow label="合计" value={formatPrice(data.total, currency)} highlight />
      </div>

      {/* 收货信息 */}
      {data.shipping_address && (
        <ShippingInfoBox>
          <ShippingFlex>
            <MapPin size={16} color="#9ca3af" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <ReceiverInfo>
                {data.receiver_name} {data.receiver_phone}
              </ReceiverInfo>
              <ShippingAddress>{data.shipping_address}</ShippingAddress>
            </div>
          </ShippingFlex>
        </ShippingInfoBox>
      )}

      {/* 物流信息 */}
      {data.tracking_number && (
        <TrackingInfo>
          <Truck size={16} />
          <span>{data.carrier}</span>
          <span style={{ fontFamily: 'monospace' }}>{data.tracking_number}</span>
        </TrackingInfo>
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

export default OrderWidgetComponent;
