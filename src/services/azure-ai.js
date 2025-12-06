import fetch from 'node-fetch';

/**
 * Lightweight Azure OpenAI wrapper.
 * Reads configuration from the constructor and only enables itself when endpoint, key and deployment are provided.
 */
export class AzureAIService {
  constructor(endpoint, apiKey, deployment, apiVersion = '2023-05-15') {
    this.endpoint = endpoint ? String(endpoint).replace(/\/$/, '') : null;
    this.apiKey = apiKey || null;
    this.deployment = deployment || null;
    this.apiVersion = apiVersion || '2023-05-15';
    this.enabled = Boolean(this.endpoint && this.apiKey && this.deployment);
    this.lastUsed = null;
  }

  isHealthy() {
    // We consider it healthy if it is configured. A deeper probe could be added.
    return this.enabled;
  }

  async chat(message, context = {}) {
    if (!this.enabled) throw new Error('AzureAIService not configured');
    const url = `${this.endpoint}/openai/deployments/${encodeURIComponent(this.deployment)}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;

    const body = {
      // minimal chat payload expected by Azure OpenAI chat-completions
      messages: [
        { role: 'system', content: context.system || 'You are a helpful assistant.' },
        { role: 'user', content: String(message) }
      ],
      max_tokens: 512,
      temperature: 0.6,
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify(body),
      timeout: 60_000,
    });

    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { void e; }

    if (!resp.ok) {
      const errMsg = json?.error?.message || json?.error || text || `Azure returned ${resp.status}`;
      const e = new Error(`AzureAI error: ${errMsg}`);
      e.status = resp.status;
      throw e;
    }

    // Try to extract assistant content from known shapes
    let out = null;
    try {
      if (json?.choices && Array.isArray(json.choices) && json.choices[0]) {
        // chat completions: choices[0].message.content
        out = json.choices[0].message?.content || json.choices[0].text || null;
      }
    } catch (e) { void e; }

    this.lastUsed = this.deployment;

    if (out == null) {
      // fallback: return a stringified JSON result to aid debugging
      return json ? JSON.stringify(json) : text || '';
    }
    return String(out);
  }
}
