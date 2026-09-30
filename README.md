# Ticket Rio Carnaval

Mobile-first demonstrator for a Rio de Janeiro Carnival ticket storefront. The event dates, sectors, availability and prices are sample data. Checkout is simulated locally; the site does not issue tickets or collect payment details.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`. Vercel serves the Vite build from `dist`.

## Main flow

Choose a parade date and section, add sample tickets to the cart, and complete the no-charge demonstration. The visible notice is intentional while the store uses mock data.

## Supabase catalogue

The published catalogue is read from the `public.catalog_products` table using Supabase's Data API. Apply the migration in `supabase/migrations/` to a new project, then configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Ticket Rio Vercel project for Production, Preview, and Development. Copy `.env.example` to `.env.local` for local development. These `VITE_*` values are public browser configuration; never add a database password or a Supabase secret/service-role key to the frontend.

RLS exposes only rows with `is_published = true` for read-only public access. If the API is unavailable, the site displays its original local sample catalogue with a visible notice. Checkout and chat remain simulations.
