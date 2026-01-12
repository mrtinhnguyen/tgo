import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import apiClient from '@/services/api';
import { 
  ToolStoreItem, 
  ToolStoreLoginResponse, 
  ToolStoreRefreshResponse
} from '@/types';
import { STORAGE_KEYS } from '@/constants';
import type { ToolStoreCategory } from '@/types';

// 获取工具商店 API 地址
const getToolStoreBaseUrl = () => {
  // 如果没有环境变量配置，默认直接请求商店后端 (Port 8095)
  return (window as any).ENV?.VITE_TOOLSTORE_API_URL || 'http://localhost:8095/api/v1';
};

const toolStoreClient = axios.create({
  baseURL: getToolStoreBaseUrl(),
});

// 请求拦截器：注入 Access Token
toolStoreClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authDataStr = localStorage.getItem(STORAGE_KEYS.TOOLSTORE_AUTH);
    if (authDataStr) {
      try {
        const authData = JSON.parse(authDataStr);
        const token = authData.state?.accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        console.error('Failed to parse toolstore auth data', e);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：处理 401 并尝试刷新 Token
toolStoreClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // 如果是 401 且不是刷新 token 的请求
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
      originalRequest._retry = true;
      
      try {
        const authDataStr = localStorage.getItem(STORAGE_KEYS.TOOLSTORE_AUTH);
        if (authDataStr) {
          const authData = JSON.parse(authDataStr);
          const refreshToken = authData.state?.refreshToken;
          
          if (refreshToken) {
            // 调用刷新接口
            const response = await toolStoreApi.refreshToken(refreshToken);
            
            // 更新本地存储（Zustand 会自动处理，但拦截器需要同步获取新 token）
            authData.state.accessToken = response.access_token;
            authData.state.refreshToken = response.refresh_token;
            localStorage.setItem(STORAGE_KEYS.TOOLSTORE_AUTH, JSON.stringify(authData));
            
            // 重试原请求
            originalRequest.headers.Authorization = `Bearer ${response.access_token}`;
            return toolStoreClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // 刷新失败，清除登录状态
        localStorage.removeItem(STORAGE_KEYS.TOOLSTORE_AUTH);
        window.dispatchEvent(new Event('toolstore-unauthorized'));
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const toolStoreApi = {
  // --- 认证相关 ---
  
  login: async (credentials: { username: string; password: string }): Promise<ToolStoreLoginResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    
    const response = await toolStoreClient.post<ToolStoreLoginResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // 登录成功后自动绑定到当前项目
    try {
      await apiClient.post('/v1/tool-store/bind', {
        access_token: response.data.access_token
      });
    } catch (e) {
      console.error('Failed to bind ToolStore credential automatically', e);
    }

    return response.data;
  },

  exchangeCode: async (code: string, codeVerifier: string): Promise<ToolStoreLoginResponse> => {
    const response = await toolStoreClient.post<ToolStoreLoginResponse>('/auth/exchange', null, {
      params: { code, code_verifier: codeVerifier }
    });

    // 交换成功后自动绑定到当前项目
    try {
      await apiClient.post('/v1/tool-store/bind', {
        access_token: response.data.access_token
      });
    } catch (e) {
      console.error('Failed to bind ToolStore credential automatically', e);
    }

    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<ToolStoreRefreshResponse> => {
    const response = await toolStoreClient.post<ToolStoreRefreshResponse>(`/auth/refresh?refresh_token=${refreshToken}`);
    return response.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await toolStoreClient.post(`/auth/logout?refresh_token=${refreshToken}`);
  },

  getMe: async () => {
    const response = await toolStoreClient.get('/auth/me');
    return response.data;
  },

  // --- 工具相关 ---

  getCategories: async (): Promise<ToolStoreCategory[]> => {
    const response = await toolStoreClient.get<ToolStoreCategory[]>('/tools/categories');
    return response.data;
  },

  getTools: async (params?: { category?: string; search?: string; skip?: number; limit?: number }) => {
    const response = await toolStoreClient.get<{ items: ToolStoreItem[]; total: number }>('/tools', { params });
    return response.data;
  },

  getTool: async (id: string) => {
    const response = await toolStoreClient.get<ToolStoreItem>(`/tools/${id}`);
    return response.data;
  },

  installTool: async (id: string) => {
    // 1. 调用商店安装 API (记录安装状态)
    const storeResponse = await toolStoreClient.post(`/tools/${id}/install`);
    
    // 2. 调用 TGO API 同步工具到本地项目
    // TGO API 会从商店拉取详情并在 tgo-ai 中创建 ai_tools 记录
    await apiClient.post('/v1/tool-store/install', { tool_id: id });
    
    return storeResponse.data;
  },

  uninstallTool: async (id: string) => {
    // 1. 调用商店卸载 API
    const storeResponse = await toolStoreClient.delete(`/tools/${id}/uninstall`);
    
    // 2. 调用 TGO API 卸载
    await apiClient.delete(`/v1/tool-store/uninstall/${id}`);
    
    return storeResponse.data;
  },
};

export default toolStoreApi;
