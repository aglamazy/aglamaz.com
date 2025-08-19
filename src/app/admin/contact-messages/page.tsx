'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useSiteStore } from '@/store/SiteStore';
import { MessageCircle } from 'lucide-react';
import { apiFetch } from '@/utils/apiFetch';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: any;
}

function formatDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'string') return new Date(ts).toLocaleString();
  if (typeof ts === 'object' && ts._seconds)
    return new Date(ts._seconds * 1000).toLocaleString();
  return '';
}

export default function ContactMessagesPage() {
  const site = useSiteStore(state => state.siteInfo);
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await apiFetch<{messages: ContactMessage[]}>(`/api/admin/contact?siteId=${site?.id}`);
      setMessages(data.messages || []);
    };
    if (site?.id) load();
  }, [site?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <MessageCircle size={32} className="text-sage-600"/>
          <h1 className="text-3xl font-bold text-sage-700">Contact Messages</h1>
        </div>
        {messages.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">No messages</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages.map(m => (
              <Card key={m.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{m.name}</h3>
                      <p className="text-gray-600">{m.email}</p>
                      <p className="text-gray-800 mt-2 whitespace-pre-line">{m.message}</p>
                    </div>
                    <div className="text-sm text-gray-500">{formatDate(m.createdAt)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
