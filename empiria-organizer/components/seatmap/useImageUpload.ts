"use client";

import { useState } from "react";

interface UseImageUploadReturn {
  uploading: boolean;
  error: string | null;
  uploadImage: (file: File) => Promise<{ url: string; width: number; height: number } | null>;
}

export function useImageUpload(): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);

    try {
      const dimensions = await getImageDimensions(file);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload-venue-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const { url } = await res.json();
      return { url, width: dimensions.width, height: dimensions.height };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { uploading, error, uploadImage };
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
