# 🌱 Living Ledger

A revolutionary platform where every act of positive contribution becomes a resource. Living Ledger creates a global co-creation ecosystem where people post requests for help and others offer micro-acts of assistance — each generating "Gratitude Credits" that circulate through the community.

## Vision

Living Ledger is not a chat app, marketplace, or social feed. It's a **contribution-first platform** where:
- Asking for help is normalized
- Giving help is celebrated
- Every micro-act matters
- Community replaces isolation
- People feel useful again

## Features

- **Requests**: Ask for help with skills, wisdom, emotional support, research, or co-building
- **Offers**: Share your gifts and grow a trusted reputation through real contributions
- **Gratitude Credits**: Earn credits through contributions; redeem for services, boost requests, or donate to causes
- **Community Guidelines**: Clear values and trust architecture to keep the ecosystem healthy
- **User Profiles**: Build reputation through contributions and ratings
- **Real-time Feed**: See all active requests and offers in your community
- **Global Navigation**: Easy navigation between all sections of the platform

## Technology Stack

- **Frontend**: Next.js 16.1.6 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Webhooks)
- **Payments**: Stripe (credit purchases, provider payouts)
- **Deployment**: Vercel

## Quick Start

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- npm or yarn
- A [Supabase account](https://supabase.com)
- A [Stripe account](https://stripe.com)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/nest9tx/LivingLedger.git
   cd LivingLedger
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   Then edit `.env.local` with your actual Supabase and Stripe credentials.

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
living-ledger/
├── app/
│   ├── (auth)/                   # Login, signup routes
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── components/
│   │   ├── NavHeader.tsx         # Global navigation
│   │   ├── Feed.tsx              # Requests/offers feed
│   │   ├── RequestForm.tsx        # Create request
│   │   ├── OfferForm.tsx          # Create offer
│   │   └── CreditsPanel.tsx       # Credit balance & history
│   ├── dashboard/page.tsx         # User dashboard
│   ├── guidelines/page.tsx        # Community guidelines
│   ├── onboarding/page.tsx        # 5-step wizard
│   ├── layout.tsx                 # Root layout with NavHeader
│   ├── page.tsx                   # Landing page
│   └── globals.css                # Global styles
├── lib/
│   ├── supabase.js                # Supabase client
│   └── supabase-helpers.ts        # Database functions
├── supabase/
│   └── schema.sql                 # Database schema & RLS
├── .env.local.example             # Environment template
├── package.json
└── tsconfig.json
```

## Configuration

### Environment Variables

See `.env.local.example` for all available options. Key variables:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Stripe (required for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Application (optional)
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=10
NEXT_PUBLIC_MIN_CASHOUT_CREDITS=20
NEXT_PUBLIC_LISTING_EXPIRY_DAYS=30
```

**Important**: Never commit `.env.local` to git. It's already in `.gitignore`.

## Database Schema

### Core Tables
- **profiles**: User accounts, username, bio, avatar, role
- **requests**: Help requests with category, budget, status
- **offers**: Service offers with category, price, capacity
- **interactions**: Contribution records (helper ↔ requester)
- **categories**: Predefined categories (Tech, Creative, Wellbeing, etc.)

### Economic Tables
- **transactions**: Credit flow (earnings, purchases, donations)
- **credit_escrow**: Holds credits during dispute resolution
- **stripe_connect_accounts**: Provider payout accounts

### Trust & Moderation
- **contribution_feedback**: 1-5 star ratings & reviews
- **user_flags**: Moderation flags for violations

All tables have **Row-Level Security (RLS)** — users can only access their own data.

Full schema is in [supabase/schema.sql](supabase/schema.sql).

## Key Features Status

### ✅ Completed
- User authentication (email/password)
- Landing page with hero copy
- Request/offer posting & feed
- Credit balance tracking
- 5-step onboarding wizard
- Community guidelines page
- Global navigation header
- Form validation

### 🟡 In Progress
- Stripe credit purchase
- Provider weekly payouts
- Credit escrow system
- 30-day listing expiry

### ⏳ Coming Soon
- Admin moderation dashboard
- User-to-user messaging
- Reputation badges & trust scoring
- Advanced search & filtering
- Community statistics

## Development Workflow

### Running the dev server
```bash
npm run dev
```

### Building for production
```bash
npm run build
npm run start
```

### Linting and type checking
```bash
npm run lint
npm run type-check  # (if configured)
```

## Economic Model

### Credit System
- **1 Credit = $1 USD** in real-world value
- **Minimum service price**: 5 credits ($5)
- **Platform fee**: 10% per transaction
- **Weekly cashout threshold**: 20 credits minimum
- **Payment method**: Stripe Connect (direct bank transfer)

### Example Flow
1. Person A posts a request worth 50 credits
2. Person B (provider) accepts and completes the work
3. Person B earns 45 credits (50 - 10% platform fee)
4. Once Person B reaches 20+ credits, they can cash out
5. Credits can also be donated to New Earth causes

### Fraud Prevention
- **7-day holding period**: Prevents chargebacks after payout
- **Transaction linking**: Every payout tied to specific service
- **Velocity limits**: Rate limiting per user/day
- **Chargeback reserve**: 5-10% held in reserve
- **Reputation tracking**: Low-reliability profiles flagged

See [Guidance.md](Guidance.md#fraud-prevention) for full details.

## Deployment

### Deploy to Vercel

1. Push code to GitHub
   ```bash
   git push origin main
   ```

2. Go to [Vercel](https://vercel.com) → Import Repository
3. Select this repo → Import
4. Add environment variables in project settings
5. Vercel auto-deploys on every push to `main`

### Set Custom Domain

In Vercel project settings → Domains, add your domain (e.g., `livingledger.org`).

## Troubleshooting

### Supabase Connection Issues
```
NetworkError when attempting to fetch resource
```
- Verify `.env.local` has correct URL and keys
- Check [Supabase Status](https://status.supabase.com)
- Ensure Supabase project is active (not paused)

### Port Already in Use
```bash
# Use a different port
npm run dev -- -p 3001
```

### Clear Cache
```bash
# Clear Next.js cache
rm -rf .next

# Then restart
npm run dev
```

## Documentation

- **[Guidance.md](Guidance.md)**: Complete implementation guide
- **[Layout.md](Layout.md)**: Product vision & narrative
- **[ROADMAP.md](ROADMAP.md)**: Feature checklist & progress
- **[supabase/schema.sql](supabase/schema.sql)**: Database schema

## Contributing

We welcome contributions aligned with our values:
- **Contribution over consumption**
- **Trust and transparency**
- **Community-first design**
- **Accessibility for all**

To contribute:
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Commit: `git commit -m 'Add your feature'`
5. Push: `git push origin feature/your-feature`
6. Open a Pull Request

## Security

- **Row-Level Security**: Supabase RLS on all tables
- **Environment variables**: Secrets in `.env.local` (git-ignored)
- **HTTPS**: Enforced on all Vercel deployments
- **Chargeback protection**: 7-day hold period
- **Rate limiting**: API endpoints throttled

## License

MIT License — see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/nest9tx/LivingLedger/issues)
- **Documentation**: [Guidance.md](Guidance.md)
- **Status**: [Supabase Status](https://status.supabase.com)

## Acknowledgments

Living Ledger is built on the belief that **contribution is currency** and **community care** is the foundation of sustainable systems. We honor all who co-create this vision.

---

**Let's build the New Earth, one micro-act at a time.** 🌱✨
