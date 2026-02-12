"use client";

// Generic skeleton loader that can be used for any content
export function SkeletonLoader({ width = "w-full", height = "h-4" }: { width?: string; height?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-foreground/10 ${width} ${height}`} />
  );
}

// Skeleton for a card/post item (useful for feed loading)
export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border border-foreground/10 bg-foreground/2 p-4">
      <div className="flex items-center justify-between">
        <SkeletonLoader width="w-1/3" height="h-4" />
        <SkeletonLoader width="w-1/6" height="h-3" />
      </div>
      <SkeletonLoader width="w-full" height="h-6" />
      <div className="space-y-2">
        <SkeletonLoader width="w-full" height="h-3" />
        <SkeletonLoader width="w-4/5" height="h-3" />
      </div>
      <div className="flex gap-2 pt-2">
        <SkeletonLoader width="w-1/4" height="h-8" />
        <SkeletonLoader width="w-1/4" height="h-8" />
      </div>
    </div>
  );
}

// Skeleton for form input field
export function SkeletonInput() {
  return (
    <div className="space-y-2">
      <SkeletonLoader width="w-1/4" height="h-3" />
      <SkeletonLoader width="w-full" height="h-10" />
    </div>
  );
}

// Skeleton for table row
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-4 py-2">
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonLoader key={i} width="flex-1" height="h-4" />
      ))}
    </div>
  );
}

// Skeleton for a full feed (multiple cards)
export function SkeletonFeed({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// Skeleton for credits panel
export function SkeletonCreditsPanel() {
  return (
    <div className="space-y-4 rounded-lg border border-foreground/10 bg-foreground/2 p-4">
      <div className="space-y-2">
        <SkeletonLoader width="w-1/3" height="h-3" />
        <SkeletonLoader width="w-1/2" height="h-8" />
      </div>
      <div className="space-y-2 pt-4">
        <SkeletonLoader width="w-1/4" height="h-3" />
        <SkeletonLoader width="w-full" height="h-40" />
      </div>
    </div>
  );
}
