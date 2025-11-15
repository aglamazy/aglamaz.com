'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import EditorRich from '@/components/ui/EditorRich';
import AddFab from '@/components/ui/AddFab';

interface Blessing {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
}

export default function BlessingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { t, i18n } = useTranslation();
  const { user } = useUserStore();
  const member = useMemberStore((state) => state.member);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blessingPage, setBlessingPage] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [blessings, setBlessings] = useState<Blessing[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlessing, setEditingBlessing] = useState<Blessing | null>(null);
  const [blessingContent, setBlessingContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBlessings = async (blessingPageId: string) => {
    try {
      const data = await apiFetch<{ blessings: Blessing[] }>(
        `/api/blessing-pages/${blessingPageId}/blessings`
      );
      setBlessings(data.blessings || []);
    } catch (err) {
      console.error('Failed to load blessings:', err);
    }
  };

  useEffect(() => {
    const fetchBlessingPage = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<{ blessingPage: any; event: any }>(
          `/api/blessing-pages/by-slug/${slug}`
        );
        setBlessingPage(data.blessingPage);
        setEvent(data.event);

        // Fetch blessings
        if (data.blessingPage?.id) {
          await fetchBlessings(data.blessingPage.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load blessing page');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchBlessingPage();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">{t('errorOccurred')}</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!blessingPage || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t('errorOccurred')}</h1>
          <p>{t('blessingPageNotFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={i18n.dir()}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-8">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">{event.name}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            {t('blessingPageTitle')} - {blessingPage.year}
          </p>
          {event.description && (
            <p className="text-gray-700 dark:text-gray-300 mb-4">{event.description}</p>
          )}
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt={event.name}
              className="w-full max-w-md mx-auto rounded-lg mb-6"
            />
          )}

          {/* Blessings List */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              {t('blessingsCount', { count: blessings.length })}
            </h2>
            {blessings.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                {t('noBlessingsYet')}
              </p>
            ) : (
              <div className="space-y-4">
                {blessings.map((blessing) => {
                  const isAuthor = user && blessing.authorId === user.user_id;
                  const isAdmin = member && member.role === 'admin';
                  const canEdit = isAuthor || isAdmin;
                  return (
                    <div
                      key={blessing.id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                            {blessing.authorName.charAt(0)}
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {blessing.authorName}
                          </span>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditingBlessing(blessing);
                              setBlessingContent(blessing.content);
                              setModalOpen(true);
                            }}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {t('edit')}
                          </button>
                        )}
                      </div>
                      <div
                        className="text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: blessing.content }}
                        dir={i18n.dir()}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB - Floating Action Button */}
      <AddFab
        onClick={() => {
          setEditingBlessing(null);
          setBlessingContent('');
          setModalOpen(true);
        }}
        ariaLabel={t('addYourBlessing')}
      />

      {/* Add/Edit Blessing Modal */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50" onClick={() => {
          setModalOpen(false);
          setEditingBlessing(null);
          setBlessingContent('');
        }}>
          <div
            className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setModalOpen(false);
                setEditingBlessing(null);
                setBlessingContent('');
              }}
              className="absolute top-3 right-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-4">
              {editingBlessing ? t('editBlessing') : t('addYourBlessing')}
            </h2>
            <div className="mb-4">
              <EditorRich
                value={blessingContent}
                onChange={setBlessingContent}
                locale={i18n.language}
                emojis={['🎂', '🥳', '🎊', '🍷', '🎁', '🕯️', '❤️', '💙']}
                onDelete={editingBlessing ? async () => {
                  if (!blessingPage?.id || !editingBlessing) return;
                  await apiFetch(`/api/blessing-pages/${blessingPage.id}/blessings/${editingBlessing.id}`, {
                    method: 'DELETE',
                  });
                  setBlessingContent('');
                  setEditingBlessing(null);
                  setModalOpen(false);
                  await fetchBlessings(blessingPage.id);
                } : undefined}
                deleteConfirmMessage={t('confirmDeleteBlessing')}
              />
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingBlessing(null);
                  setBlessingContent('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {t('cancel')}
              </button>
              <button
                onClick={async () => {
                  if (!blessingPage?.id) return;
                  try {
                    setSubmitting(true);
                    if (editingBlessing) {
                      // Update existing blessing
                      await apiFetch(`/api/blessing-pages/${blessingPage.id}/blessings/${editingBlessing.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: blessingContent }),
                      });
                    } else {
                      // Create new blessing
                      await apiFetch(`/api/blessing-pages/${blessingPage.id}/blessings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: blessingContent }),
                      });
                    }
                    setBlessingContent('');
                    setEditingBlessing(null);
                    setModalOpen(false);
                    // Refresh blessings
                    await fetchBlessings(blessingPage.id);
                  } catch (err) {
                    console.error('Failed to save blessing:', err);
                    alert(t('errorOccurred'));
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !blessingContent.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t('submitting') : (editingBlessing ? t('save') : t('postBlessing'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
