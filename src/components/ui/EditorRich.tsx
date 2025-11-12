"use client";

import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// TinyMCE core, theme and plugins — only load in the browser
if (typeof window !== 'undefined') {
  require('tinymce/tinymce');
  require('tinymce/icons/default');
  require('tinymce/themes/silver');
  require('tinymce/models/dom');
  require('tinymce/plugins/link');
  require('tinymce/plugins/lists');
  require('tinymce/plugins/code');
  require('tinymce/plugins/directionality');
  require('tinymce/plugins/image');
}

const TinyMCEEditor = dynamic(async () => (await import('@tinymce/tinymce-react')).Editor as any, { ssr: false }) as unknown as React.ComponentType<any>;

interface EditorRichProps {
  value: string;
  onChange: (html: string) => void;
  locale?: string;
  onDelete?: () => void | Promise<void>;
  deleteLabel?: string;
  deleteConfirmMessage?: string;
  emojis?: string[];
}

export default function EditorRich({
  value,
  onChange,
  locale = 'en',
  onDelete,
  deleteLabel,
  deleteConfirmMessage,
  emojis = [],
}: EditorRichProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const plugins = ['lists', 'link', 'code', 'directionality', 'image'];
  const pluginsConfig = plugins.join(' ');

  // Build toolbar with optional emoji buttons
  let toolbar = 'undo redo | blocks | bold italic underline | bullist numlist | link | image | ltr rtl';
  if (emojis.length > 0) {
    const emojiButtons = emojis.map((_, i) => `emojiBtn${i}`).join(' ');
    toolbar += ` | ${emojiButtons}`;
  }
  toolbar += ' | code';

  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmMsg = deleteConfirmMessage || (t('confirmDelete') as string);
    if (!confirm(confirmMsg)) return;

    try {
      setDeleting(true);
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <TinyMCEEditor
        value={value}
        onEditorChange={(content: string) => onChange(content)}
        init={{
          menubar: false,
          height: 400,
          plugins: pluginsConfig,
          toolbar,
          toolbar_mode: 'wrap',
          block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Quote=blockquote',
          directionality: locale === 'he' ? 'rtl' : 'ltr',
          skin: 'oxide',
          skin_url: '/tinymce/skins/ui/oxide',
          content_css: '/tinymce/skins/content/default/content.min.css',
          content_style: 'body { font-family: Arial,Helvetica,sans-serif; font-size:14px }',
          mobile: {
            menubar: false,
            plugins: pluginsConfig,
            toolbar,
            toolbar_mode: 'wrap',
          },
          license_key: 'gpl',
          // Image upload handler - converts to base64
          images_upload_handler: (blobInfo: any, progress: any) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve(reader.result as string);
            };
            reader.onerror = () => {
              reject('Failed to read image');
            };
            reader.readAsDataURL(blobInfo.blob());
          }),
          // Allow all image file types
          file_picker_types: 'image',
          // Configure image dialog
          image_title: true,
          image_description: false,
          image_dimensions: true,
          image_advtab: false,
          setup: (editor: any) => {
            // Register emoji buttons dynamically
            emojis.forEach((emoji, i) => {
              editor.ui.registry.addButton(`emojiBtn${i}`, {
                text: emoji,
                onAction: () => {
                  editor.insertContent(emoji);
                }
              });
            });
          },
        }}
      />
      {onDelete && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? (t('deleting') as string) : (deleteLabel || (t('delete') as string))}
          </button>
        </div>
      )}
    </div>
  );
}
