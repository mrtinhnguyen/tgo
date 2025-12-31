/**
 * 产品列表 Widget 组件
 */

import React from 'react';
import styled from '@emotion/styled';
import { LayoutGrid, Star } from 'lucide-react';
import type { WidgetDefinition, WidgetComponentProps, ProductListWidgetData } from './types';
import { WidgetCard, ActionButtons } from './shared';

/**
 * 样式组件
 */

const HeaderBox = styled.div`
  margin-bottom: 16px;
`;

const Title = styled.h3`
  font-weight: 600;
  font-size: 18px;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;

  .dark & {
    color: #f9fafb;
  }
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: #6b7280;
  margin: 4px 0 0 0;

  .dark & {
    color: #9ca3af;
  }
`;

const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const ProductItem = styled.div`
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  padding: 12px;
  background-color: #f9fafb;
  cursor: pointer;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .dark & {
    border-color: #374151;
    background-color: rgba(55, 65, 81, 0.5);
  }
`;

const ProductThumbnail = styled.img`
  width: 100%;
  height: 96px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 8px;
`;

const ProductName = styled.p`
  font-weight: 500;
  font-size: 14px;
  color: #111827;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .dark & {
    color: #f9fafb;
  }
`;

const ProductMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
`;

const ProductPrice = styled.span`
  color: #ef4444;
  font-weight: 600;

  .dark & {
    color: #f87171;
  }
`;

const ProductRating = styled.span`
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 2px;

  .dark & {
    color: #9ca3af;
  }
`;

const PaginationInfo = styled.p`
  font-size: 14px;
  color: #6b7280;
  margin-top: 12px;
  text-align: center;

  .dark & {
    color: #9ca3af;
  }
`;

/**
 * 产品列表 Widget 组件
 */
const ProductListWidgetComponent: React.FC<WidgetComponentProps<ProductListWidgetData>> = ({ 
  data, 
  onAction,
  onSendMessage,
  onCopySuccess,
}) => {
  return (
    <WidgetCard>
      {/* 标题 */}
      {(data.title || data.subtitle) && (
        <HeaderBox>
          {data.title && (
            <Title>
              <LayoutGrid size={20} color="#2563eb" />
              {data.title}
            </Title>
          )}
          {data.subtitle && (
            <Subtitle>{data.subtitle}</Subtitle>
          )}
        </HeaderBox>
      )}

      {/* 产品网格 */}
      <ProductGrid>
        {(data.products || []).map((product, index) => (
          <ProductItem key={index}>
            {product.thumbnail && (
              <ProductThumbnail
                src={product.thumbnail}
                alt={product.name}
              />
            )}
            <ProductName>{product.name}</ProductName>
            <ProductMeta>
              <ProductPrice>¥{product.price}</ProductPrice>
              {product.rating !== undefined && (
                <ProductRating>
                  <Star size={12} color="#facc15" fill="#facc15" />
                  {product.rating}
                </ProductRating>
              )}
            </ProductMeta>
          </ProductItem>
        ))}
      </ProductGrid>

      {/* 分页信息 */}
      {data.total_count !== undefined && (
        <PaginationInfo>
          共 {data.total_count} 件商品
          {data.has_more && ' · 还有更多'}
        </PaginationInfo>
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

export default ProductListWidgetComponent;
