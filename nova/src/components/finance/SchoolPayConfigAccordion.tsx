'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle, Copy, Check, Shield, Wifi, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SchoolPayConfigData {
  schoolCode?: string;
  enabled?: boolean;
  autoPostMatched?: boolean;
  allowedIps?: string | null;
  hasApiPassword?: boolean;
  hasChannelKey?: boolean;
  hasWebhookSecret?: boolean;
  lastSyncedAt?: string | null;
}

interface SchoolPayConfigAccordionProps {
  initialConfig?: SchoolPayConfigData | null;
  onConfigSaved?: () => void;
}

export default function SchoolPayConfigAccordion({
  initialConfig,
  onConfigSaved
}: SchoolPayConfigAccordionProps) {
  const [isOpen, setIsOpen] = useState(!initialConfig?.schoolCode);
  const [schoolCode, setSchoolCode] = useState(initialConfig?.schoolCode || '');
  const [apiPassword, setApiPassword] = useState('');
  const [channelKey, setChannelKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? false);
  const [autoPostMatched, setAutoPostMatched] = useState(initialConfig?.autoPostMatched ?? true);
  const [allowedIps, setAllowedIps] = useState(initialConfig?.allowedIps || '');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/schoolpay/webhook/${schoolCode || '{yourSchoolCode}'}`
    : `/api/schoolpay/webhook/${schoolCode || '{yourSchoolCode}'}`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/schoolpay/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolCode: schoolCode.trim(),
          apiPassword: apiPassword.trim() || undefined,
          channelKey: channelKey.trim() || undefined,
          webhookSecret: webhookSecret.trim() || undefined,
          enabled,
          autoPostMatched,
          allowedIps: allowedIps.trim() || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update configuration');
      }

      setMessage({ type: 'success', text: 'SchoolPay settings saved successfully!' });
      setApiPassword('');
      setChannelKey('');
      setWebhookSecret('');
      onConfigSaved?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/schoolpay/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolCode: schoolCode.trim(),
          apiPassword: apiPassword.trim() || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Connection verified successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Connection failed' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error testing connection';
      setMessage({ type: 'error', text: msg });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6 transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <Wifi size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              SchoolPay Uganda Connection Settings
              {enabled ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle size={12} /> Connected & Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <AlertCircle size={12} /> Inactive / Not Configured
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated gateway syncing for Stanbic, Centenary, Absa, MTN MoMo, and Airtel Money
            </p>
          </div>
        </div>

        <div className="text-slate-400">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/40">
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold mb-4 flex items-center gap-2.5 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  School Code *
                </label>
                <input
                  type="text"
                  required
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                  placeholder="e.g. 100234 (from SchoolPay)"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-mono font-medium"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Unique school identifier issued by SchoolPay (0200 502 140 · support@schoolpay.co.ug).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Key size={13} className="text-slate-400" /> API Password
                  {initialConfig?.hasApiPassword && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 font-semibold px-1.5 py-0.2 rounded border border-emerald-200">
                      Saved & Encrypted
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={apiPassword}
                  onChange={(e) => setApiPassword(e.target.value)}
                  placeholder={initialConfig?.hasApiPassword ? '•••••••••••••••• (Leave blank to keep current)' : 'Enter API Password from SchoolPay'}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Shield size={13} className="text-slate-400" /> Webhook HMAC Secret (Optional)
                  {initialConfig?.hasWebhookSecret && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 font-semibold px-1.5 py-0.2 rounded border border-emerald-200">
                      Configured
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={initialConfig?.hasWebhookSecret ? '•••••••••••••••• (Leave blank to keep current)' : 'Shared secret for signature verification'}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Allowed IP Addresses (Optional)
                </label>
                <input
                  type="text"
                  value={allowedIps}
                  onChange={(e) => setAllowedIps(e.target.value)}
                  placeholder="e.g. 197.239.12.4, 41.220.10.12"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                />
              </div>
            </div>

            {/* Toggle checkboxes */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                Enable SchoolPay Webhook Ingestion & Syncing
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPostMatched}
                  onChange={(e) => setAutoPostMatched(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                Automatically Post High-Confidence Student Matches to Ledger
              </label>
            </div>

            {/* Live Webhook Info Box */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-800 mb-1">
                Real-Time Webhook Endpoint
              </p>
              <p className="text-[11px] text-slate-500 mb-2">
                Provide this URL to SchoolPay Support (support@schoolpay.co.ug) so parent payments arrive instantly:
              </p>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <code className="text-xs font-mono text-emerald-800 flex-1 break-all">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className="p-1 text-slate-500 hover:text-emerald-700 transition-colors"
                  title="Copy Webhook URL"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-5 shadow-sm"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={testing}
                onClick={handleTestConnection}
                className="font-bold text-xs h-9 px-4"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
