# Ticket Rio · Pagar.me V5

The storefront creates a local order from server-validated product prices, then sends the buyer to a Pagar.me hosted payment page. Card numbers never enter Ticket Rio's frontend or database. The hosted checkout requests credit card, Pix and boleto; unsupported methods are removed only after the production API rejects that configuration. Credit card starts at up to 12 interest-free installments, limited by the purchase amount, and retries with one installment if the provider rejects the maximum. The provider page presents the final accepted methods and installment count before payment.

## Configuration

Supabase Edge Function secrets (not Vite or Vercel public variables):

- `PAGARME_SECRET_KEY`: production `sk_...` key.
- `PAGARME_ACCOUNT_ID`: expected `acc_...` identifier for incoming webhooks.

The functions use Supabase's built-in server-only service role credential. `pagarme-checkout` requires a signed-in user JWT. `pagarme-webhook` accepts an unauthenticated POST, but ignores the sender's payment status and fetches the order from Pagar.me with the secret key before changing any local state. It checks account ID, local order code, currency, amount and charge status. Each webhook ID is recorded once.

Configure this HTTPS URL in Pagar.me Dashboard → Desenvolvimento → Webhooks:

`https://xylnlwtinrahtvgacxoc.supabase.co/functions/v1/pagarme-webhook`

Subscribe at minimum to `order.paid`, `order.payment_failed`, `order.canceled`, `charge.refunded`, `checkout.closed` and `checkout.canceled`. Pagar.me may send further `order.*` and `charge.*` events; the handler reconciles them against the provider's order instead of trusting the event body.

## Release sequence

1. Deploy the two database migrations. Check the approved purchase terms version is 3.
2. Set both Edge Function secrets. Deploy `pagarme-checkout` with JWT verification and `pagarme-webhook` without platform JWT verification.
3. Merge and deploy the Vercel storefront. Check that the checkout summary and terms load with sales still disabled.
4. Configure the webhook in Pagar.me and confirm its endpoint is reachable.
5. Run `data/activate-pagarme-commerce.sql` only after confirming the 35 legacy prices and contractual unlimited-stock decision. Four unpriced City Tour products remain under enquiry.
6. Observe the first real payment in Pagar.me and the matching order status in Ticket Rio before considering the integration financially proven. Do not place a live test purchase unless the merchant explicitly wants a real transaction.

The current stock model represents contractual unlimited sales with a high numeric ceiling. A paid order records an inventory movement and a delivery record; it does not create an official event ticket. A paid event arriving after a reservation was released is flagged for manual review instead of claiming that inventory was fulfilled. Unpaid boleto orders can reserve availability for several days; expired reservations are released when a new checkout starts. Add scheduled reconciliation as volume grows.

If the production key has been shared outside the merchant's trusted channels, rotate it in Pagar.me and update the Supabase secret before accepting further sales.
