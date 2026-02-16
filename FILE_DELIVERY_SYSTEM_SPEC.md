# File Delivery System - Design Specification

## Overview
Users need a way to deliver completed work (files, documents, images, etc.) within the platform after completing a service, without exchanging emails or external contact info.

## Requirements
1. **Secure delivery**: Files should only be accessible to buyer and seller
2. **Integrated workflow**: Tie deliveries to escrow releases
3. **File constraints**: Size limits, allowed file types
4. **Storage cost**: Minimize storage costs while maintaining reliability

## Recommended Architecture

### Option 1: Supabase Storage (Recommended ⭐)
**Pros:**
- Already integrated with Supabase
- Row-Level Security (RLS) for file access control
- Built-in CDN for fast downloads
- Free tier: 1GB storage, 2GB bandwidth
- Pay-as-you-go: $0.021/GB storage, $0.09/GB bandwidth

**Implementation:**
```sql
-- Add delivery fields to credit_escrow table
ALTER TABLE credit_escrow
ADD COLUMN delivery_files JSONB DEFAULT '[]';  -- Array of file metadata
ADD COLUMN delivered_at TIMESTAMPTZ;
ADD COLUMN delivery_message TEXT;
```

**File metadata structure:**
```json
{
  "files": [
    {
      "id": "uuid-v4",
      "filename": "design-mockup.png",
      "filesize": 2485760,
      "mimeType": "image/png",
      "uploadedAt": "2026-02-16T10:30:00Z",
      "storagePath": "deliveries/escrow-123/uuid-v4-design-mockup.png"
    }
  ]
}
```

**RLS Policies:**
```sql
-- Only payer and provider can access delivery files
CREATE POLICY "Users can access their delivery files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deliveries' AND
  auth.uid() IN (
    SELECT payer_id FROM credit_escrow WHERE id = (storage.foldername(name)::int)
    UNION
    SELECT provider_id FROM credit_escrow WHERE id = (storage.foldername(name)::int)
  )
);
```

**File Constraints:**
- Max file size: 10MB per file
- Max files per delivery: 5 files
- Allowed types: images (png, jpg, gif, svg), documents (pdf, docx, txt), archives (zip)
- Storage retention: Files kept for 90 days after delivery

**Cost Estimate:**
- 100 deliveries/month × 5 files × 2MB = ~1GB storage/month
- Free tier covers most early usage
- At scale: ~$0.02/month per GB

### Option 2: AWS S3 with Presigned URLs
**Pros:**
- Industry standard
- Highly scalable
- S3 Glacier for long-term cheap storage

**Cons:**
- Requires AWS account setup
- More complex integration
- Additional service to manage

**Cost:** ~$0.023/GB storage, $0.09/GB transfer

### Option 3: File Links Only (No Storage)
**Pros:**
- Zero storage cost
- Simple implementation

**Cons:**
- Users must host files externally (Google Drive, Dropbox, etc.)
- No guarantee links remain active
- Less professional user experience

## Recommended Implementation Plan

### Phase 1: Database Schema (15 mins)
```sql
-- supabase/migrations/add_file_delivery.sql
ALTER TABLE credit_escrow
ADD COLUMN IF NOT EXISTS delivery_files JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_message TEXT;

CREATE INDEX IF NOT EXISTS idx_escrow_delivered ON credit_escrow(delivered_at);
```

### Phase 2: Supabase Storage Setup (30 mins)
1. Create 'deliveries' bucket in Supabase Storage
2. Set up RLS policies for access control
3. Configure CORS for file uploads from browser

### Phase 3: Upload API Route (1 hour)
```typescript
// app/api/escrow/upload-delivery/route.ts
// - Validate user is provider of escrow
// - Check escrow status is 'held' (not released yet)
// - Validate file size and type
// - Upload to Supabase Storage
// - Update escrow.delivery_files metadata
// - Return success/error
```

### Phase 4: Delivery UI Component (1-2 hours)
```typescript
// app/components/FileDelivery.tsx
// - File upload form (drag & drop or click)
// - File preview (thumbnails for images)
// - Delivery message textarea
// - "Submit Delivery" button
// - Display uploaded files (buyer/seller view)
// - Download buttons for each file
```

### Phase 5: Integration (30 mins)
- Add delivery UI to ContributionHistory component
- Show "Upload Delivery" for provider (before release)
- Show "View Delivery" for buyer (after upload)
- Link delivery submission to escrow release flow

## Security Considerations
✅ File type validation (server-side)
✅ File size limits (prevent abuse)
✅ RLS policies (only escrow participants access files)
✅ Virus scanning (optional: ClamAV integration)
✅ Rate limiting (prevent spam uploads)

## User Flow

**Provider uploads delivery:**
1. Go to "Current Orders" tab
2. Find completed work
3. Click "Upload Delivery"
4. Upload files (max 5 × 10MB)
5. Add delivery message
6. Submit delivery

**System notifies buyer:**
7. Buyer receives in-app notification (unread badge)
8. Buyer views delivery in "Current Orders"
9. Downloads files
10. Reviews work
11. Clicks "Release Payment" (moves to rating flow)

## Next Steps
1. ✅ Read this spec
2. Get user approval on approach (Supabase Storage vs alternatives)
3. Implement Phase 1-5 above
4. Test end-to-end delivery workflow
5. Monitor storage usage and costs

---

## Questions for User
1. **File size limit**: Is 10MB per file reasonable? (Can adjust to 5MB or 20MB)
2. **File retention**: Keep files for 90 days or longer? (Storage costs scale with retention)
3. **Allowed file types**: Any specific types to add/remove from the list?
4. **Delivery triggers payment release**: Should delivery auto-trigger release review, or keep it manual?

