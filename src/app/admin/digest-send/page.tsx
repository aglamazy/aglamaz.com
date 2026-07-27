"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { Loader2, Mail, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSiteStore } from '@/store/SiteStore';

export default function DigestSendPage() {
  const { t } = useTranslation();
  const site = useSiteStore(state => state.siteInfo);
  const [previewSending, setPreviewSending] = useState(false);
  const [previewResult, setPreviewResult] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [todayPreviewSending, setTodayPreviewSending] = useState(false);
  const [todayPreviewResult, setTodayPreviewResult] = useState('');
  const [todayPreviewError, setTodayPreviewError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState('');
  const [publishError, setPublishError] = useState('');

  const handleSendPreview = async () => {
    if (!site?.id) return;
    setPreviewSending(true);
    setPreviewError('');
    setPreviewResult('');
    try {
      const result = await apiFetch<{ sentTo: string }>(ApiRoute.SITE_DIGEST_PREVIEW_SEND, {
        method: 'POST',
      });
      setPreviewResult(t('digestPreviewSent', { email: result.sentTo }) || `Preview sent to ${result.sentTo}`);
      setTimeout(() => setPreviewResult(''), 6000);
    } catch (err) {
      console.error('Failed to send digest preview', err);
      setPreviewError(t('digestPreviewFailed') || 'Failed to send preview');
    } finally {
      setPreviewSending(false);
    }
  };

  const handleSendTodayPreview = async () => {
    if (!site?.id) return;
    setTodayPreviewSending(true);
    setTodayPreviewError('');
    setTodayPreviewResult('');
    try {
      const result = await apiFetch<{ sentTo: string }>(ApiRoute.SITE_DIGEST_PREVIEW_SEND, {
        method: 'POST',
        queryParams: { asOf: 'now' },
      });
      setTodayPreviewResult(t('digestPreviewSent', { email: result.sentTo }) || `Preview sent to ${result.sentTo}`);
      setTimeout(() => setTodayPreviewResult(''), 6000);
    } catch (err) {
      console.error('Failed to send today\'s digest preview', err);
      setTodayPreviewError(t('digestPreviewFailed') || 'Failed to send preview');
    } finally {
      setTodayPreviewSending(false);
    }
  };

  const handlePublishNow = async () => {
    if (!site?.id) return;
    if (!window.confirm(t('publishNowConfirm') || 'This sends the real magazine to real family members right now, ignoring anyone already sent to this period. Continue?')) {
      return;
    }
    setPublishing(true);
    setPublishError('');
    setPublishResult('');
    try {
      const result = await apiFetch<{ cadence: string; period: string; recipients: number; sent: number; failed: number }>(
        ApiRoute.SITE_DIGEST_PUBLISH_NOW,
        { method: 'POST' },
      );
      setPublishResult(
        t('publishNowResult', { sent: result.sent, recipients: result.recipients, failed: result.failed, cadence: result.cadence }) ||
          `Sent ${result.sent}/${result.recipients} (${result.cadence}), ${result.failed} failed`,
      );
      setTimeout(() => setPublishResult(''), 10000);
    } catch (err) {
      console.error('Failed to publish digest now', err);
      setPublishError(t('publishNowFailed') || 'Failed to send');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('digestSendTitle') || 'Family Magazine Digest'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block mb-2 text-lg font-semibold text-sage-700">
              {t('digestPreview') || 'Preview the family magazine'}
            </label>
            <p className="text-sm text-sage-600 mb-3">
              {t('digestPreviewDescription') || "Emails you a preview of who would receive the digest and in which language, plus a content sample - doesn't send to anyone else and doesn't count as a real send."}
            </p>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSendPreview}
                disabled={previewSending}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {previewSending ? (t('sending') || 'Sending...') : (t('sendDigestPreview') || 'Send me a preview')}
              </Button>
              {previewResult && (
                <p className="text-green-600 text-sm">{previewResult}</p>
              )}
              {previewError && (
                <p className="text-red-600 text-sm">{previewError}</p>
              )}
            </div>

            <p className="text-sm text-sage-600 mt-4 mb-3">
              {t('digestPreviewTodayDescription') ||
                "Shows what would be sent right now, instead of rehearsing the next scheduled send - use this if today's send window already passed but you still want to check (or catch up on) this period."}
            </p>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSendTodayPreview}
                disabled={todayPreviewSending}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {todayPreviewSending ? (t('sending') || 'Sending...') : (t('sendDigestPreviewToday') || "Preview today's magazine")}
              </Button>
              {todayPreviewResult && (
                <p className="text-green-600 text-sm">{todayPreviewResult}</p>
              )}
              {todayPreviewError && (
                <p className="text-red-600 text-sm">{todayPreviewError}</p>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-red-200">
            <label className="block mb-2 text-lg font-semibold text-red-700">
              {t('publishNow') || 'Publish now'}
            </label>
            <p className="text-sm text-sage-600 mb-3">
              {t('publishNowDescription') ||
                "Sends the real magazine to real family members right now - ignores anyone already sent to this period, so use this to re-send a corrected edition."}
            </p>
            <div className="flex items-center gap-4">
              <Button
                onClick={handlePublishNow}
                disabled={publishing}
                variant="outline"
                className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
              >
                <Send className="w-4 h-4" />
                {publishing ? (t('sending') || 'Sending...') : (t('publishNow') || 'Publish now')}
              </Button>
              {publishResult && (
                <p className="text-green-600 text-sm">{publishResult}</p>
              )}
              {publishError && (
                <p className="text-red-600 text-sm">{publishError}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
