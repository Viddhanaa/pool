'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import {
  User,
  Shield,
  Bell,
  Key,
  Copy,
  Eye,
  EyeOff,
  Check,
  Trash2,
  Plus,
  AlertTriangle,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const tabContentVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

type TabType = 'profile' | 'security' | 'notifications' | 'api';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  permissions: string[];
}

interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  workerOffline: boolean;
  payoutReceived: boolean;
  blockFound: boolean;
  securityAlerts: boolean;
}

interface FormErrors {
  walletAddress?: string;
  username?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  apiKeyName?: string;
}

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // Profile form state
  const [walletAddress, setWalletAddress] = useState(user?.walletAddress || '');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(user?.email || '');

  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Notification settings state
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    workerOffline: true,
    payoutReceived: true,
    blockFound: true,
    securityAlerts: true,
  });

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Production API',
      key: 'vdp_sk_prod_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      createdAt: '2024-01-15T10:30:00Z',
      lastUsed: '2024-01-20T14:22:00Z',
      permissions: ['read', 'write'],
    },
    {
      id: '2',
      name: 'Monitoring',
      key: 'vdp_sk_mon_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
      createdAt: '2024-01-18T08:15:00Z',
      lastUsed: null,
      permissions: ['read'],
    },
  ]);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    variant: 'danger' | 'warning';
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tabs = [
    { id: 'profile' as TabType, label: 'Profile', icon: User },
    { id: 'security' as TabType, label: 'Security', icon: Shield },
    { id: 'notifications' as TabType, label: 'Notifications', icon: Bell },
    { id: 'api' as TabType, label: 'API Keys', icon: Key },
  ];

  // Validation functions
  const validateProfile = useCallback(() => {
    const newErrors: FormErrors = {};
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      newErrors.walletAddress = 'Invalid wallet address format';
    }
    if (username && (username.length < 3 || username.length > 20)) {
      newErrors.username = 'Username must be 3-20 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [walletAddress, username]);

  const validatePassword = useCallback(() => {
    const newErrors: FormErrors = {};
    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentPassword, newPassword, confirmPassword]);

  // Action handlers
  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (user) {
        setUser({ ...user, email: email || user.email });
      }
      showFeedback('success', 'Profile updated successfully');
    } catch {
      showFeedback('error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle2FA = () => {
    setConfirmDialog({
      isOpen: true,
      title: twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA',
      message: twoFactorEnabled
        ? 'Disabling 2FA will make your account less secure. Continue?'
        : 'You will be redirected to set up authenticator app.',
      variant: twoFactorEnabled ? 'danger' : 'warning',
      action: async () => {
        setIsLoading(true);
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setTwoFactorEnabled(!twoFactorEnabled);
          showFeedback('success', `2FA ${twoFactorEnabled ? 'disabled' : 'enabled'} successfully`);
        } catch {
          showFeedback('error', 'Failed to update 2FA settings');
        } finally {
          setIsLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showFeedback('success', 'Password changed successfully');
    } catch {
      showFeedback('error', 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationChange = (key: keyof NotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveNotifications = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showFeedback('success', 'Notification preferences saved');
    } catch {
      showFeedback('error', 'Failed to save preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      setErrors({ apiKeyName: 'API key name is required' });
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const newKey = `vdp_sk_${Math.random().toString(36).substring(2, 34)}`;
      const newApiKey: ApiKey = {
        id: Date.now().toString(),
        name: newApiKeyName,
        key: newKey,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        permissions: ['read', 'write'],
      };
      setApiKeys((prev) => [...prev, newApiKey]);
      setGeneratedKey(newKey);
      setNewApiKeyName('');
    } catch {
      showFeedback('error', 'Failed to generate API key');
      setShowNewKeyModal(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeApiKey = (keyId: string) => {
    const keyToRevoke = apiKeys.find((k) => k.id === keyId);
    setConfirmDialog({
      isOpen: true,
      title: 'Revoke API Key',
      message: `Are you sure you want to revoke "${keyToRevoke?.name}"? This action cannot be undone.`,
      variant: 'danger',
      action: async () => {
        setIsLoading(true);
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
          showFeedback('success', 'API key revoked');
        } catch {
          showFeedback('error', 'Failed to revoke API key');
        } finally {
          setIsLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showFeedback('error', 'Failed to copy to clipboard');
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  };

  const maskKey = (key: string) => {
    return key.substring(0, 12) + '••••••••••••••••••••';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <motion.div
      className="space-y-6 pb-8 max-w-5xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="w-1 h-8 bg-gradient-to-b from-accent to-purple rounded-full" />
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-foreground-muted">Manage your account preferences</p>
        </div>
      </motion.div>

      {/* Feedback Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border backdrop-blur-sm flex items-center gap-3 ${
              feedback.type === 'success'
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-error/10 border-error/30 text-error'
            }`}
          >
            {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" className="p-1.5">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Tab Content */}
      <motion.div variants={itemVariants}>
        <AnimatePresence mode="wait">
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Card variant="glow" padding="default" className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Profile Settings</h2>
                    <p className="text-xs text-foreground-muted">Manage your account information</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Wallet Address */}
                  <div className="space-y-2">
                    <label className="text-sm text-foreground-muted">Wallet Address</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="0x..."
                        className={`w-full px-4 py-3 rounded-lg bg-white/5 border ${
                          errors.walletAddress ? 'border-error/50' : 'border-white/10'
                        } text-foreground font-mono text-sm focus:outline-none focus:border-accent/50 transition-colors`}
                      />
                      {walletAddress && (
                        <button
                          onClick={() => copyToClipboard(walletAddress, 'wallet')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-white/10 transition-colors"
                        >
                          {copiedId === 'wallet' ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <Copy className="w-4 h-4 text-foreground-muted" />
                          )}
                        </button>
                      )}
                    </div>
                    {errors.walletAddress && (
                      <p className="text-xs text-error">{errors.walletAddress}</p>
                    )}
                  </div>

                  {/* Username */}
                  <div className="space-y-2">
                    <label className="text-sm text-foreground-muted">Username (optional)</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter display name"
                      className={`w-full px-4 py-3 rounded-lg bg-white/5 border ${
                        errors.username ? 'border-error/50' : 'border-white/10'
                      } text-foreground text-sm focus:outline-none focus:border-accent/50 transition-colors`}
                    />
                    {errors.username && <p className="text-xs text-error">{errors.username}</p>}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm text-foreground-muted">Email (optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <Button variant="outline" onClick={() => {
                    setWalletAddress(user?.walletAddress || '');
                    setUsername('');
                    setEmail(user?.email || '');
                    setErrors({});
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile} isLoading={isLoading}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              key="security"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4"
            >
              {/* 2FA Card */}
              <Card variant="glow-purple" padding="default">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple/10">
                      <Shield className="w-5 h-5 text-purple" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Two-Factor Authentication</h3>
                      <p className="text-xs text-foreground-muted">
                        Add an extra layer of security
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggle2FA}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      twoFactorEnabled ? 'bg-purple' : 'bg-white/10'
                    }`}
                  >
                    <motion.div
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
                      animate={{ left: twoFactorEnabled ? '1.5rem' : '0.25rem' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
                {twoFactorEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-3 rounded-lg bg-purple/5 border border-purple/20"
                  >
                    <div className="flex items-center gap-2 text-purple text-sm">
                      <Check className="w-4 h-4" />
                      <span>2FA is active and protecting your account</span>
                    </div>
                  </motion.div>
                )}
              </Card>

              {/* Change Password Card */}
              <Card variant="glass" padding="default" className="space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Key className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Change Password</h3>
                    <p className="text-xs text-foreground-muted">Update your account password</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <label className="text-sm text-foreground-muted">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={`w-full px-4 py-3 pr-10 rounded-lg bg-white/5 border ${
                          errors.currentPassword ? 'border-error/50' : 'border-white/10'
                        } text-foreground text-sm focus:outline-none focus:border-accent/50 transition-colors`}
                      />
                      <button
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.currentPassword && (
                      <p className="text-xs text-error">{errors.currentPassword}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="text-sm text-foreground-muted">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`w-full px-4 py-3 pr-10 rounded-lg bg-white/5 border ${
                          errors.newPassword ? 'border-error/50' : 'border-white/10'
                        } text-foreground text-sm focus:outline-none focus:border-accent/50 transition-colors`}
                      />
                      <button
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.newPassword && <p className="text-xs text-error">{errors.newPassword}</p>}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-sm text-foreground-muted">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg bg-white/5 border ${
                        errors.confirmPassword ? 'border-error/50' : 'border-white/10'
                      } text-foreground text-sm focus:outline-none focus:border-accent/50 transition-colors`}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-error">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <Button onClick={handleChangePassword} isLoading={isLoading}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Update Password
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Card variant="glass" padding="default" className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Bell className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Notification Settings</h2>
                    <p className="text-xs text-foreground-muted">Choose how you want to be notified</p>
                  </div>
                </div>

                {/* Notification Channels */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground-muted">Notification Channels</h3>
                  <div className="space-y-3">
                    <ToggleRow
                      label="Email Notifications"
                      description="Receive updates via email"
                      enabled={notifications.emailEnabled}
                      onChange={() => handleNotificationChange('emailEnabled')}
                      color="accent"
                    />
                    <ToggleRow
                      label="SMS Notifications"
                      description="Get text message alerts"
                      enabled={notifications.smsEnabled}
                      onChange={() => handleNotificationChange('smsEnabled')}
                      color="purple"
                    />
                    <ToggleRow
                      label="Push Notifications"
                      description="Browser push notifications"
                      enabled={notifications.pushEnabled}
                      onChange={() => handleNotificationChange('pushEnabled')}
                      color="accent"
                    />
                  </div>
                </div>

                {/* Notification Types */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-sm font-medium text-foreground-muted">Notification Types</h3>
                  <div className="space-y-3">
                    <ToggleRow
                      label="Worker Offline"
                      description="Alert when a worker goes offline"
                      enabled={notifications.workerOffline}
                      onChange={() => handleNotificationChange('workerOffline')}
                      color="warning"
                    />
                    <ToggleRow
                      label="Payout Received"
                      description="Notify on successful payouts"
                      enabled={notifications.payoutReceived}
                      onChange={() => handleNotificationChange('payoutReceived')}
                      color="success"
                    />
                    <ToggleRow
                      label="Block Found"
                      description="Pool found a new block"
                      enabled={notifications.blockFound}
                      onChange={() => handleNotificationChange('blockFound')}
                      color="purple"
                    />
                    <ToggleRow
                      label="Security Alerts"
                      description="Important security notifications"
                      enabled={notifications.securityAlerts}
                      onChange={() => handleNotificationChange('securityAlerts')}
                      color="error"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <Button variant="outline" onClick={() => {
                    setNotifications({
                      emailEnabled: true,
                      smsEnabled: false,
                      pushEnabled: true,
                      workerOffline: true,
                      payoutReceived: true,
                      blockFound: true,
                      securityAlerts: true,
                    });
                  }}>
                    Reset to Default
                  </Button>
                  <Button onClick={handleSaveNotifications} isLoading={isLoading}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Preferences
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'api' && (
            <motion.div
              key="api"
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4"
            >
              <Card variant="glass" padding="default">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <Key className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h2 className="font-semibold">API Keys</h2>
                      <p className="text-xs text-foreground-muted">Manage programmatic access</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setShowNewKeyModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Generate Key
                  </Button>
                </div>

                <div className="space-y-3 mt-4">
                  {apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-foreground-muted">
                      <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No API keys generated yet</p>
                    </div>
                  ) : (
                    apiKeys.map((apiKey) => (
                      <motion.div
                        key={apiKey.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-4 rounded-lg bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-sm">{apiKey.name}</span>
                              <div className="flex gap-1">
                                {apiKey.permissions.map((perm) => (
                                  <span
                                    key={perm}
                                    className="px-1.5 py-0.5 text-xs rounded bg-accent/10 text-accent"
                                  >
                                    {perm}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
                              <span className="truncate">
                                {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                              </span>
                              <button
                                onClick={() => toggleKeyVisibility(apiKey.id)}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                              >
                                {visibleKeys.has(apiKey.id) ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                              >
                                {copiedId === apiKey.id ? (
                                  <Check className="w-3.5 h-3.5 text-success" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-foreground-subtle">
                              <span>Created: {formatDate(apiKey.createdAt)}</span>
                              <span>
                                Last used:{' '}
                                {apiKey.lastUsed ? formatDate(apiKey.lastUsed) : 'Never'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevokeApiKey(apiKey.id)}
                            className="p-2 rounded-lg text-error/70 hover:text-error hover:bg-error/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Generate API Key Modal */}
      <AnimatePresence>
        {showNewKeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!generatedKey) {
                setShowNewKeyModal(false);
                setNewApiKeyName('');
                setErrors({});
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <Card variant="glow" padding="default" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {generatedKey ? 'API Key Generated' : 'Generate New API Key'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setGeneratedKey(null);
                      setNewApiKeyName('');
                      setErrors({});
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {generatedKey ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                        <p className="text-sm text-warning">
                          Copy this key now. You won&apos;t be able to see it again.
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-sm break-all">
                      {generatedKey}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => copyToClipboard(generatedKey, 'new-key')}
                    >
                      {copiedId === 'new-key' ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy to Clipboard
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-foreground-muted">Key Name</label>
                      <input
                        type="text"
                        value={newApiKeyName}
                        onChange={(e) => setNewApiKeyName(e.target.value)}
                        placeholder="e.g., Production API"
                        className={`w-full px-4 py-3 rounded-lg bg-white/5 border ${
                          errors.apiKeyName ? 'border-error/50' : 'border-white/10'
                        } text-foreground text-sm focus:outline-none focus:border-accent/50 transition-colors`}
                        autoFocus
                      />
                      {errors.apiKeyName && (
                        <p className="text-xs text-error">{errors.apiKeyName}</p>
                      )}
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowNewKeyModal(false);
                          setNewApiKeyName('');
                          setErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleGenerateApiKey} isLoading={isLoading}>
                        Generate
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog?.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <Card variant="glass" padding="default" className="space-y-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      confirmDialog.variant === 'danger' ? 'bg-error/10' : 'bg-warning/10'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-5 h-5 ${
                        confirmDialog.variant === 'danger' ? 'text-error' : 'text-warning'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">{confirmDialog.title}</h3>
                    <p className="text-sm text-foreground-muted mt-1">{confirmDialog.message}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant={confirmDialog.variant === 'danger' ? 'destructive' : 'purple'}
                    onClick={confirmDialog.action}
                    isLoading={isLoading}
                  >
                    Confirm
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Toggle Row Component
interface ToggleRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
  color: 'accent' | 'purple' | 'warning' | 'success' | 'error';
}

function ToggleRow({ label, description, enabled, onChange, color }: ToggleRowProps) {
  const colorMap = {
    accent: 'bg-accent',
    purple: 'bg-purple',
    warning: 'bg-warning',
    success: 'bg-success',
    error: 'bg-error',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-foreground-muted">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? colorMap[color] : 'bg-white/10'
        }`}
      >
        <motion.div
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
          animate={{ left: enabled ? '1.375rem' : '0.25rem' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}
