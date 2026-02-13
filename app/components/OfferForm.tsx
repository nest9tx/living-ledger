"use client";

import { useState, useEffect } from "react";
import { createOffer, fetchCategories } from "@/lib/supabase-helpers";

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
  const [categories, setCategories] = useState<Category[]>([]);
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

    if (!priceCredits || priceCredits < 1) {
      errors.priceCredits = "Price must be at least 1 credit";
    } else if (priceCredits > 10000) {
      errors.priceCredits = "Price cannot exceed 10,000 credits";
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
      await createOffer(title, description, categoryId!, priceCredits);
      setTitle("");
      setDescription("");
      setPriceCredits(5);
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

      <div className="grid grid-cols-2 gap-4">
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
          <label className="text-sm font-medium" htmlFor="price">
            Price (Credits) *
          </label>
          <input
            id="price"
            type="number"
            min="1"
            max="10000"
            className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm transition ${
              fieldErrors.priceCredits
                ? "border-red-500/50 bg-red-500/5"
                : "border-foreground/15"
            }`}
            value={priceCredits}
            onChange={(e) => {
              const value = Math.max(1, parseInt(e.target.value) || 1);
              setPriceCredits(value);
              if (fieldErrors.priceCredits) setFieldErrors({ ...fieldErrors, priceCredits: undefined });
            }}
          />
          {fieldErrors.priceCredits && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.priceCredits}</p>
          )}
          <p className="mt-1 text-xs text-foreground/50">
            Providers receive 85% when work is completed (15% platform fee).
          </p>
        </div>
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
