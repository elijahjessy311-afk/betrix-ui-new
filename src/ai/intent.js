import fetch from 'node-fetch';

// Lightweight intent classifier with safe fallbacks.
// - If input starts with '/', treat as a command intent
// - Rule-based matching for common commands
// - Optional external model call (HuggingFace/Cohere) if API keys provided via env

const RULES = [
  { name: 'start', pattern: /^\/start|^start/ },
  { name: 'help', pattern: /^\/help|help/ },
  { name: 'odds', pattern: /odds|give me odds|best odds|1x2|over under|btts/i },
  { name: 'pay', pattern: /pay|stk|mpesa|lipana|checkout|buy/i },
  { name: 'vvip', pattern: /vvip|vip|vvip/i },
  { name: 'menu', pattern: /menu|options/ },
  { name: 'fixtures', pattern: /fixtures|today|next|upcoming|who.?s playing/i }
];

export async function classifyIntent(text = '', session = {}) {
  const t = String(text || '').trim();
  if (!t) return { intent: 'unknown', confidence: 0 };

  // explicit command
  if (t.startsWith('/')) {
    const cmd = t.split(' ')[0].slice(1).toLowerCase();
    return { intent: cmd, confidence: 0.99, via: 'command' };
  }

  // rule-based matching
  for (const r of RULES) {
    if (r.pattern.test(t)) return { intent: r.name, confidence: 0.85, via: 'rules' };
  }

  // Context-aware heuristic: remember last queried team
  if (session?.lastTeam) {
    const team = session.lastTeam;
    if (t.toLowerCase().includes(team.toLowerCase())) return { intent: 'team_query', entity: team, confidence: 0.8, via: 'context' };
  }

  // Optional external fallback (HuggingFace Inference API)
  try {
    if (process.env.HUGGINGFACE_TOKEN) {
      const resp = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-mnli', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: t })
      });
      if (resp.ok) {
        const j = await resp.json();
        // best-effort: return label or unknown
        const label = Array.isArray(j) && j[0] && j[0].label ? j[0].label : 'unknown';
        return { intent: String(label).toLowerCase(), confidence: 0.7, via: 'huggingface' };
      }
    }
  } catch (e) { /* ignore external failures */ }

  // final fallback: unknown
  return { intent: 'unknown', confidence: 0.5 };
}

export default { classifyIntent };
