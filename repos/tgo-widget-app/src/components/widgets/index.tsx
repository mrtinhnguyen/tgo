/**
 * UI Widget 系统入口
 * 
 * 如何添加新的 Widget：
 * 1. 在 types.ts 中定义 Widget 数据类型（如 MyWidgetData）
 * 2. 创建 Widget 组件文件（如 MyWidget.tsx）
 * 3. 在本文件中导入组件并定义 WidgetDefinition
 * 4. 注册 Widget
 */

import React from 'react';
import { Package, Truck, ShoppingBag, LayoutGrid, Table2 } from 'lucide-react';

// 导出类型
export * from './types';

// 导出注册表函数
export {
  registerWidget,
  registerWidgets,
  getWidgetDefinition,
  getRegisteredTypes,
  getAllWidgetDefinitions,
  isWidgetRegistered,
} from './registry';

// 导出共享组件
export * from './shared';

// 导出渲染器
export { default as WidgetRenderer } from './WidgetRenderer';

// 导出 Action URI 工具函数
export {
  parseActionURI,
  buildActionURI,
  isValidActionURI,
  executeAction,
  createActionHandler,
  type ActionProtocol,
  type ParsedActionURI,
  type ActionResult,
  type ActionHandlerConfig,
} from '../../utils/actionUri';

// ============================================
// 注册内置 Widget
// ============================================

import { registerWidget } from './registry';
import type { WidgetDefinition, OrderWidgetData, LogisticsWidgetData, ProductWidgetData, ProductListWidgetData, PriceComparisonWidgetData } from './types';

// 导入内置 Widget 组件
import OrderWidgetComponent from './OrderWidget';
import LogisticsWidgetComponent from './LogisticsWidget';
import ProductWidgetComponent from './ProductWidget';
import ProductListWidgetComponent from './ProductListWidget';
import PriceComparisonWidgetComponent from './PriceComparisonWidget';

// 定义内置 Widget
export const orderWidgetDefinition: WidgetDefinition<OrderWidgetData> = {
  type: 'order',
  displayName: '订单卡片',
  description: '显示订单详情、商品列表、价格和状态',
  component: OrderWidgetComponent,
  icon: <Package size={16} />,
  toolbarColor: {
    color: '#2563eb',
    background: '#eff6ff',
    hoverBackground: '#dbeafe',
    darkColor: '#60a5fa',
    darkBackground: 'rgba(30, 58, 138, 0.3)',
    darkHoverBackground: 'rgba(30, 58, 138, 0.5)',
  },
};

export const logisticsWidgetDefinition: WidgetDefinition<LogisticsWidgetData> = {
  type: 'logistics',
  displayName: '物流追踪',
  description: '显示物流状态和时间线',
  component: LogisticsWidgetComponent,
  icon: <Truck size={16} />,
  toolbarColor: {
    color: '#9333ea',
    background: '#faf5ff',
    hoverBackground: '#f3e8ff',
    darkColor: '#c084fc',
    darkBackground: 'rgba(88, 28, 135, 0.3)',
    darkHoverBackground: 'rgba(88, 28, 135, 0.5)',
  },
};

export const productWidgetDefinition: WidgetDefinition<ProductWidgetData> = {
  type: 'product',
  displayName: '商品详情',
  description: '显示单个商品的详细信息',
  component: ProductWidgetComponent,
  icon: <ShoppingBag size={16} />,
  toolbarColor: {
    color: '#16a34a',
    background: '#f0fdf4',
    hoverBackground: '#dcfce7',
    darkColor: '#4ade80',
    darkBackground: 'rgba(20, 83, 45, 0.3)',
    darkHoverBackground: 'rgba(20, 83, 45, 0.5)',
  },
};

export const productListWidgetDefinition: WidgetDefinition<ProductListWidgetData> = {
  type: 'product_list',
  displayName: '商品列表',
  description: '显示多个商品的网格列表',
  component: ProductListWidgetComponent,
  icon: <LayoutGrid size={16} />,
  toolbarColor: {
    color: '#ea580c',
    background: '#fff7ed',
    hoverBackground: '#ffedd5',
    darkColor: '#fb923c',
    darkBackground: 'rgba(154, 52, 18, 0.3)',
    darkHoverBackground: 'rgba(154, 52, 18, 0.5)',
  },
};

export const priceComparisonWidgetDefinition: WidgetDefinition<PriceComparisonWidgetData> = {
  type: 'price_comparison',
  displayName: '价格对比',
  description: '以表格形式对比不同选项的价格',
  component: PriceComparisonWidgetComponent,
  icon: <Table2 size={16} />,
  toolbarColor: {
    color: '#0d9488',
    background: '#f0fdfa',
    hoverBackground: '#ccfbf1',
    darkColor: '#2dd4bf',
    darkBackground: 'rgba(19, 78, 74, 0.3)',
    darkHoverBackground: 'rgba(19, 78, 74, 0.5)',
  },
};

// 注册内置 Widget
registerWidget(orderWidgetDefinition);
registerWidget(logisticsWidgetDefinition);
registerWidget(productWidgetDefinition);
registerWidget(productListWidgetDefinition);
registerWidget(priceComparisonWidgetDefinition);

// 导出内置 Widget 定义（供开发模式工具栏使用）
export const builtinWidgetDefinitions = [
  orderWidgetDefinition,
  logisticsWidgetDefinition,
  productWidgetDefinition,
  productListWidgetDefinition,
  priceComparisonWidgetDefinition,
];
