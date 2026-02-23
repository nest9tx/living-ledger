"use client";

import { useState, useEffect } from "react";
import { createOffer, fetchCategories } from "@/lib/supabase-helpers";
import ImageUploadComponent from "./ImageUploadComponent";
import { UploadedImage } from "@/lib/image-upload";
import supabase from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  icon: string;
};

type FormErrors = {
  title?: string;
  description?: string;
  categoryId?: string;
  priceCredits?: string;
  quantity?: string;
  images?: string;
};

export default function OfferForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priceCredits, setPriceCredits] = useState(5);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempOfferId, setTempOfferId] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data || []);
        if (data && data.length > 0) {
          setCategoryId(data[0].id);
        }
      } catch (err) {
        console.error("Error loading categories:", err);
        setError("Failed to load categories. Please refresh the page.");
      }
    };

    loadCategories();
  }, []);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!title.trim()) {
      errors.title = "Please describe what you can help with";
    } else if (title.length < 5) {
      errors.title = "Title must be at least 5 characters";
    } else if (title.length > 100) {
      errors.title = "Title must be less than 100 characters";
    }

    if (description && description.length > 1000) {
      errors.description = "Description must be less than 1000 characters";
    }

    if (!categoryId) {
      errors.categoryId = "Please select a category";
    }

    if (!priceCredits || priceCredits < 5) {
      errors.priceCredits = "Price must be at least 5 credits ($5)";
    } else if (priceCredits > 100) {
      errors.priceCredits = "Price cannot exceed 100 credits ($100 max per transaction)";
    }

    if (quantity !== null && quantity < 1) {
      errors.quantity = "Quantity must be at least 1";
    } else if (quantity !== null && quantity > 1000) {
      errors.quantity = "Quantity cannot exceed 1,000";
    }

    if (images.length > 5) {
      errors.images = "Maximum 5 images allowed";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Create the offer first (without images)
      const offerData = await createOffer(
        title, 
        description, 
        categoryId!, 
        priceCredits,
        quantity,
        [] // No images initially
      );
      
      if (!offerData || !offerData[0]) {
        throw new Error("Failed to create offer");
      }

      const offerId = offerData[0].id;

      // If we have uploaded images, associate them with the offer
      if (images.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (token) {
          const response = await fetch("/api/uploads/associate-listing", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              imageIds: images.map(img => img.id),
              listingId: offerId,
              listingType: "offer"
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to associate images with offer:", errorData);
            // Don't fail the whole operation if image association fails
          }
        }
      }
      
      setTempOfferId(offerId);
      
      setTitle("");
      setDescription("");
      setPriceCredits(5);
      setQuantity(null);
      setImages([]);
      setFieldErrors({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSuccess?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create offer. Please try again.";
      setError(errorMsg);
      console.error("Offer creation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (uploadedImages: UploadedImage[]) => {
    setImages(prev => [...prev, ...uploadedImages]);
    if (fieldErrors.images) {
      setFieldErrors({ ...fieldErrors, images: undefined });
    }
  };

  const handleImageUploadError = (error: string) => {
    setError(`Image upload error: ${error}`);
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-foreground/10 bg-foreground/2 p-4">
      <h3 className="font-semibold">Offer your gifts</h3>

      <div>
        <label className="text-sm font-medium" htmlFor="offer-title">
          What can you help with? *
        </label>
        <input
          id="offer-title"
          type="text"
          required
          placeholder="e.g., I can design logos and visual identity"
          className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition ${
            fieldErrors.title
              ? "border-red-500/50 bg-red-500/5"
              : "border-foreground/15"
          }`}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (fieldErrors.title) setFieldErrors({ ...fieldErrors, title: undefined });
          }}
          maxLength={100}
        />
        {fieldErrors.title && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
        )}
        <p className="mt-1 text-xs text-foreground/50">
          {title.length}/100 characters
        </p>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="offer-description">
          Describe your offering (optional)
        </label>
        <textarea
          id="offer-description"
          placeholder="What experience do you bring? How can someone work with you?…"
          className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition ${
            fieldErrors.description
              ? "border-red-500/50 bg-red-500/5"
              : "border-foreground/15"
          }`}
          rows={3}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (fieldErrors.description) setFieldErrors({ ...fieldErrors, description: undefined });
          }}
          maxLength={1000}
        />
        {fieldErrors.description && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
        )}
        <p className="mt-1 text-xs text-foreground/50">
          {description.length}/1000 characters
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium" htmlFor="offer-category">
            Category *
          </label>
          <select
            id="offer-category"
            className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition ${
              fieldErrors.categoryId
                ? "border-red-500/50 bg-red-500/5"
                : "border-foreground/15"
            }`}
            value={categoryId || ""}
            onChange={(e) => {
              setCategoryId(parseInt(e.target.value));
              if (fieldErrors.categoryId) setFieldErrors({ ...fieldErrors, categoryId: undefined });
            }}
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.categoryId}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="quantity">
            Quantity (optional)
          </label>
          <input
            id="quantity"
            type="number"
            min="1"
            max="1000"
            placeholder="Leave blank if unlimited"
            className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition ${
              fieldErrors.quantity
                ? "border-red-500/50 bg-red-500/5"
                : "border-foreground/15"
            }`}
            value={quantity || ""}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value) : null;
              setQuantity(value);
              if (fieldErrors.quantity) setFieldErrors({ ...fieldErrors, quantity: undefined });
            }}
          />
          {!fieldErrors.quantity && (
            <p className="mt-1 text-xs text-foreground/60">How many available? (optional)</p>
          )}
          {fieldErrors.quantity && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.quantity}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="price">
            Price (Credits) *
          </label>
          <input
            id="price"
            type="number"
            max="100"
            className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition ${
              fieldErrors.priceCredits
                ? "border-red-500/50 bg-red-500/5"
                : "border-foreground/15"
            }`}
            value={priceCredits}
            onChange={(e) => {
              // Just store the raw input value without parsing, let user type freely
              const rawValue = e.target.value;
              if (rawValue === "" || rawValue === "0") {
                setPriceCredits(0);
              } else {
                const value = parseInt(rawValue);
                if (!isNaN(value)) {
                  setPriceCredits(value);
                }
              }
              if (fieldErrors.priceCredits) setFieldErrors({ ...fieldErrors, priceCredits: undefined });
            }}
            onBlur={(e) => {
              // Apply minimum validation on blur to ensure final value is valid
              const value = parseInt(e.target.value) || 0;
              if (value > 0 && value < 5) {
                setPriceCredits(5);
              }
            }}
          />
          {!fieldErrors.priceCredits && (
            <p className="mt-1 text-xs text-foreground/60">5–100 credits ($5–$100 max per transaction)</p>
          )}
          {fieldErrors.priceCredits && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.priceCredits}</p>
          )}
          <p className="mt-1 text-xs text-foreground/50">
            Providers receive 85% when work is completed (15% platform fee).
          </p>
        </div>
      </div>

      {/* Image Upload Section */}
      <div>
        <label className="text-sm font-medium">
          Images (optional)
        </label>
        <div className="mt-1">
          <ImageUploadComponent
            type="listing"
            options={{
              maxFiles: 5,
              listingType: "offer"
              // No listingId needed for temporary uploads
            }}
            onUploadComplete={handleImageUpload}
            onUploadError={handleImageUploadError}
            disabled={loading}
            multiple={true}
          />
          {fieldErrors.images && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.images}</p>
          )}
        </div>

        {/* Display uploaded images */}
        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square rounded-lg border border-foreground/10 bg-foreground/5 p-2">
                  {image.url ? (
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-foreground/40" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 text-xs text-foreground/60 truncate">{image.filename}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          ⚠️ {error}
        </p>
      )}

      {success && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          ✓ Your offer is live! Wait for requests that match your gifts.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || Object.keys(fieldErrors).length > 0}
        className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition disabled:opacity-60"
      >
        {loading ? "Posting…" : "Post offer"}
      </button>
    </form>
  );
}
