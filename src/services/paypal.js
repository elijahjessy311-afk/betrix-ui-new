import fetch from 'node-fetch';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}

export class PayPalService {
  static async createSubscriptionOrder(sport, tier, _userEmail) {
    try {
      const accessToken = await getAccessToken();
      
      const PRICING_TIERS = {
        football: { starter: 9.99, pro: 24.99, elite: 59.99 },
        basketball: { starter: 9.99, pro: 24.99, elite: 59.99 },
        tennis: { starter: 9.99, pro: 24.99, elite: 59.99 },
        cricket: { starter: 9.99, pro: 24.99, elite: 59.99 },
        baseball: { starter: 9.99, pro: 24.99, elite: 59.99 },
        hockey: { starter: 9.99, pro: 24.99, elite: 59.99 },
        rugby: { starter: 9.99, pro: 24.99, elite: 59.99 },
        esports: { starter: 9.99, pro: 24.99, elite: 59.99 },
        mma: { starter: 9.99, pro: 24.99, elite: 59.99 },
        boxing: { starter: 9.99, pro: 24.99, elite: 59.99 },
        soccer: { starter: 9.99, pro: 24.99, elite: 59.99 },
        volleyball: { starter: 9.99, pro: 24.99, elite: 59.99 },
        allAccess: { bundle: 149.99 }
      };

      const price = PRICING_TIERS[sport]?.[tier] || 9.99;

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: price.toFixed(2)
          },
          description: `BETRIX ${sport} ${tier} Subscription`
        }]
      };

      const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(orderData)
      });

      const order = await response.json();
      return {
        success: true,
        orderId: order.id,
        approvalUrl: order.links.find(link => link.rel === 'approve')?.href
      };
    } catch (error) {
      console.error('PayPal order creation error:', error);
      return { success: false, error: error.message };
    }
  }

  static async captureOrder(orderId) {
    try {
      const accessToken = await getAccessToken();

      const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const data = await response.json();
      return {
        success: data.status === 'COMPLETED',
        data
      };
    } catch (error) {
      console.error('PayPal capture error:', error);
      return { success: false, error: error.message };
    }
  }
}
