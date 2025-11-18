'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ApiRoute } from '@/utils/urls';

export interface GalleryPhotoForEdit {
  id: string;
  date: any;
  description?: string;
  images: string[];
}

interface GalleryPhotoEditModalProps {
  photoId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (updated: GalleryPhotoForEdit) => void;
  initialPhoto: GalleryPhotoForEdit | null;
}

export default function GalleryPhotoEditModal({
  photoId,
  isOpen,
  onClose,
  onUpdated,
  initialPhoto,
}: GalleryPhotoEditModalProps) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form with photo data
  useEffect(() => {
    if (isOpen && initialPhoto) {
      // Set date
      const d = initialPhoto.date as any;
      const sec = d?._seconds ?? d?.seconds;
      const js = typeof sec === 'number' ? new Date(sec * 1000) : (d?.toDate ? d.toDate() : new Date(d));
      const yyyy = js.getFullYear();
      const mm = String(js.getMonth() + 1).padStart(2, '0');
      const dd = String(js.getDate()).padStart(2, '0');
      setDate(`${yyyy}-${mm}-${dd}`);

      // Set description
      setDescription(initialPhoto.description || '');
      setError('');
    }
  }, [isOpen, initialPhoto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      setError(t('pleaseSelectDate') || 'Please select a date');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiFetch(ApiRoute.SITE_PHOTO_BY_ID, {
        method: 'PUT',
        pathParams: { photoId },
        body: {
          date,
          description: description.trim(),
          locale: i18n.language,
        },
      });

      onUpdated?.({
        id: photoId,
        date: new Date(date),
        description: description.trim(),
        images: initialPhoto?.images || [],
      });

      onClose();
    } catch (err) {
      console.error('Update failed:', err);
      setError((err as Error).message || t('updateFailed') || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setSaving(true);
    setError('');

    try {
      await apiFetch(ApiRoute.SITE_PHOTO_BY_ID, {
        method: 'DELETE',
        pathParams: { photoId },
      });

      // Trigger update to remove from feed
      onUpdated?.({
        id: photoId,
        date: initialPhoto?.date,
        description: '',
        images: [],
      });

      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
      setError((err as Error).message || t('deleteFailed') || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      {/* Mobile: slide up from bottom, Desktop: centered modal */}
      <div className="bg-white w-full sm:max-w-lg sm:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('editPhoto') || 'Edit Photo'}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 pb-24 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('date') || 'Date'} *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('description') || 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('addDescription') || 'Add a description...'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[80px]"
              rows={3}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={handleDeleteClick}
              variant="outline"
              className="text-danger hover:bg-danger-50"
              disabled={saving}
            >
              {t('delete') || 'Delete'}
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={saving}
            >
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
            </Button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('deletePhoto') || 'Delete Photo'}
        message={t('confirmDeletePhoto') || 'Are you sure you want to delete this photo?'}
        destructive={true}
        loading={saving}
        error={error}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
