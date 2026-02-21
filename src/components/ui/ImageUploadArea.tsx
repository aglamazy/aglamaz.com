'use client';

import { Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type PreviewItem = {
  url: string;
  type: 'image' | 'video';
};

interface ImageUploadAreaProps {
  previews: (string | PreviewItem)[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  multiple?: boolean;
  accept?: string;
}

export default function ImageUploadArea({
  previews,
  onFileChange,
  onRemoveImage,
  multiple = false,
  accept = 'image/*,.heic,.heif,video/mp4',
}: ImageUploadAreaProps) {
  const { t } = useTranslation();

  return (
    <div>
      {previews.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {previews.map((item, i) => {
            const isObj = typeof item === 'object';
            const url = isObj ? item.url : item;
            const isVideo = isObj && item.type === 'video';
            return (
              <div key={i} className="relative">
                {isVideo ? (
                  <div className="w-full h-24 bg-gray-900 rounded-lg flex items-center justify-center relative overflow-hidden">
                    <video src={url} className="w-full h-24 object-cover rounded-lg" muted />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg ml-0.5">▶</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={url}
                    alt={`Preview ${i + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onRemoveImage(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-sage-500 transition">
        <Upload className="w-8 h-8 text-gray-400 mb-2" />
        <span className="text-sm text-gray-600">
          {t(multiple ? 'tapToSelectPhotos' : 'tapToSelectPhoto') || (multiple ? 'Tap to select photos' : 'Tap to select photo')}
        </span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={onFileChange}
          className="hidden"
        />
      </label>
    </div>
  );
}
