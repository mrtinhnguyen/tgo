import React, { useEffect } from 'react';
import { X, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToolStoreAuthStore } from '@/stores/toolStoreAuthStore';
import { useToast } from './ToolToastProvider';
import { generateCodeVerifier, generateCodeChallenge } from '@/utils/pkce';
import { TOOL_STORE_URLS } from '@/constants';

interface StoreLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StoreLoginModal: React.FC<StoreLoginModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { exchangeCode, isLoading } = useToolStoreAuthStore();
  
  const handleOpenLogin = async () => {
    try {
      // 1. 生成 PKCE 密钥对
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomUUID();
      
      // 2. 存储（verifier 不能泄露！）
      sessionStorage.setItem('toolstore_pkce_verifier', codeVerifier);
      sessionStorage.setItem('toolstore_auth_state', state);
      
      // 3. 打开登录弹窗
      const loginUrl = `${TOOL_STORE_URLS.WEB}/auth/callback?` +
        `state=${state}&code_challenge=${codeChallenge}`;
      
      const width = 520;
      const height = 680;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        loginUrl, 
        'toolstore_login', 
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );
    } catch (error) {
      console.error('Failed to initiate login:', error);
      showToast('error', t('common.error'), '无法启动登录流程');
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // 验证消息类型
      if (event.data?.type !== 'TOOLSTORE_AUTH_CODE') return;
      
      // 验证 state
      const savedState = sessionStorage.getItem('toolstore_auth_state');
      if (event.data.state !== savedState) {
        console.warn('Auth state mismatch');
        return;
      }
      
      // 获取 code_verifier
      const codeVerifier = sessionStorage.getItem('toolstore_pkce_verifier');
      if (!codeVerifier) {
        console.warn('Missing code verifier');
        return;
      }
      
      try {
        // 用 code + code_verifier 换 token
        await exchangeCode(event.data.code, codeVerifier);
        showToast('success', t('tools.store.loginSuccess', '登录成功'), t('tools.store.loginSuccessDesc', '您现在可以安装和管理商店工具了'));
        onClose();
      } catch (error: any) {
        console.error('Code exchange failed:', error);
        showToast('error', t('tools.store.loginFailed', '授权失败'), '授权码无效或已过期');
      } finally {
        // 清理
        sessionStorage.removeItem('toolstore_pkce_verifier');
        sessionStorage.removeItem('toolstore_auth_state');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose, exchangeCode, showToast, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        {/* Top Decorative Banner */}
        <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center text-blue-600">
              <Sparkles className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {t('tools.store.loginTitle', '登录工具商店')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('tools.store.loginRequiredDesc', '登录后即可一键安装、同步配置并管理您的 AI 工具集。')}
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2rem] border border-blue-100/50 dark:border-blue-800/30">
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300 text-center mb-6 leading-relaxed">
              为了确保您的账户安全，我们将在新窗口中打开登录页面。
            </p>
            
            <button
              onClick={handleOpenLogin}
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  {t('tools.store.openLoginWindow', '去商店登录')}
                </>
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs font-bold text-gray-400 leading-relaxed px-4">
              登录成功后，此窗口将自动同步您的状态。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreLoginModal;
