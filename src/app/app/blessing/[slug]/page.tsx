'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import EditorRich from '@/components/ui/EditorRich';
import AddFab from '@/components/ui/AddFab';

interface Blessing {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
  visibleToPublic?: boolean;
  isNonMemberContribution?: boolean;
}

export default function BlessingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { t, i18n } = useTranslation();
  const { user } = useUserStore();
  const member = useMemberStore((state) => state.member);
  const siteId = useSiteStore((state) => state.siteInfo?.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blessingPage, setBlessingPage] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [blessings, setBlessings] = useState<Blessing[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlessing, setEditingBlessing] = useState<Blessing | null>(null);
  const [blessingContent, setBlessingContent] = useState('');
  const [blessingVisibleToPublic, setBlessingVisibleToPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const isAdmin = member && member.role === 'admin';

  const fetchBlessings = async (blessingPageId: string) => {
    if (!siteId) return;
    try {
      const data = await apiFetch<{ blessings: Blessing[] }>(
        ApiRoute.SITE_BLESSING_PAGE_BLESSINGS,
        { pathParams: { pageId: blessingPageId } }
      );
      setBlessings(data.blessings || []);
    } catch (err) {
      console.error('Failed to load blessings:', err);
    }
  };

  useEffect(() => {
    const fetchBlessingPage = async () => {
      if (!siteId) return;
      try {
        setLoading(true);
        const data = await apiFetch<{ blessingPage: any; event: any }>(
          ApiRoute.SITE_BLESSING_PAGES_BY_SLUG,
          { pathParams: { slug } }
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
  }, [siteId, slug]);

  const handleTogglePublic = async () => {
    if (!siteId || !blessingPage?.id) return;
    const nextIsPublic = !blessingPage.isPublic;
    setTogglingPublic(true);
    try {
      const data = await apiFetch<{ blessingPage: any }>(
        ApiRoute.SITE_BLESSING_PAGE_BY_ID,
        { method: 'PATCH', pathParams: { pageId: blessingPage.id }, body: { isPublic: nextIsPublic } }
      );
      setBlessingPage(data.blessingPage);
    } catch (err) {
      console.error('Failed to update blessing page visibility:', err);
      alert(t('errorOccurred'));
    } finally {
      setTogglingPublic(false);
    }
  };

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

  const isMemorial = event.type === 'death';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={i18n.dir()}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-8">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">{event.name}</h1>
          {event.type !== 'death' && typeof blessingPage.year === 'number' && (
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
              {t('blessingPageTitle')} - {blessingPage.year}
            </p>
          )}
          {isAdmin ? (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {blessingPage.isPublic ? t('blessingPagePublic') : t('blessingPagePrivate')}
              </span>
              <button
                onClick={handleTogglePublic}
                disabled={togglingPublic}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {blessingPage.isPublic ? t('makePrivate') : t('makePublic')}
              </button>
            </div>
          ) : (
            blessingPage.isPublic && (
              <div className="flex items-center gap-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
                <span aria-hidden="true">ℹ️</span>
                <span>{t('blessingPagePublic')}</span>
              </div>
            )
          )}
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
              {t(isMemorial ? 'memoriesCount' : 'blessingsCount', { count: blessings.length })}
            </h2>
            {blessings.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                {t(isMemorial ? 'noMemoriesYet' : 'noBlessingsYet')}
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
                          {blessing.isNonMemberContribution && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                              {t('nonMemberContributionBadge')}
                            </span>
                          )}
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditingBlessing(blessing);
                              setBlessingContent(blessing.content);
                              setBlessingVisibleToPublic(blessing.visibleToPublic === true);
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
          setBlessingVisibleToPublic(false);
          setModalOpen(true);
        }}
        ariaLabel={t(isMemorial ? 'addYourMemory' : 'addYourBlessing')}
      />

      {/* Add/Edit Blessing Modal */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50" onClick={() => {
          setModalOpen(false);
          setEditingBlessing(null);
          setBlessingContent('');
          setBlessingVisibleToPublic(false);
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
                setBlessingVisibleToPublic(false);
              }}
              className="absolute top-3 right-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-4">
              {editingBlessing
                ? t(isMemorial ? 'editMemory' : 'editBlessing')
                : t(isMemorial ? 'addYourMemory' : 'addYourBlessing')}
            </h2>
            <div className="mb-4">
              <EditorRich
                value={blessingContent}
                onChange={setBlessingContent}
                locale={i18n.language}
                emojis={['🎂', '🥳', '🎊', '🍷', '🎁', '🕯️', '❤️', '💙']}
                onDelete={editingBlessing ? async () => {
                  if (!blessingPage?.id || !editingBlessing) return;
                  await apiFetch(ApiRoute.SITE_BLESSING_BY_ID, {
                    method: 'DELETE',
                    pathParams: { pageId: blessingPage.id, blessingId: editingBlessing.id },
                  });
                  setBlessingContent('');
                  setEditingBlessing(null);
                  setModalOpen(false);
                  await fetchBlessings(blessingPage.id);
                } : undefined}
                deleteConfirmMessage={t('confirmDeleteBlessing')}
              />
            </div>
            <label className="flex items-start gap-2 mb-4 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={blessingVisibleToPublic}
                onChange={(e) => setBlessingVisibleToPublic(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{t('blessingVisibleToPublic')}</span>
                <br />
                <span className="text-gray-500 dark:text-gray-400">{t('blessingVisibleToPublicHint')}</span>
              </span>
            </label>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingBlessing(null);
                  setBlessingContent('');
                  setBlessingVisibleToPublic(false);
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
                      await apiFetch(ApiRoute.SITE_BLESSING_BY_ID, {
                        method: 'PUT',
                        pathParams: { pageId: blessingPage.id, blessingId: editingBlessing.id },
                        body: { content: blessingContent, visibleToPublic: blessingVisibleToPublic },
                      });
                    } else {
                      // Create new blessing
                      await apiFetch(ApiRoute.SITE_BLESSING_PAGE_BLESSINGS, {
                        method: 'POST',
                        pathParams: { pageId: blessingPage.id },
                        body: { content: blessingContent, visibleToPublic: blessingVisibleToPublic },
                      });
                    }
                    setBlessingContent('');
                    setBlessingVisibleToPublic(false);
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
                {submitting
                  ? t('submitting')
                  : editingBlessing
                    ? t('save')
                    : t(isMemorial ? 'postMemory' : 'postBlessing')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
