# Living Ledger - Product Requirements & Roadmap

## Current Issues
- [ ] Post creation error - awaiting details

## Product Features to Address

### 1. **Proof of Delivery/Service Completion**
**Question**: How do users prove work was completed before credits are released?

**Possible Solutions**:
- [ ] Escrow system (credits held until both parties confirm completion)
- [ ] Photo/file upload proof in the interaction record
- [ ] Completion checkbox with timestamp
- [ ] Review/rating system before credit release
- [ ] Milestone-based releases for larger projects

**Current Status**: Credit escrow table exists, but completion logic not built

---

### 2. **Transparency & Financial Education**
**Required Pages/Sections**:
- [ ] Earnings explanation page (how credits are earned)
- [ ] Fee structure page (platform takes X%, etc.)
- [ ] Cash-out process documentation
- [ ] FAQ about credit system
- [ ] User earnings dashboard (history, pending, available)

**Current Status**: Cash-out page exists but is broken/incomplete

**Action Items**:
- [ ] Document fee structure (what % platform keeps?)
- [ ] Create earnings breakdown page
- [ ] Build user earnings history view
- [ ] Add cash-out workflow

---

### 3. **Email Configuration**
**Current Issue**: References to `hello@livingledger.com` but should be `admin@livingledger.org`

**Affected Areas**:
- [ ] Onboarding emails
- [ ] Confirmation emails
- [ ] Transactional emails
- [ ] Support contact
- [ ] Admin notifications

**Action Items**:
- [ ] Update .env variable EMAIL_FROM_ADDRESS
- [ ] Update Supabase auth email templates
- [ ] Update contact pages
- [ ] Setup email forwarding at admin@livingledger.org

---

### 4. **Feed Organization & Pagination**
**Current State**: All posts in one endless feed

**Proposed Improvements**:
- [ ] Filter by category (already have categories table)
- [ ] Sort by: newest, most popular, closest to deadline
- [ ] Search functionality
- [ ] Pagination (show 10-20 at a time)
- [ ] User's own posts section (separate from browse)
- [ ] "Active" vs "Completed" filters

**Current Status**: Feed.tsx has basic filtering, needs pagination

**Action Items**:
- [ ] Add pagination component
- [ ] Add sort options dropdown
- [ ] Add search bar
- [ ] Improve category filtering

---

### 5. **Admin Dashboard & Moderation**
**Current State**: Admin page exists but incomplete

**Required Features**:
- [ ] User management (list, search, ban/suspend)
- [ ] Post moderation (flag, edit, delete)
- [ ] Dispute resolution center
- [ ] Transaction audit log
- [ ] Platform analytics (users, posts, credits flowing)
- [ ] Report viewer (user reports/flags)
- [ ] Ban/suspension management

**Current Status**: Admin skeleton exists, needs full build

**Action Items**:
- [ ] Build user management interface
- [ ] Build dispute/report queue
- [ ] Add moderation actions (delete, ban, etc.)
- [ ] Add audit logging for all actions

---

### 6. **Guest Access vs Sign-Up Wall**
**Decision**: Should non-authenticated users see the feed?

**Option A: Guest Browse (Open Discovery)**
- Home page shows public feed (read-only)
- Users see what's available before committing
- Only need to sign up to post or interact
- Better for growth/discovery

**Option B: Sign-Up Wall (Trusted Community)**
- Must authenticate to see any posts
- Smaller but more committed community
- Better for trust/safety

**Current Code**: Feed is behind `/dashboard` which requires login

**Recommendation**: Implement Option A for growth
- [ ] Create public `/feed` or `/browse` route (no auth required)
- [ ] Show only non-sensitive info (title, description, category)
- [ ] "Sign up to make an offer" CTA buttons
- [ ] Link from home page to browse feed

---

## Implementation Priority

**Phase 1 (This Week)**:
1. Fix post creation error
2. Email configuration (admin@livingledger.org)
3. Public feed/browse route for guests
4. Basic pagination

**Phase 2 (Next Week)**:
1. Admin dashboard improvements
2. Dispute resolution interface
3. User moderation tools
4. Complete cash-out workflow

**Phase 3 (Future)**:
1. Proof of service/completion system
2. Detailed earnings dashboard
3. Advanced search/filtering
4. Reviews/ratings

---

## Questions for You

1. **Fees**: What percentage should the platform take? (e.g., 5%, 10%, 20%)
2. **Guest Access**: Which approach? (Open browse or sign-up wall?)
3. **Completion Proof**: What method? (Checkbox, photos, escrow-based?)
4. **Admin Access**: Who has admin rights? (Just you for now?)
5. **Email**: Who should disputes/reports go to? (admin@livingledger.org?)

---

## Files Needing Updates

- [ ] `app/page.tsx` - Add "Browse as guest" CTA
- [ ] New route: `app/(public)/feed/page.tsx` - Public browsing
- [ ] `.env.local` - Add EMAIL_FROM_ADDRESS
- [ ] `app/admin/page.tsx` - Complete admin features
- [ ] `app/dashboard/earnings/page.tsx` - New earnings page
- [ ] `app/help/cash-out/page.tsx` - Complete cash-out guide
- [ ] `app/help/how-it-works/page.tsx` - Economic transparency
