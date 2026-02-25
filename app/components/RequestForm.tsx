"use client";

import { useState, useEffect } from "react";
import { createRequest, fetchCategories } from "@/lib/supabase-helpers";
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
  budgetCredits?: string;
  images?: string;
  shippingCredits?: string;
};

export default function RequestForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [budgetCredits, setBudgetCredits] = useState(5);
  const [isPhysical, setIsPhysical] = useState(false);
  const [shippingCredits, setShippingCredits] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      errors.title = "Please describe what you need help with";
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

    if (!budgetCredits || budgetCredits < 5) {
      errors.budgetCredits = "Budget must be at least 5 credits ($5)";
    } else if (budgetCredits > 100) {
      errors.budgetCredits = "Budget cannot exceed 100 credits ($100 max per transaction)";
    }

    if (images.length > 5) {
      errors.images = "Maximum 5 images allowed";
    }

    if (isPhysical && shippingCredits !== null && shippingCredits < 1) {
      errors.shippingCredits = "Shipping cost must be at least 1 credit if set";
    } else if (isPhysical && shippingCredits !== null && shippingCredits > 100) {
      errors.shippingCredits = "Shipping cost cannot exceed 100 credits";
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
      const requestData = await createRequest(
        title,
        description,
        categoryId!,
        budgetCredits,
        undefined,
        undefined,
        isPhysical,
        shippingCredits
      );

      if (!requestData || !requestData[0]) {
        throw new Error("Failed to create request");
      }

      const requestId = requestData[0].id;

      // Associate uploaded images with the request
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
              listingId: requestId,
              listingType: "request",
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to associate images with request:", errorData);
            // Don't fail the whole operation if image association fails
          }
        }
      }

      setTitle("");
      setDescription("");
      setBudgetCredits(5);
      setIsPhysical(false);
      setShippingCredits(null);
      setImages([]);
      setFieldErrors({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSuccess?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create request. Please try again.";
      setError(errorMsg);
      console.error("Request creation error:", err);
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

  const handleImageUploadError = (err: string) => {
    setError(`Image upload error: ${err}`);
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-foreground/10 bg-foreground/2 p-4">
      <h3 className="font-semibold">Post a request for help</h3>
      <p className="text-xs text-foreground/60">
        Posting requests is free. Buyers pay the listed price; providers receive 85% after completion (15% platform fee).
      </p>

      <div>
        <label className="text-sm font-medium" htmlFor="title">
          What do you need help with? *
        </label>
        <input
          id="title"
          type="text"
          required
          placeholder="e.g., Help designing a logo for my project"
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
        <label className="text-sm font-medium" htmlFor="description">
          Tell us more (optional)
        </label>
        <textarea
          id="description"
          placeholder="Provide details that will help someone respond helpfully…"
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium" htmlFor="category">
            Category *
          </label>
          <select
            id="category"
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
          <label className="text-sm font-medium" htmlFor="budget">
            Budget (Credits) *
          </label>
          <input
            id="budget"
            type="number"
            max="100"
            className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition ${
              fieldErrors.budgetCredits
                ? "border-red-500/50 bg-red-500/5"
                : "border-foreground/15"
            }`}
            value={budgetCredits}
            onChange={(e) => {
              const rawValue = e.target.value;
              if (rawValue === "" || rawValue === "0") {
                setBudgetCredits(0);
              } else {
                const value = parseInt(rawValue);
                if (!isNaN(value)) setBudgetCredits(value);
              }
              if (fieldErrors.budgetCredits) setFieldErrors({ ...fieldErrors, budgetCredits: undefined });
            }}
            onBlur={(e) => {
              const value = parseInt(e.target.value) || 0;
              if (value > 0 && value < 5) setBudgetCredits(5);
              else if (value > 100) setBudgetCredits(100);
            }}
          />
          {!fieldErrors.budgetCredits && (
            <p className="mt-1 text-xs text-foreground/60">5–100 credits ($5–$100 max per transaction)</p>
          )}
          {fieldErrors.budgetCredits && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.budgetCredits}</p>
          )}
        </div>
      </div>

      {/* Physical item toggle */}
      <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => {
              setIsPhysical(!isPhysical);
              if (isPhysical) setShippingCredits(null);
              if (fieldErrors.shippingCredits) setFieldErrors({ ...fieldErrors, shippingCredits: undefined });
            }}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isPhysical ? "bg-amber-500" : "bg-foreground/20"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                isPhysical ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
          <span className="text-sm font-medium">📦 Physical item (needs to be shipped)</span>
        </label>
        {isPhysical && (
          <div className="space-y-2 pt-1 border-t border-foreground/10">
            <p className="text-xs text-amber-600/80 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
              ⚠️ You’ll need to share your shipping address with the seller via the platform message system. Living Ledger is not liable for shipping outcomes.
            </p>
            <div>
              <label className="text-sm font-medium" htmlFor="req-shipping-credits">
                Expected shipping cost (credits, optional)
              </label>
              <input
                id="req-shipping-credits"
                type="number"
                min="1"
                max="100"
                placeholder="e.g. 5 — leave blank if unknown"
                className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition ${
                  fieldErrors.shippingCredits
                    ? "border-red-500/50 bg-red-500/5"
                    : "border-foreground/15"
                }`}
                value={shippingCredits ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? parseInt(e.target.value) : null;
                  setShippingCredits(v);
                  if (fieldErrors.shippingCredits) setFieldErrors({ ...fieldErrors, shippingCredits: undefined });
                }}
              />
              {fieldErrors.shippingCredits && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.shippingCredits}</p>
              )}
            </div>
          </div>
        )}
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
              listingType: "request"
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
          ✓ Request posted! Others will see it now.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || Object.keys(fieldErrors).length > 0}
        className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition disabled:opacity-60"
      >
        {loading ? "Posting…" : "Post request"}
      </button>
    </form>
  );
}
