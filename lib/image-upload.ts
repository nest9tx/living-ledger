// Utility functions for image upload handling with Supabase Storage
import supabase from "@/lib/supabase";

export type UploadType = "listing" | "message" | "delivery";

export interface ImageUploadOptions {
  type: UploadType;
  maxFiles?: number;
  maxSizeBytes?: number;
  allowedTypes?: string[];
  listingId?: number;
  listingType?: "offer" | "request";
  messageId?: number;
  escrowId?: number;
}

export interface UploadedImage {
  id: string;
  filename: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  url?: string;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class ImageUploadService {
  private static getBucketName(type: UploadType): string {
    switch (type) {
      case "listing":
        return "listing-images";
      case "message":
        return "message-attachments";
      case "delivery":
        return "delivery-files";
      default:
        throw new Error(`Unknown upload type: ${type}`);
    }
  }

  private static getMaxSize(type: UploadType): number {
    switch (type) {
      case "listing":
        return 5 * 1024 * 1024; // 5MB for listings
      case "message":
        return 10 * 1024 * 1024; // 10MB for messages
      case "delivery":
        return 50 * 1024 * 1024; // 50MB for deliveries
      default:
        return DEFAULT_MAX_SIZE;
    }
  }

  private static getAllowedTypes(type: UploadType): string[] {
    switch (type) {
      case "listing":
        return ["image/jpeg", "image/png", "image/webp", "image/gif"];
      case "message":
        return [
          "image/jpeg",
          "image/png", 
          "image/webp",
          "image/gif",
          "application/pdf",
          "text/plain",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];
      case "delivery":
        return [
          "image/jpeg",
          "image/png",
          "image/webp", 
          "image/gif",
          "application/pdf",
          "text/plain",
          "application/zip",
          "application/x-zip-compressed",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ];
      default:
        return DEFAULT_ALLOWED_TYPES;
    }
  }

  static validateFile(file: File, type: UploadType): { valid: boolean; error?: string } {
    const maxSize = this.getMaxSize(type);
    const allowedTypes = this.getAllowedTypes(type);

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} not allowed for ${type} uploads`
      };
    }

    return { valid: true };
  }

  static async uploadFile(
    file: File,
    options: ImageUploadOptions
  ): Promise<{ success: boolean; data?: UploadedImage; error?: string }> {
    try {
      // Validate file
      const validation = this.validateFile(file, options.type);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return { success: false, error: "Not authenticated" };
      }

      const userId = userData.user.id;
      const bucketName = this.getBucketName(options.type);
      
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedOriginalName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .substring(0, 100); // Limit length
      const filename = `${timestamp}-${sanitizedOriginalName}`;
      
      // Create storage path: userId/filename
      const storagePath = `${userId}/${filename}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return { success: false, error: uploadError.message };
      }

      if (!uploadData) {
        return { success: false, error: "Upload failed - no data returned" };
      }

      // Create metadata record via API
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        // Clean up uploaded file if no session
        await supabase.storage.from(bucketName).remove([storagePath]);
        return { success: false, error: "No valid session for API call" };
      }

      const response = await fetch("/api/uploads/create-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: options.type,
          storage_path: storagePath,
          filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          listing_id: options.listingId,
          listing_type: options.listingType,
          message_id: options.messageId,
          escrow_id: options.escrowId,
        }),
      });

      if (!response.ok) {
        // Clean up uploaded file if metadata creation fails
        await supabase.storage.from(bucketName).remove([storagePath]);
        const errorData = await response.json();
        return { success: false, error: errorData.error || "Failed to create upload record" };
      }

      const { data: recordData } = await response.json();

      // Get public URL for public buckets (listing images)
      let publicUrl: string | undefined;
      if (options.type === "listing") {
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);
        publicUrl = urlData.publicUrl;
      }

      return {
        success: true,
        data: {
          id: recordData.id,
          filename: file.name,
          storage_path: storagePath,
          file_size: file.size,
          mime_type: file.type,
          url: publicUrl,
        }
      };

    } catch (error) {
      console.error("Upload service error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed"
      };
    }
  }

  static async uploadMultipleFiles(
    files: FileList | File[],
    options: ImageUploadOptions
  ): Promise<{ 
    success: boolean; 
    results: Array<{ success: boolean; data?: UploadedImage; error?: string; filename: string }>;
    error?: string; 
  }> {
    const maxFiles = options.maxFiles || 5;
    const fileArray = Array.from(files);

    if (fileArray.length > maxFiles) {
      return {
        success: false,
        results: [],
        error: `Too many files. Maximum ${maxFiles} files allowed.`
      };
    }

    const results = await Promise.all(
      fileArray.map(async (file) => {
        const result = await this.uploadFile(file, options);
        return {
          ...result,
          filename: file.name
        };
      })
    );

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      results,
      error: successCount === 0 ? "All uploads failed" : undefined
    };
  }

  static async deleteFile(
    storagePath: string, 
    type: UploadType,
    recordId?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const bucketName = this.getBucketName(type);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);

      if (storageError) {
        console.error("Storage deletion error:", storageError);
        return { success: false, error: storageError.message };
      }

      // Delete metadata record if ID provided
      if (recordId) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        const response = await fetch("/api/uploads/delete-record", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token && { "Authorization": `Bearer ${token}` }),
          },
          body: JSON.stringify({
            type,
            record_id: recordId
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Failed to delete upload record:", errorData.error);
          // Don't fail the deletion if metadata removal fails
        }
      }

      return { success: true };

    } catch (error) {
      console.error("Delete service error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Deletion failed"
      };
    }
  }

  static async getFileUrl(
    storagePath: string,
    type: UploadType,
    expiresIn: number = 3600
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const bucketName = this.getBucketName(type);

      if (type === "listing") {
        // Public bucket - get public URL
        const { data } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);
        return { success: true, url: data.publicUrl };
      } else {
        // Private bucket - get signed URL
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(storagePath, expiresIn);

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true, url: data.signedUrl };
      }

    } catch (error) {
      console.error("Get URL service error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get file URL"
      };
    }
  }
}