import fetch from 'node-fetch';

export async function sendAdminNotification(title, details = {}) {
  const slackUrl = process.env.SLACK_WEBHOOK_URL || null;
  const pdKey = process.env.PAGERDUTY_ROUTING_KEY || process.env.PAGERDUTY_SERVICE_KEY || null;
  const payloadBody = JSON.stringify(details, Object.keys(details).slice(0,50), 2);
  const text = `*${title}*\n\n\`\`\`\n${payloadBody}\n\`\`\``;

  // Slack
  try {
    if (slackUrl) {
      await fetch(slackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    }
  } catch (e) { /* best-effort */ }

  // PagerDuty Events v2
  try {
    if (pdKey) {
      const payload = {
        routing_key: pdKey,
        event_action: 'trigger',
        payload: {
          summary: title,
          severity: 'warning',
          source: 'betrix-ui',
          custom_details: details
        }
      };
      await fetch('https://events.pagerduty.com/v2/enqueue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
  } catch (e) { /* best-effort */ }
}

export default { sendAdminNotification };
