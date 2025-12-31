/**
 * 产品 Widget 组件
 */

import React from 'react';
import styled from '@emotion/styled';
import { ShoppingBag, Star } from 'lucide-react';
import type { WidgetDefinition, WidgetComponentProps, ProductWidgetData } from './types';
import { ActionButtons, formatPrice } from './shared';

/**
 * 样式组件
 */

const ProductCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  background-color: #ffffff;
  margin: 12px 0;

  .dark & {
    border-color: #374151;
    background-color: #1f2937;
  }
`;

const ImageContainer = styled.div`
  position: relative;
`;

const ProductThumbnail = styled.img`
  width: 100%;
  height: 192px;
  object-fit: cover;
`;

const DiscountLabel = styled.span`
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 8px;
  background-color: #ef4444;
  color: white;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
`;

const ContentBox = styled.div`
  padding: 16px;
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
`;

const Tag = styled.span`
  padding: 2px 8px;
  background-color: #fef2f2;
  color: #dc2626;
  font-size: 12px;
  border-radius: 4px;

  .dark & {
    background-color: rgba(127, 29, 29, 0.2);
    color: #f87171;
  }
`;

const ProductName = styled.h3`
  font-weight: 600;
  font-size: 18px;
  color: #111827;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  .dark & {
    color: #f9fafb;
  }
`;

const ProductBrand = styled.p`
  font-size: 14px;
  color: #6b7280;
  margin: 4px 0 0 0;

  .dark & {
    color: #9ca3af;
  }
`;

const ProductDescription = styled.p`
  font-size: 14px;
  color: #4b5563;
  margin: 8px 0 0 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  .dark & {
    color: #9ca3af;
  }
`;

const PriceContainer = styled.div`
  margin-top: 12px;
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

const CurrentPrice = styled.span`
  font-size: 24px;
  color: #ef4444;
  font-weight: 700;

  .dark & {
    color: #f87171;
  }
`;

const OriginalPrice = styled.span`
  font-size: 14px;
  color: #9ca3af;
  text-decoration: line-through;

  .dark & {
    color: #6b7280;
  }
`;

const RatingContainer = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
`;

const RatingValue = styled.span`
  font-weight: 500;
  color: #111827;

  .dark & {
    color: #f9fafb;
  }
`;

const ReviewCount = styled.span`
  color: #9ca3af;

  .dark & {
    color: #6b7280;
  }
`;

const StockStatus = styled.p<{ inStock: boolean }>`
  margin-top: 8px;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.inStock ? '#16a34a' : '#ef4444'};

  .dark & {
    color: ${props => props.inStock ? '#4ade80' : '#f87171'};
  }
`;

const SpecsContainer = styled.div`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .dark & {
    border-top-color: #374151;
  }
`;

const SpecRow = styled.div`
  display: flex;
  font-size: 14px;
`;

const SpecName = styled.span`
  color: #6b7280;
  width: 80px;
  flex-shrink: 0;

  .dark & {
    color: #9ca3af;
  }
`;

const SpecValue = styled.span`
  color: #374151;

  .dark & {
    color: #d1d5db;
  }
`;

/**
 * 产品 Widget 组件
 */
const ProductWidgetComponent: React.FC<WidgetComponentProps<ProductWidgetData>> = ({ 
  data, 
  onAction,
  onSendMessage,
  onCopySuccess,
}) => {
  const currency = data.currency || '¥';
  const hasDiscount = data.original_price && data.original_price > data.price;

  return (
    <ProductCard>
      {/* 图片 */}
      {data.thumbnail && (
        <ImageContainer>
          <ProductThumbnail
            src={data.thumbnail.url}
            alt={data.thumbnail.alt || data.name}
          />
          {data.discount_label && (
            <DiscountLabel>
              {data.discount_label}
            </DiscountLabel>
          )}
        </ImageContainer>
      )}

      <ContentBox>
        {/* 标签 */}
        {data.tags && data.tags.length > 0 && (
          <TagsContainer>
            {data.tags.slice(0, 3).map((tag, index) => (
              <Tag key={index}>
                {tag}
              </Tag>
            ))}
          </TagsContainer>
        )}

        {/* 名称 */}
        <ProductName>{data.name}</ProductName>

        {/* 品牌 */}
        {data.brand && (
          <ProductBrand>{data.brand}</ProductBrand>
        )}

        {/* 描述 */}
        {data.description && (
          <ProductDescription>{data.description}</ProductDescription>
        )}

        {/* 价格 */}
        <PriceContainer>
          <CurrentPrice>
            {formatPrice(data.price, currency)}
          </CurrentPrice>
          {hasDiscount && (
            <OriginalPrice>
              {formatPrice(data.original_price!, currency)}
            </OriginalPrice>
          )}
        </PriceContainer>

        {/* 评分 */}
        {data.rating !== undefined && data.rating !== null && (
          <RatingContainer>
            <Star size={16} color="#facc15" fill="#facc15" />
            <RatingValue>{(Number(data.rating) || 0).toFixed(1)}</RatingValue>
            {data.review_count !== undefined && (
              <ReviewCount>({data.review_count}条评价)</ReviewCount>
            )}
          </RatingContainer>
        )}

        {/* 库存状态 */}
        <StockStatus inStock={data.in_stock !== false}>
          {data.in_stock !== false ? (data.stock_status || '有货') : '暂时缺货'}
        </StockStatus>

        {/* 规格 */}
        {data.specs && data.specs.length > 0 && (
          <SpecsContainer>
            {data.specs.slice(0, 4).map((spec, index) => (
              <SpecRow key={index}>
                <SpecName>{spec.name}</SpecName>
                <SpecValue>{spec.value}</SpecValue>
              </SpecRow>
            ))}
          </SpecsContainer>
        )}

        {/* 操作按钮 */}
        <ActionButtons 
          actions={data.actions} 
          onAction={onAction}
          onSendMessage={onSendMessage}
          onCopySuccess={onCopySuccess}
        />
      </ContentBox>
    </ProductCard>
  );
};

export default ProductWidgetComponent;
