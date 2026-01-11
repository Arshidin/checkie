# Checkie Deployment Guide

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GitHub    │────▶│   Railway   │     │   Netlify   │
│  (Source)   │     │  (Backend)  │     │ (Frontend)  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
        ┌─────▼─────┐          ┌─────▼─────┐
        │ PostgreSQL │          │   Redis   │
        │  (Railway) │          │ (Railway) │
        └───────────┘          └───────────┘
```

---

## Step 1: Backend on Railway

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select `Arshidin/checkie` repository
4. Choose `checkie-backend` as the root directory

### 1.2 Add PostgreSQL

1. In your Railway project, click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway will auto-generate `DATABASE_URL`

### 1.3 Add Redis

1. Click **"New"** → **"Database"** → **"Redis"**
2. Railway will auto-generate `REDIS_URL`

### 1.4 Configure Environment Variables

In Railway → Your Service → **Variables** tab, add:

```env
# Required
NODE_ENV=production
PORT=3000
JWT_SECRET=<generate-32+-char-secret>
ENCRYPTION_KEY=<generate-exactly-32-char-key>

# URLs (Railway provides these automatically)
DATABASE_URL=<auto-from-postgresql>
REDIS_URL=<auto-from-redis>

# Stripe (use test keys initially)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App URLs (update after deployment)
APP_URL=https://your-app.railway.app
WIDGET_URL=https://your-frontend.netlify.app
ALLOWED_ORIGINS=https://your-frontend.netlify.app

# Platform
PLATFORM_FEE_PERCENT=0.029
```

**Generate secrets:**
```bash
# JWT_SECRET (32+ chars)
openssl rand -base64 32

# ENCRYPTION_KEY (exactly 32 chars)
openssl rand -hex 16
```

### 1.5 Configure Build Settings

Railway should auto-detect from `railway.toml`. If not:

- **Build Command:** `npm install && npx prisma generate && npm run build`
- **Start Command:** `npx prisma migrate deploy && npm run start:prod`
- **Root Directory:** `checkie-backend`

### 1.6 Deploy

Click **"Deploy"** or push to `main` branch.

### 1.7 Get Backend URL

After deployment, copy your Railway URL:
```
https://checkie-backend-production.up.railway.app
```

---

## Step 2: Frontend on Netlify

### 2.1 Create Netlify Site

1. Go to [netlify.com](https://netlify.com) and sign in with GitHub
2. Click **"Add new site"** → **"Import an existing project"**
3. Select `Arshidin/checkie` repository

### 2.2 Configure Build Settings

- **Base directory:** `checkie-frontend`
- **Build command:** `npm run build`
- **Publish directory:** `checkie-frontend/dist` (or `build` depending on framework)

### 2.3 Environment Variables

In Netlify → Site settings → Environment variables:

```env
VITE_API_URL=https://your-backend.railway.app/api
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

### 2.4 Deploy

Click **"Deploy site"** or push to `main` branch.

---

## Step 3: Connect Services

### 3.1 Update Backend CORS

In Railway, update `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://your-site.netlify.app,https://your-custom-domain.com
```

### 3.2 Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-backend.railway.app/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook secret to Railway `STRIPE_WEBHOOK_SECRET`

---

## Step 4: Custom Domains (Optional)

### Backend (Railway)
1. Railway → Settings → Domains
2. Add custom domain (e.g., `api.checkie.app`)
3. Add DNS records to your domain provider

### Frontend (Netlify)
1. Netlify → Domain settings
2. Add custom domain (e.g., `checkie.app`)
3. Netlify provides automatic SSL

---

## Verification Checklist

After deployment, verify:

- [ ] Backend health: `https://your-backend.railway.app/api/health`
- [ ] API docs: `https://your-backend.railway.app/api/docs`
- [ ] Frontend loads
- [ ] Registration/Login works
- [ ] Checkout flow works (use Stripe test cards)

### Test Cards
```
Success: 4242 4242 4242 4242
3D Secure: 4000 0025 0000 3155
Decline: 4000 0000 0000 9995
```

---

## Troubleshooting

### Backend not starting
```bash
# Check Railway logs
railway logs

# Common issues:
# - Missing env vars → Add in Railway Variables
# - DB connection failed → Check DATABASE_URL
# - Prisma migration failed → Run manually: railway run npx prisma migrate deploy
```

### CORS errors
- Verify `ALLOWED_ORIGINS` includes frontend URL
- Check for trailing slashes (should NOT have them)

### Stripe webhooks not working
- Verify webhook URL is correct
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

## Costs

| Service | Free Tier | Paid |
|---------|-----------|------|
| Railway | $5/month credit | ~$5-20/month |
| Netlify | 100GB bandwidth | ~$0-19/month |
| PostgreSQL | Included in Railway | - |
| Redis | Included in Railway | - |

**Estimated total: $5-25/month** for a small production deployment.

---

## Quick Commands

```bash
# Deploy backend manually
cd checkie-backend
railway up

# Check backend status
railway status

# View logs
railway logs

# Run migrations
railway run npx prisma migrate deploy

# Open Prisma Studio (local)
railway run npx prisma studio
```
