import config from "../../../config";


export const PAYPAL_BASE = config.paypal.mode === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

export const getPaypalAccessToken = async () => {
  const auth = Buffer.from(
    `${config.paypal.client_id}:${config.paypal.client_secret}`,
  ).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  return data.access_token;
};

export const createPaypalOrder = async (price: number, bookingId: string) => {
  const accessToken = await getPaypalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: bookingId,
          amount: { currency_code: 'USD', value: price.toFixed(2) },
        },
      ],
      application_context: {
        return_url: `${config.base_url_client}/payment/success?bookingId=${bookingId}`,
        cancel_url: `${config.base_url_client}/payment/cancel?bookingId=${bookingId}`,
      },
    }),
  });

  const data = await res.json();
  const approveLink = data.links.find((l: any) => l.rel === 'approve');

  return { orderId: data.id, approveUrl: approveLink?.href };
};