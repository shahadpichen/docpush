'use client';

import * as React from 'react';
import { useDocPush } from '../context/docpush-provider';

interface UploadResult {
  success: boolean;
  markdown?: string;
  url?: string;
  error?: string;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function useMedia() {
  const { apiUrl } = useDocPush();
  const [uploading, setUploading] = React.useState(false);

  const uploadImage = React.useCallback(
    async (file: File): Promise<UploadResult> => {
      setUploading(true);

      try {
        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          return {
            success: false,
            error: `Invalid file type. Allowed types: PNG, JPEG, GIF, WebP, SVG`,
          };
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          return {
            success: false,
            error: `File too large. Maximum size is 5MB`,
          };
        }

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Send as raw binary with correct headers
        const response = await fetch(`${apiUrl}/api/media`, {
          method: 'POST',
          headers: {
            'Content-Type': file.type,
            'x-filename': file.name,
          },
          body: arrayBuffer,
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
          return {
            success: false,
            error: errorData.error || `Upload failed with status ${response.status}`,
          };
        }

        const data = await response.json();
        return {
          success: true,
          markdown: data.markdown,
          url: data.url,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        };
      } finally {
        setUploading(false);
      }
    },
    [apiUrl]
  );

  return { uploadImage, uploading };
}
