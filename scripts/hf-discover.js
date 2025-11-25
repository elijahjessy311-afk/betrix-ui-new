#!/usr/bin/env node
/**
 * HF Discover - simple script to probe a short list of public Hugging Face models
 * Usage: HUGGINGFACE_TOKEN=hf_xxx node scripts/hf-discover.js
 */
import fetch from 'node-fetch';

const token = process.env.HUGGINGFACE_TOKEN;
if (!token) {
  console.error('Please set HUGGINGFACE_TOKEN in the environment.');
  process.exit(2);
}

// Try to discover popular text-generation models via the HF models API, then probe the router
async function discoverCandidates(limit = 10) {
  try {
    const apiUrl = `https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&limit=${limit}`;
    const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.error('Failed to fetch models list', res.status);
      return [];
    }
    const data = await res.json();
    // data is an array of model objects; use .modelId
    return data.map(d => d.modelId).filter(Boolean);
  } catch (err) {
    console.error('Model discovery failed', err.message);
    return [];
  }
}

async function probe(model) {
  const url = `https://router.huggingface.co/models/${model}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: 'Hello world', options: { wait_for_model: true } }),
      timeout: 20000
    });
    const txt = await res.text();
    if (res.ok) {
      console.log(`[OK] ${model} -> responded (${txt.length} bytes)`);
      return { model, ok: true, text: txt };
    } else {
      console.log(`[ERR] ${model} -> ${res.status} ${txt.slice(0,200)}`);
      return { model, ok: false, status: res.status, text: txt };
    }
  } catch (err) {
    console.log(`[FAIL] ${model} -> ${err.message}`);
    return { model, ok: false, error: err.message };
  }
}

(async () => {
  const candidates = await discoverCandidates(15);
  if (!candidates || candidates.length === 0) {
    console.log('No candidates discovered via API. You can try specifying HUGGINGFACE_MODELS manually.');
    process.exit(0);
  }
  console.log('Probing discovered models:', candidates.slice(0, 15));
  const results = [];
  for (const m of candidates) {
    // probe sequentially
    // limit model id length safety
    if (typeof m !== 'string' || m.length > 200) continue;
    const r = await probe(m);
    results.push(r);
  }
  const ok = results.filter(r => r.ok);
  if (ok.length === 0) console.log('No responsive models found via router.');
  else console.log('Responsive models:', ok.map(x => x.model));
  console.log('Done');
})();
