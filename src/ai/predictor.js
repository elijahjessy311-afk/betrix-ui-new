// Minimal match prediction engine (heuristic + explainability)
// This is intentionally simple: it uses available match fields to derive
// probabilities and returns a short rationale.

function safeAvg(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0.5;
  const nums = arr.map(Number).filter(n => !Number.isNaN(n));
  if (!nums.length) return 0.5;
  return nums.reduce((a,b) => a+b,0)/nums.length;
}

export function predictOutcome(match = {}) {
  // Heuristics: use recent form arrays if available
  const homeForm = match.home_last5 || match.homeForm || [];
  const awayForm = match.away_last5 || match.awayForm || [];

  const homeScore = safeAvg(homeForm.map(r => r === 'W' ? 1 : r === 'D' ? 0.5 : 0));
  const awayScore = safeAvg(awayForm.map(r => r === 'W' ? 1 : r === 'D' ? 0.5 : 0));

  // base probabilities
  let homeProb = 0.45 + (homeScore - awayScore) * 0.2;
  let awayProb = 0.35 - (homeScore - awayScore) * 0.15;
  let drawProb = 1 - (homeProb + awayProb);

  // clamp
  homeProb = Math.min(0.95, Math.max(0.02, homeProb));
  awayProb = Math.min(0.95, Math.max(0.02, awayProb));
  drawProb = Math.max(0.02, 1 - (homeProb + awayProb));

  // simple explainability lines
  const reasons = [];
  if (homeForm && homeForm.length) reasons.push(`Home recent form ${homeForm.join(',')}`);
  if (awayForm && awayForm.length) reasons.push(`Away recent form ${awayForm.join(',')}`);
  if (match.venue) reasons.push(`Venue: ${match.venue}`);

  const result = {
    probabilities: { home: Number(homeProb.toFixed(3)), draw: Number(drawProb.toFixed(3)), away: Number(awayProb.toFixed(3)) },
    confidence: Math.min(0.95, Math.max(0.4, 0.5 + Math.abs(homeProb - awayProb) / 2)),
    rationale: reasons.join(' • ') || 'Heuristic prediction based on available data'
  };
  return result;
}

export default { predictOutcome };
