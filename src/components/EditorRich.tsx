"use client";

import dynamic from 'next/dynamic';
import React from 'react';
// TinyMCE skins (self-hosted) — import CSS and disable Tiny's external skin loading
import 'tinymce/skins/ui/oxide/skin.min.css';
import 'tinymce/skins/content/default/content.min.css';

// TinyMCE self-hosted assets (only load on client)
if (typeof window !== 'undefined') {
  // Core + UI
  require('tinymce/tinymce');
  require('tinymce/icons/default');
  require('tinymce/themes/silver');
  require('tinymce/models/dom');
  // Plugins used
  require('tinymce/plugins/link');
  require('tinymce/plugins/lists');
  require('tinymce/plugins/code');
  require('tinymce/plugins/directionality');
}

const TinyMCEEditor = dynamic(async () => (await import('@tinymce/tinymce-react')).Editor as any, { ssr: false }) as unknown as React.ComponentType<any>;

interface EditorRichProps {
  value: string;
  onChange: (html: string) => void;
}

export default function EditorRich({ value, onChange }: EditorRichProps) {
  return (
    <TinyMCEEditor
      value={value}
      onEditorChange={(content: string) => onChange(content)}
      init={{
        menubar: false,
        height: 400,
        plugins: 'lists link code directionality',
        toolbar:
          'undo redo | formatselect | bold italic underline | bullist numlist | link | ltr rtl | code',
        directionality: 'auto',
        // Disable Tiny's own external skin/content CSS loading (we import CSS via bundler)
        skin: false,
        content_css: false,
        content_style: 'body { font-family: Arial,Helvetica,sans-serif; font-size:14px }',
        license_key: 'gpl'
      }}
    />
  );
}
