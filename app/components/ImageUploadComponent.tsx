"use client";

import { useState, useRef, useCallback } from "react";
import { ImageUploadService, UploadType, ImageUploadOptions, UploadedImage } from "@/lib/image-upload";

interface ImageUploadComponentProps {
  type: UploadType;
  options: Omit<ImageUploadOptions, "type">;
  onUploadComplete?: (images: UploadedImage[]) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  multiple?: boolean;
  accept?: string;
}

interface UploadProgress {
  filename: string;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

export default function ImageUploadComponent({
  type,
  options,
  onUploadComplete,
  onUploadError,
  disabled = false,
  className = "",
  children,
  multiple = true,
  accept,
}: ImageUploadComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine default accept attribute based on upload type
  const defaultAccept = accept || (() => {
    switch (type) {
      case "listing":
        return "image/*";
      case "message":
        return "image/*,.pdf,.doc,.docx,.txt";
      case "delivery":
        return "image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx";
      default:
        return "image/*";
    }
  })();

  const getUploadTypeDisplay = () => {
    switch (type) {
      case "listing":
        return "listing images";
      case "message":
        return "message attachments";
      case "delivery":
        return "delivery files";
      default:
        return "files";
    }
  };

  const handleFiles = useCallback(async (files: FileList) => {
    if (disabled || uploading) return;

    setUploading(true);
    setUploadProgress([]);

    const fileArray = Array.from(files);
    const maxFiles = options.maxFiles || 5;

    if (fileArray.length > maxFiles) {
      onUploadError?.(`Maximum ${maxFiles} files allowed`);
      setUploading(false);
      return;
    }

    // Initialize progress tracking
    const initialProgress = fileArray.map(file => ({
      filename: file.name,
      progress: 0,
      status: "uploading" as const,
    }));
    setUploadProgress(initialProgress);

    try {
      const uploadOptions = { type, ...options };
      const results = await ImageUploadService.uploadMultipleFiles(files, uploadOptions);

      // Update progress with results
      const finalProgress = results.results.map(result => ({
        filename: result.filename,
        progress: 100,
        status: result.success ? ("success" as const) : ("error" as const),
        error: result.error,
      }));
      setUploadProgress(finalProgress);

      const successfulUploads = results.results
        .filter(result => result.success && result.data)
        .map(result => result.data!);

      if (successfulUploads.length > 0) {
        onUploadComplete?.(successfulUploads);
      }

      if (!results.success && results.error) {
        onUploadError?.(results.error);
      }

      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress([]);
      }, 3000);

    } catch (error) {
      console.error("Upload error:", error);
      onUploadError?.(error instanceof Error ? error.message : "Upload failed");
      setUploadProgress([]);
    } finally {
      setUploading(false);
    }
  }, [type, options, disabled, uploading, onUploadComplete, onUploadError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  }, [disabled, uploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [disabled, uploading, handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFiles]);

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  const renderDefaultChildren = () => (
    <div className="text-center">
      <svg
        className="mx-auto h-12 w-12 text-foreground/40"
        stroke="currentColor"
        fill="none"
        viewBox="0 0 48 48"
      >
        <path
          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-4">
        <p className="text-sm text-foreground/70">
          <span className="font-medium text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-foreground/50 mt-1">
          {type === "listing" && "Images only, up to 5MB each"}
          {type === "message" && "Images, documents, up to 10MB each"}
          {type === "delivery" && "All file types, up to 50MB each"}
        </p>
        {(options.maxFiles || 5) > 1 && (
          <p className="text-xs text-foreground/50">
            Maximum {options.maxFiles || 5} files
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={defaultAccept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />
      
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed p-6 transition-colors
          ${isDragging 
            ? "border-blue-500 bg-blue-50/50" 
            : "border-foreground/20 hover:border-foreground/30"
          }
          ${disabled || uploading 
            ? "opacity-50 cursor-not-allowed" 
            : "hover:bg-foreground/2"
          }
        `}
      >
        {children || renderDefaultChildren()}
        
        {uploading && (
          <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-foreground/70">
                Uploading {getUploadTypeDisplay()}...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadProgress.map((progress, index) => (
            <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-foreground/5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{progress.filename}</p>
                {progress.status === "error" && progress.error && (
                  <p className="text-xs text-red-600">{progress.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {progress.status === "uploading" && (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                )}
                {progress.status === "success" && (
                  <div className="w-4 h-4 text-green-600">✓</div>
                )}
                {progress.status === "error" && (
                  <div className="w-4 h-4 text-red-600">✗</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}