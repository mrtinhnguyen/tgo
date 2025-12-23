import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PlatformAISettings from '@/components/platforms/PlatformAISettings';
import type { Platform, PlatformConfig, PlatformAIMode } from '@/types';
import { usePlatformStore } from '@/stores/platformStore';
import { useToast } from '@/hooks/useToast';
import { showApiError, showSuccess } from '@/utils/toastHelpers';
import { apiClient } from '@/services/api';

interface Props {
  platform: Platform; // expected: platform.type === 'email'
}

type EmailConfig = {
  imap_host: string;
  imap_port: number | '';
  imap_username: string;
  imap_password: string;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number | '';
  smtp_username: string;
  smtp_password: string;
  smtp_use_ssl: boolean;
  smtp_use_tls: boolean;
  use_same_credentials: boolean;
};

const defaultEmailConfig: EmailConfig = {
  imap_host: '',
  imap_port: 993,
  imap_username: '',
  imap_password: '',
  imap_use_ssl: true,
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_use_ssl: false,
  smtp_use_tls: true,
  use_same_credentials: true,
};

// Email provider configuration mapping
interface ProviderConfig {
  name: string;
  imap_host: string;
  imap_port: number;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_use_ssl: boolean;
  smtp_use_tls: boolean;
}

const EMAIL_PROVIDERS: Record<string, ProviderConfig> = {
  'gmail.com': {
    name: 'Gmail',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  'qq.com': {
    name: 'QQ Mail',
    imap_host: 'imap.qq.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.qq.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
  'outlook.com': {
    name: 'Outlook',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  'hotmail.com': {
    name: 'Hotmail',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  'live.com': {
    name: 'Live',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    smtp_use_ssl: false,
    smtp_use_tls: true,
  },
  '163.com': {
    name: '163 Mail',
    imap_host: 'imap.163.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.163.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
  '126.com': {
    name: '126 Mail',
    imap_host: 'imap.126.com',
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: 'smtp.126.com',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_use_tls: false,
  },
};

// Extract domain from email address
const extractDomain = (email: string): string | null => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : null;
};

const EmailPlatformConfig: React.FC<Props> = ({ platform }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const updatePlatformConfig = usePlatformStore(s => s.updatePlatformConfig);
  const savePlatformConfig = usePlatformStore(s => s.savePlatformConfig);
  const updatePlatform = usePlatformStore(s => s.updatePlatform);
  const deletePlatform = usePlatformStore(s => s.deletePlatform);
  const enablePlatform = usePlatformStore(s => s.enablePlatform);
  const disablePlatform = usePlatformStore(s => s.disablePlatform);
  const platforms = usePlatformStore(s => s.platforms);
  const hasConfigChanges = usePlatformStore(s => s.hasConfigChanges(platform.id));
  const isUpdating = usePlatformStore(s => s.isUpdating);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const isEnabled = platform.status === 'connected';

  // Simplified/Advanced mode state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoDetectedProvider, setAutoDetectedProvider] = useState<string | null>(null);
  const [manuallyEdited, setManuallyEdited] = useState(false);

  // Name editing
  const [platformName, setPlatformName] = useState<string>(platform.name);
  useEffect(() => { setPlatformName(platform.name); }, [platform.name]);
  const hasNameChanged = useMemo(() => platformName.trim() !== platform.name, [platformName, platform.name]);

  // AI Settings state
  const [aiAgentIds, setAiAgentIds] = useState<string[]>(platform.agent_ids ?? []);
  const [aiMode, setAiMode] = useState<PlatformAIMode>(platform.ai_mode ?? 'auto');
  const [fallbackTimeout, setFallbackTimeout] = useState<number | null>(platform.fallback_to_ai_timeout ?? null);

  useEffect(() => {
    setAiAgentIds(platform.agent_ids ?? []);
    setAiMode(platform.ai_mode ?? 'auto');
    setFallbackTimeout(platform.fallback_to_ai_timeout ?? null);
  }, [platform.agent_ids, platform.ai_mode, platform.fallback_to_ai_timeout]);

  const hasAISettingsChanged = useMemo(() => {
    const origAgentIds = platform.agent_ids ?? [];
    const origMode = platform.ai_mode ?? 'auto';
    const origTimeout = platform.fallback_to_ai_timeout ?? null;
    const agentIdsChanged = JSON.stringify(aiAgentIds.sort()) !== JSON.stringify([...origAgentIds].sort());
    const modeChanged = aiMode !== origMode;
    const timeoutChanged = fallbackTimeout !== origTimeout;
    return agentIdsChanged || modeChanged || timeoutChanged;
  }, [aiAgentIds, aiMode, fallbackTimeout, platform.agent_ids, platform.ai_mode, platform.fallback_to_ai_timeout]);

  const canSave = hasConfigChanges || hasNameChanged || hasAISettingsChanged;

  // Local form state sourced from platform.config
  const initialFormValues: EmailConfig = useMemo(() => {
    const cfg = (platform.config || {}) as PlatformConfig as any;
    return {
      imap_host: cfg.imap_host ?? defaultEmailConfig.imap_host,
      imap_port: typeof cfg.imap_port === 'number' ? cfg.imap_port : (cfg.imap_port ? parseInt(cfg.imap_port, 10) || defaultEmailConfig.imap_port : defaultEmailConfig.imap_port),
      imap_username: cfg.imap_username ?? defaultEmailConfig.imap_username,
      imap_password: cfg.imap_password ?? defaultEmailConfig.imap_password,
      imap_use_ssl: typeof cfg.imap_use_ssl === 'boolean' ? cfg.imap_use_ssl : (cfg.imap_use_ssl ? Boolean(cfg.imap_use_ssl) : defaultEmailConfig.imap_use_ssl),
      smtp_host: cfg.smtp_host ?? defaultEmailConfig.smtp_host,
      smtp_port: typeof cfg.smtp_port === 'number' ? cfg.smtp_port : (cfg.smtp_port ? parseInt(cfg.smtp_port, 10) || defaultEmailConfig.smtp_port : defaultEmailConfig.smtp_port),
      smtp_username: cfg.smtp_username ?? defaultEmailConfig.smtp_username,
      smtp_password: cfg.smtp_password ?? defaultEmailConfig.smtp_password,
      smtp_use_ssl: typeof cfg.smtp_use_ssl === 'boolean' ? cfg.smtp_use_ssl : (cfg.smtp_use_ssl ? Boolean(cfg.smtp_use_ssl) : defaultEmailConfig.smtp_use_ssl),
      smtp_use_tls: typeof cfg.smtp_use_tls === 'boolean' ? cfg.smtp_use_tls : (cfg.smtp_use_tls ? Boolean(cfg.smtp_use_tls) : defaultEmailConfig.smtp_use_tls),
      use_same_credentials: typeof cfg.use_same_credentials === 'boolean' ? cfg.use_same_credentials : (cfg.use_same_credentials ? Boolean(cfg.use_same_credentials) : defaultEmailConfig.use_same_credentials),
    } as EmailConfig;
  }, [platform.config]);

  const [formValues, setFormValues] = useState<EmailConfig>(initialFormValues);
  useEffect(() => { setFormValues(initialFormValues); }, [initialFormValues]);

  // Auto-detect email provider and fill configuration
  useEffect(() => {
    if (manuallyEdited) return; // Don't override manual edits

    const email = formValues.imap_username;
    if (!email || !email.includes('@')) {
      setAutoDetectedProvider(null);
      return;
    }

    const domain = extractDomain(email);
    if (!domain || !EMAIL_PROVIDERS[domain]) {
      setAutoDetectedProvider(null);
      return;
    }

    const provider = EMAIL_PROVIDERS[domain];
    setAutoDetectedProvider(provider.name);

    // Auto-fill configuration
    setFormValues(prev => ({
      ...prev,
      imap_host: provider.imap_host,
      imap_port: provider.imap_port,
      imap_use_ssl: provider.imap_use_ssl,
      smtp_host: provider.smtp_host,
      smtp_port: provider.smtp_port,
      smtp_use_ssl: provider.smtp_use_ssl,
      smtp_use_tls: provider.smtp_use_tls,
      smtp_username: email,
      use_same_credentials: true,
    }));

    // Update store
    updatePlatformConfig(platform.id, {
      imap_host: provider.imap_host,
      imap_port: provider.imap_port,
      imap_use_ssl: provider.imap_use_ssl,
      smtp_host: provider.smtp_host,
      smtp_port: provider.smtp_port,
      smtp_use_ssl: provider.smtp_use_ssl,
      smtp_use_tls: provider.smtp_use_tls,
      smtp_username: email,
      use_same_credentials: true,
    });
  }, [formValues.imap_username, manuallyEdited, platform.id, updatePlatformConfig]);

  const handleChange = (patch: Partial<EmailConfig>, isManualEdit = false) => {
    // Mark as manually edited if user changes advanced fields
    if (isManualEdit && showAdvanced) {
      setManuallyEdited(true);
    }

    // Calculate the updated values with credential sync
    const updated = { ...formValues, ...patch };
    // Auto-sync credentials if use_same_credentials is enabled
    if (updated.use_same_credentials) {
      if (patch.imap_username !== undefined) updated.smtp_username = patch.imap_username;
      if (patch.imap_password !== undefined) updated.smtp_password = patch.imap_password;
    }

    // Update local state
    setFormValues(updated);

    // Ensure numeric type for ports when updating store
    const normalized: Partial<EmailConfig> = { ...updated };
    if (normalized.imap_port !== undefined) {
      const n = typeof normalized.imap_port === 'string' ? parseInt(normalized.imap_port as any, 10) : normalized.imap_port;
      normalized.imap_port = Number.isFinite(n as number) ? (n as number) : '';
    }
    if (normalized.smtp_port !== undefined) {
      const n = typeof normalized.smtp_port === 'string' ? parseInt(normalized.smtp_port as any, 10) : normalized.smtp_port;
      normalized.smtp_port = Number.isFinite(n as number) ? (n as number) : '';
    }

    // Accumulate changes into store for Save
    const toSave: Partial<PlatformConfig> = {
      ...(normalized.imap_host !== undefined ? { imap_host: normalized.imap_host } : {}),
      ...((normalized.imap_port !== undefined && normalized.imap_port !== '') ? { imap_port: normalized.imap_port as number } : {}),
      ...(normalized.imap_username !== undefined ? { imap_username: normalized.imap_username } : {}),
      ...(normalized.imap_password !== undefined ? { imap_password: normalized.imap_password } : {}),
      ...(normalized.imap_use_ssl !== undefined ? { imap_use_ssl: Boolean(normalized.imap_use_ssl) } : {}),
      ...(normalized.smtp_host !== undefined ? { smtp_host: normalized.smtp_host } : {}),
      ...((normalized.smtp_port !== undefined && normalized.smtp_port !== '') ? { smtp_port: normalized.smtp_port as number } : {}),
      ...(normalized.smtp_username !== undefined ? { smtp_username: normalized.smtp_username } : {}),
      ...(normalized.smtp_password !== undefined ? { smtp_password: normalized.smtp_password } : {}),
      ...(normalized.smtp_use_ssl !== undefined ? { smtp_use_ssl: Boolean(normalized.smtp_use_ssl) } : {}),
      ...(normalized.smtp_use_tls !== undefined ? { smtp_use_tls: Boolean(normalized.smtp_use_tls) } : {}),
      ...(normalized.use_same_credentials !== undefined ? { use_same_credentials: Boolean(normalized.use_same_credentials) } : {}),
    };
    updatePlatformConfig(platform.id, toSave);
  };

  const [showPassword, setShowPassword] = useState(false);

  const handleSave = async () => {
    try {
      const updates: Partial<Platform> = {};

      if (hasConfigChanges) {
        await savePlatformConfig(platform.id);
      }
      if (hasNameChanged) {
        updates.name = platformName.trim();
      }
      if (hasAISettingsChanged) {
        updates.agent_ids = aiAgentIds.length > 0 ? aiAgentIds : null;
        updates.ai_mode = aiMode;
        updates.fallback_to_ai_timeout = aiMode === 'assist' ? fallbackTimeout : null;
      }

      if (Object.keys(updates).length > 0) {
        await updatePlatform(platform.id, updates);
      }
      showSuccess(showToast, t('platforms.email.messages.saveSuccess', '保存成功'), t('platforms.email.messages.saveSuccessMessage', '邮件平台配置已保存'));
    } catch (e) {
      showApiError(showToast, e);
    }
  };

  const handleTestConnection = async () => {
    // Validate required fields
    if (!formValues.imap_username || !formValues.imap_password || !formValues.imap_host || !formValues.imap_port ||
        !formValues.smtp_host || !formValues.smtp_port) {
      showToast('error', t('platforms.email.messages.testValidationError', '请先填写完整的邮箱配置信息'));
      return;
    }

    setIsTesting(true);
    try {
      // Prepare request body
      const requestBody = {
        imap_host: formValues.imap_host,
        imap_port: typeof formValues.imap_port === 'number' ? formValues.imap_port : parseInt(String(formValues.imap_port), 10),
        imap_username: formValues.imap_username,
        imap_password: formValues.imap_password,
        imap_use_ssl: formValues.imap_use_ssl,
        smtp_host: formValues.smtp_host,
        smtp_port: typeof formValues.smtp_port === 'number' ? formValues.smtp_port : parseInt(String(formValues.smtp_port), 10),
        smtp_username: formValues.use_same_credentials ? formValues.imap_username : formValues.smtp_username,
        smtp_password: formValues.use_same_credentials ? formValues.imap_password : formValues.smtp_password,
        smtp_use_tls: formValues.smtp_use_tls,
      };

      // Call API
      interface EmailConnectionTestResponse {
        smtp_status: string;
        smtp_message: string;
        imap_status: string;
        imap_message: string;
        overall_success: boolean;
      }

      const response = await apiClient.post<EmailConnectionTestResponse>('/v1/email/test-connection', requestBody);

      // Show result
      if (response.overall_success) {
        showSuccess(
          showToast,
          t('platforms.email.messages.testSuccess', '连接测试成功'),
          t('platforms.email.messages.testSuccessMessage', 'IMAP 和 SMTP 连接均正常')
        );
      } else {
        // Show detailed error message
        const errorDetails = [];
        if (response.smtp_status !== 'success') {
          errorDetails.push(`SMTP: ${response.smtp_message}`);
        }
        if (response.imap_status !== 'success') {
          errorDetails.push(`IMAP: ${response.imap_message}`);
        }
        showToast('error', t('platforms.email.messages.testFailed', '连接测试失败'), errorDetails.join('\n'));
      }
    } catch (e) {
      showApiError(showToast, e);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <main className="flex flex-col flex-1 min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="px-6 py-4 border-b border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{platform.name} - {t('platforms.email.header.title', '邮件平台配置')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('platforms.email.header.subtitle', '配置 IMAP（接收）和 SMTP（发送）信息。')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={isUpdating || isDeleting}
            onClick={() => setConfirmOpen(true)}
            className={`px-3 py-1.5 text-sm rounded-md ${isDeleting ? 'bg-red-400 text-white' : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600'}`}
          >
            {isDeleting ? t('platforms.email.buttons.deleting', '删除中…') : t('platforms.email.buttons.delete', '删除')}
          </button>
          <button
            disabled={isUpdating || isDeleting || isToggling}
            onClick={async () => {
              if (isToggling) return;
              setIsToggling(true);
              try {
                if (isEnabled) {
                  await disablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.email.messages.disabled', '平台已禁用'));
                } else {
                  await enablePlatform(platform.id);
                  showSuccess(showToast, t('platforms.email.messages.enabled', '平台已启用'));
                }
              } catch (e) {
                showApiError(showToast, e);
              } finally {
                setIsToggling(false);
              }
            }}
            className={`px-3 py-1.5 text-sm rounded-md text-white ${isEnabled ? 'bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'} ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isToggling ? (isEnabled ? t('platforms.email.buttons.disabling', '禁用中…') : t('platforms.email.buttons.enabling', '启用中…')) : (isEnabled ? t('platforms.email.buttons.disable', '禁用') : t('platforms.email.buttons.enable', '启用'))}
          </button>
          <button
            disabled={isTesting}
            onClick={handleTestConnection}
            className={`px-3 py-1.5 text-sm rounded-md ${isTesting ? 'bg-purple-400 text-white cursor-not-allowed' : 'bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600'}`}
          >
            {isTesting ? t('platforms.email.buttons.testing', '测试中…') : t('platforms.email.buttons.testConnection', '测试连接')}
          </button>
          <button
            disabled={!canSave || isUpdating}
            onClick={handleSave}
            className={`px-3 py-1.5 text-sm rounded-md ${canSave ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
          >
            {isUpdating ? t('platforms.email.buttons.saving', '保存中…') : t('platforms.email.buttons.save', '保存')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 p-6">
        {/* Left: form */}
        <section className="lg:w-2/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 space-y-4 overflow-y-auto min-h-0 auto-hide-scrollbar">
          {/* 平台名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.name', '平台名称')}</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={t('platforms.email.form.namePlaceholder', '请输入平台名称')}
              className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
            />
          </div>

          {/* Simplified Mode: Email Address and Password */}
          <div className="space-y-4">
            {/* 邮箱地址 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                {t('platforms.email.form.emailAddress', '邮箱地址')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="email"
                value={formValues.imap_username}
                onChange={(e) => handleChange({ imap_username: e.target.value })}
                placeholder={t('platforms.email.form.emailPlaceholder', 'you@example.com')}
                className="w-full text-sm p-2 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
              />
              {autoDetectedProvider && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ {t('platforms.email.form.autoDetected', '已自动识别为')} {autoDetectedProvider}
                </p>
              )}
            </div>

            {/* 邮箱密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                {t('platforms.email.form.emailPassword', '邮箱密码')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formValues.imap_password}
                  onChange={(e) => handleChange({ imap_password: e.target.value })}
                  placeholder={showPassword ? t('platforms.email.form.passwordPlaceholder', '请输入邮箱密码或授权码') : '********'}
                  className="flex-1 text-sm p-2 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="px-3 py-2 text-xs rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  {showPassword ? t('platforms.email.buttons.hide', '隐藏') : t('platforms.email.buttons.show', '显示')}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('platforms.email.form.passwordHint', 'Gmail/QQ 邮箱需使用应用专用密码或授权码')}
              </p>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>{showAdvanced ? t('platforms.email.form.hideAdvanced', '隐藏高级设置') : t('platforms.email.form.showAdvanced', '显示高级设置')}</span>
            </button>
          </div>

          {/* AI Settings */}
          <PlatformAISettings
            platform={platform}
            agentIds={aiAgentIds}
            aiMode={aiMode}
            fallbackTimeout={fallbackTimeout}
            onAgentIdsChange={setAiAgentIds}
            onAIModeChange={setAiMode}
            onFallbackTimeoutChange={setFallbackTimeout}
          />

          {/* Advanced Settings (Collapsible) */}
          {showAdvanced && (
            <div className="space-y-4 animate-fadeIn">
              {/* IMAP Configuration */}
              <div className="bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-md space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <span>📥</span>
                  <span>{t('platforms.email.form.imapSection', 'IMAP 配置（接收邮件）')}</span>
                </h4>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.imapHost', 'IMAP 服务器')}</label>
                  <input
                    type="text"
                    value={formValues.imap_host}
                    onChange={(e) => handleChange({ imap_host: e.target.value }, true)}
                    placeholder={t('platforms.email.form.imapHostPlaceholder', '例如：imap.gmail.com')}
                    className={`w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:text-gray-200 ${autoDetectedProvider ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white/90 dark:bg-gray-700/50'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.imapPort', 'IMAP 端口')}</label>
                    <input
                      type="number"
                      value={formValues.imap_port}
                      onChange={(e) => handleChange({ imap_port: e.target.value === '' ? '' : parseInt(e.target.value, 10) || '' }, true)}
                      placeholder="993"
                      className={`w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:text-gray-200 ${autoDetectedProvider ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white/90 dark:bg-gray-700/50'}`}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center gap-2 h-[34px]">
                      <input
                        id="imapUseSsl"
                        type="checkbox"
                        checked={formValues.imap_use_ssl}
                        onChange={(e) => handleChange({ imap_use_ssl: e.target.checked }, true)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <label htmlFor="imapUseSsl" className="text-xs text-gray-700 dark:text-gray-300 select-none">{t('platforms.email.form.useSsl', '使用 SSL')}</label>
                    </div>
                  </div>
                </div>
              </div>

              {/* SMTP Configuration */}
              <div className="bg-green-50/50 dark:bg-green-900/20 p-4 rounded-md space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <span>📤</span>
                  <span>{t('platforms.email.form.smtpSection', 'SMTP 配置（发送邮件）')}</span>
                </h4>

                {/* 使用相同凭据 */}
                <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-700/40 p-2 rounded-md">
                  <input
                    id="useSameCredentials"
                    type="checkbox"
                    checked={formValues.use_same_credentials}
                    onChange={(e) => handleChange({ use_same_credentials: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label htmlFor="useSameCredentials" className="text-xs text-gray-700 dark:text-gray-300 select-none">{t('platforms.email.form.useSameCredentials', 'SMTP 使用相同凭据（推荐）')}</label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.smtpHost', 'SMTP 服务器')}</label>
                  <input
                    type="text"
                    value={formValues.smtp_host}
                    onChange={(e) => handleChange({ smtp_host: e.target.value }, true)}
                    placeholder={t('platforms.email.form.smtpHostPlaceholder', '例如：smtp.gmail.com')}
                    className={`w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:text-gray-200 ${autoDetectedProvider ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white/90 dark:bg-gray-700/50'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.smtpPort', 'SMTP 端口')}</label>
                    <input
                      type="number"
                      value={formValues.smtp_port}
                      onChange={(e) => handleChange({ smtp_port: e.target.value === '' ? '' : parseInt(e.target.value, 10) || '' }, true)}
                      placeholder="587"
                      className={`w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:text-gray-200 ${autoDetectedProvider ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white/90 dark:bg-gray-700/50'}`}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          id="smtpUseSsl"
                          type="checkbox"
                          checked={formValues.smtp_use_ssl}
                          onChange={(e) => handleChange({ smtp_use_ssl: e.target.checked, smtp_use_tls: e.target.checked ? false : formValues.smtp_use_tls }, true)}
                          className="w-3 h-3 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <label htmlFor="smtpUseSsl" className="text-xs text-gray-700 dark:text-gray-300 select-none">SSL</label>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          id="smtpUseTls"
                          type="checkbox"
                          checked={formValues.smtp_use_tls}
                          onChange={(e) => handleChange({ smtp_use_tls: e.target.checked, smtp_use_ssl: e.target.checked ? false : formValues.smtp_use_ssl }, true)}
                          className="w-3 h-3 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <label htmlFor="smtpUseTls" className="text-xs text-gray-700 dark:text-gray-300 select-none">TLS</label>
                      </div>
                    </div>
                  </div>
                </div>

                {!formValues.use_same_credentials && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.smtpUsername', 'SMTP 用户名')}</label>
                      <input
                        type="email"
                        value={formValues.smtp_username}
                        onChange={(e) => handleChange({ smtp_username: e.target.value }, true)}
                        placeholder={t('platforms.email.form.smtpUsernamePlaceholder', '通常与邮箱地址相同')}
                        className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('platforms.email.form.smtpPassword', 'SMTP 密码')}</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formValues.smtp_password}
                        onChange={(e) => handleChange({ smtp_password: e.target.value }, true)}
                        placeholder={showPassword ? t('platforms.email.form.smtpPasswordPlaceholder', '请输入 SMTP 密码') : '********'}
                        className="w-full text-sm p-1.5 border border-gray-300/80 dark:border-gray-600/80 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white/90 dark:bg-gray-700/50 dark:text-gray-200"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right: comprehensive guide */}
        <section className="lg:w-3/5 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-5 rounded-lg shadow-sm border border-gray-200/60 dark:border-gray-700/60 min-h-0 overflow-y-auto auto-hide-scrollbar space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('platforms.email.guide.title', '邮件平台配置指南（IMAP 接收 + SMTP 发送）')}</h3>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-sm rounded-md p-3">
            <p className="font-medium">{t('platforms.email.guide.tipTitle', '提示')}</p>
            <p className="mt-1" dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.tipMessage', 'IMAP 用于接收邮件，SMTP 用于发送邮件。常用端口：<span class="font-mono">IMAP SSL=993</span>，<span class="font-mono">SMTP SSL=465</span>，<span class="font-mono">SMTP TLS=587</span>。') }} />
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('platforms.email.guide.section1Title', '一、获取邮箱凭据（通用步骤）')}</h4>
            <ol className="list-decimal pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>{t('platforms.email.guide.section1Step1', '登录邮箱服务商账号（Gmail / Outlook / QQ 邮箱等）。')}</li>
              <li>{t('platforms.email.guide.section1Step2', '进入「账户设置」或「安全」页面，开启 IMAP/SMTP 服务（如需）。')}</li>
              <li>{t('platforms.email.guide.section1Step3', '如服务商要求（如 Gmail/QQ），启用两步验证并创建「应用专用密码」。')}</li>
              <li>{t('platforms.email.guide.section1Step4', '在左侧表单填写 IMAP 和 SMTP 配置。如果使用相同凭据，勾选"SMTP 使用相同凭据"。')}</li>
              <li>{t('platforms.email.guide.section1Step5', '点击右上角「保存」，随后进行收发邮件测试。')}</li>
            </ol>
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('platforms.email.guide.section2Title', '二、常用邮箱服务器与端口')}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
                  <tr>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableProvider', '服务商')}</th>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableImapServer', 'IMAP 服务器')}</th>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableImapPort', 'IMAP 端口')}</th>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableSmtpServer', 'SMTP 服务器')}</th>
                    <th className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableSmtpPort', 'SMTP 端口')}</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  <tr className="odd:bg-white dark:odd:bg-gray-800 even:bg-gray-50 dark:even:bg-gray-700">
                    <td className="px-3 py-2 border-b dark:border-gray-600">Gmail</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">imap.gmail.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">993</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">smtp.gmail.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">465/587</td>
                  </tr>
                  <tr className="odd:bg-white dark:odd:bg-gray-800 even:bg-gray-50 dark:even:bg-gray-700">
                    <td className="px-3 py-2 border-b dark:border-gray-600">Outlook</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">outlook.office365.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">993</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">smtp.office365.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">587</td>
                  </tr>
                  <tr className="odd:bg-white dark:odd:bg-gray-800 even:bg-gray-50 dark:even:bg-gray-700">
                    <td className="px-3 py-2 border-b dark:border-gray-600">{t('platforms.email.guide.tableQQMail', 'QQ 邮箱')}</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">imap.qq.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">993</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600 font-mono text-xs">smtp.qq.com</td>
                    <td className="px-3 py-2 border-b dark:border-gray-600">465/587</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('platforms.email.guide.section3Title', '三、常见服务商详解')}</h4>
            <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
              <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">{t('platforms.email.guide.gmailTitle', 'Gmail（应用专用密码）')}</summary>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                <ol className="list-decimal pl-5 space-y-1">
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep1', '前往 Google 账号安全中心 → 两步验证 → 应用专用密码；确认 IMAP/SMTP 已开启。') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep2', 'IMAP 服务器：<code class="px-1 bg-gray-100 rounded">imap.gmail.com</code>，端口：993（SSL）。') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.gmailStep3', 'SMTP 服务器：<code class="px-1 bg-gray-100 rounded">smtp.gmail.com</code>，端口：465（SSL）或 587（TLS）。') }} />
                  <li>{t('platforms.email.guide.gmailStep4', '用户名为你的 Gmail 地址；密码使用应用专用密码（IMAP 和 SMTP 使用相同密码）。')}</li>
                </ol>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-xs overflow-x-auto dark:text-gray-300">
                  <pre>{`IMAP_HOST=imap.gmail.com
IMAP_PORT=993
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
USERNAME=you@gmail.com
PASSWORD=${t('platforms.email.guide.gmailPasswordPlaceholder', '应用专用密码')}
USE_SAME_CREDENTIALS=true`}</pre>
                </div>
                <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer">{t('platforms.email.guide.gmailDocs', 'Gmail 官方指南')}</a>
              </div>
            </details>

            <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
              <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">{t('platforms.email.guide.outlookTitle', 'Outlook（Office 365）')}</summary>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                <ul className="list-disc pl-5 space-y-1">
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.outlookStep1', 'IMAP 服务器：<code class="px-1 bg-gray-100 rounded">outlook.office365.com</code>，端口：993（SSL）。') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.outlookStep2', 'SMTP 服务器：<code class="px-1 bg-gray-100 rounded">smtp.office365.com</code>，端口：587（TLS）。') }} />
                  <li>{t('platforms.email.guide.outlookStep3', '用户名通常为邮箱地址；IMAP 和 SMTP 使用相同凭据。')}</li>
                </ul>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-xs overflow-x-auto dark:text-gray-300">
                  <pre>{`IMAP_HOST=outlook.office365.com
IMAP_PORT=993
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
USERNAME=you@outlook.com
USE_SAME_CREDENTIALS=true`}</pre>
                </div>
                <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/pop-imap-smtp-settings" target="_blank" rel="noreferrer">{t('platforms.email.guide.outlookDocs', 'Microsoft 文档')}</a>
              </div>
            </details>

            <details className="rounded-md border border-gray-200 dark:border-gray-600 p-3 bg-white/70 dark:bg-gray-700/50">
              <summary className="cursor-pointer font-medium text-gray-800 dark:text-gray-100">{t('platforms.email.guide.qqTitle', 'QQ 邮箱（需开启 IMAP/SMTP）')}</summary>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-2">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>{t('platforms.email.guide.qqStep1', '进入 QQ 邮箱设置 → 账户 → 开启「IMAP/SMTP 服务」。')}</li>
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.qqStep2', '获取授权码作为密码；IMAP 服务器：<code class="px-1 bg-gray-100 rounded">imap.qq.com</code>，端口：993。') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('platforms.email.guide.qqStep3', 'SMTP 服务器：<code class="px-1 bg-gray-100 rounded">smtp.qq.com</code>，端口：465（SSL）或 587（TLS）。') }} />
                  <li>{t('platforms.email.guide.qqStep4', 'IMAP 和 SMTP 使用相同的授权码。')}</li>
                </ol>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 font-mono text-xs overflow-x-auto dark:text-gray-300">
                  <pre>{`IMAP_HOST=imap.qq.com
IMAP_PORT=993
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
USERNAME=your_qq@qq.com
PASSWORD=${t('platforms.email.guide.qqPasswordPlaceholder', '授权码')}
USE_SAME_CREDENTIALS=true`}</pre>
                </div>
                <a className="text-blue-600 dark:text-blue-400 hover:underline" href="https://wx.mail.qq.com/list/readtemplate?name=app_intro.html#/agreement/authorizationCode" target="_blank" rel="noreferrer">{t('platforms.email.guide.qqDocs', 'QQ 邮箱帮助')}</a>
              </div>
            </details>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 text-sm rounded-md p-3">
            <p className="font-semibold">{t('platforms.email.guide.troubleshootTitle', '排查指南')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>{t('platforms.email.guide.troubleshootItem1', '确认服务商已开启 IMAP/SMTP 服务；Gmail/QQ 需在设置中启用并使用应用专用密码/授权码。')}</li>
              <li>{t('platforms.email.guide.troubleshootItem2', 'IMAP 优先使用 SSL（端口 993）；SMTP 推荐使用 TLS（端口 587）或 SSL（端口 465）。')}</li>
              <li>{t('platforms.email.guide.troubleshootItem3', '核对邮箱地址（用户名）与密码是否正确，注意大小写与空格。')}</li>
              <li>{t('platforms.email.guide.troubleshootItem4', '如果勾选了"使用相同凭据"，确保 IMAP 和 SMTP 使用相同的用户名和密码。')}</li>
              <li>{t('platforms.email.guide.troubleshootItem5', '若仍失败，检查是否需要在服务商后台允许第三方客户端访问。')}</li>
            </ul>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>{t('platforms.email.guide.moreInfo', '更多文档参考：各邮箱服务商官方文档与支持页面。')}</p>
          </div>
        </section>
      </div>
      {/* Scoped scrollbar style and animations */}
      <style>{`
        .auto-hide-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.3) transparent; }
        .auto-hide-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .auto-hide-scrollbar::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 4px; }
        .auto-hide-scrollbar:hover::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.35); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('platforms.email.confirm.deleteTitle', '删除平台')}
        message={t('platforms.email.confirm.deleteMessage', '确定要删除此平台吗？')}
        confirmText={t('platforms.email.confirm.confirmText', '删除')}
        cancelText={t('platforms.email.confirm.cancelText', '取消')}
        confirmVariant="danger"
        isLoading={isDeleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (isDeleting) return;
          setIsDeleting(true);
          try {
            const idx = platforms.findIndex(p => p.id === platform.id);
            const nextId = idx !== -1
              ? (idx < platforms.length - 1 ? platforms[idx + 1]?.id : (idx > 0 ? platforms[idx - 1]?.id : null))
              : null;
            await deletePlatform(platform.id);
            showSuccess(showToast, t('platforms.email.messages.deleteSuccess', '平台已删除'), t('platforms.email.messages.deleteSuccessMessage', '平台已删除'));
            setConfirmOpen(false);
            if (nextId) navigate(`/platforms/${nextId}`);
            else navigate('/platforms');
          } catch (e) {
            showApiError(showToast, e);
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </main>
  );
};

export default EmailPlatformConfig;

