// netlify/functions/consulting-agent.js
// Arcane Consulting — Pipeline AI Agent
// Handles all pipeline stages: follow-up sequences, call prep, post-call processing,
// proposals, onboarding plans, and case studies.

const ACTIONS = ['follow_up_sequence', 'call_prep', 'post_call', 'proposal', 'onboarding', 'case_study', 'reply_analysis', 'cold_call_brief'];

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action, lead, context } = body;

  if (!action || !ACTIONS.includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `action must be one of: ${ACTIONS.join(', ')}` }) };
  }
  if (!lead) return { statusCode: 400, headers, body: JSON.stringify({ error: 'lead object required' }) };

  const { systemPrompt, userPrompt } = buildPrompts(action, lead, context || '');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] })
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Claude API error', detail: err }) };
    }

    const data = await res.json();
    const raw = (data.content?.[0]?.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to parse AI response', raw }) }; }

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Server Error', detail: err.message }) };
  }
};

function leadContext(lead) {
  return `
Company: ${lead.company || 'Unknown'}
Contact: ${lead.name || 'Unknown'} — ${lead.role || lead.contactRole || 'Unknown role'}
Industry: ${lead.industry || 'Unknown'}
Revenue Estimate: ${lead.revenueEstimate || 'Unknown'}
Current Stage: ${lead.stage || 'Unknown'}
Deal Value Target: ${lead.dealValue ? '£' + lead.dealValue : 'Unknown'}
Qualification: ${lead.qualification || 'Unknown'}
Recent Notes: ${lead.notes || 'None'}`.trim();
}

function buildPrompts(action, lead, context) {
  const base = `You are working for Arcane Consulting — a premium 90-day complete business transformation firm. The offer: "Fix the person, fix the business." Max 3 clients per quarter. High-ticket, results-focused, no fluff. The consultant (Leo) is direct, sharp, and gets transformational results. Always respond with valid JSON only. No markdown, no extra text.`;

  switch (action) {

    case 'follow_up_sequence': return {
      systemPrompt: `${base} You are an elite email follow-up strategist. Generate a 3-email sequence that is warm but direct, escalating from curious check-in → value nudge → final clear ask. Never beg. Position from abundance — 3 slots per quarter, selective process. Emails should be SHORT (under 80 words each), punchy, and sound human.`,
      userPrompt: `Generate a follow-up email sequence for this prospect who hasn't responded to the first outreach:

${leadContext(lead)}
${context ? `\nAdditional context: ${context}` : ''}

Return JSON:
{
  "emails": [
    { "day": 3, "subject": "...", "body": "..." },
    { "day": 7, "subject": "...", "body": "..." },
    { "day": 14, "subject": "...", "body": "..." }
  ],
  "strategy": "brief note on the escalation approach used"
}`
    };

    case 'call_prep': return {
      systemPrompt: `${base} You are an elite sales strategist coaching a high-ticket closer. Prepare a comprehensive call brief for a discovery or diagnostic call. Goal: qualify deeply, uncover core pain, create desire for the next step. NOT a pitch — it's a diagnostic conversation. Give sharp, specific questions and objection responses.`,
      userPrompt: `Prepare a call prep brief for this prospect:

${leadContext(lead)}
${context ? `\nSpecific context / things to probe: ${context}` : ''}

Return JSON:
{
  "brief": "2-3 sentence overview of this prospect and the angle to take",
  "openingMove": "exactly how to open the call (1-2 sentences)",
  "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"],
  "painPointsToProbe": ["pain 1", "pain 2", "pain 3"],
  "objections": [
    { "objection": "...", "response": "..." },
    { "objection": "...", "response": "..." }
  ],
  "recommendedClose": "exact wording to set up the next step / diagnostic",
  "watchOutFor": "red flags or things to be careful about with this specific prospect"
}`
    };

    case 'post_call': return {
      systemPrompt: `${base} You are a sales coach and CRM specialist. Process raw call notes into clean, actionable output. Determine the right next stage, write a follow-up email, and list clear next actions. Be decisive — give specific recommendations, not vague options.`,
      userPrompt: `Process these call notes and generate next actions:

${leadContext(lead)}

Raw call notes:
${context || 'No notes provided — make reasonable assumptions based on lead info.'}

Return JSON:
{
  "summary": "clean 3-4 sentence summary of the call",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "qualificationUpdate": "highly_qualified|qualified|maybe|not_qualified",
  "recommendedStage": "new_lead|contacted|qualified|diagnostic_paid|diagnostic_done|90_day_active|completed",
  "stageReasoning": "1 sentence why",
  "nextActions": ["action 1", "action 2", "action 3"],
  "followUpEmail": {
    "subject": "...",
    "body": "..."
  },
  "followUpDays": 2
}`
    };

    case 'proposal': return {
      systemPrompt: `${base} You are a high-ticket sales writer. Generate a compelling proposal email for a prospect who just completed their paid diagnostic. Bridge their specific diagnosed pain to the 90-day transformation outcome. Create genuine urgency around limited availability (1 of 3 slots). The program investment should feel like a bargain against the diagnosed cost of inaction.`,
      userPrompt: `Generate a proposal email for this prospect who has completed their diagnostic:

${leadContext(lead)}
${context ? `\nDiagnostic findings / key pain points uncovered: ${context}` : ''}

Return JSON:
{
  "subject": "...",
  "emailBody": "...",
  "keyValueProps": ["prop 1", "prop 2", "prop 3"],
  "recommendedInvestment": "suggested deal structure (e.g. £X diagnostic credited, £X program fee)",
  "urgencyAngle": "the specific scarcity/urgency used in this proposal",
  "nextStep": "exact CTA / next step described in the email"
}`
    };

    case 'onboarding': return {
      systemPrompt: `${base} You are a client success specialist. A new client just signed their 90-day transformation. Generate everything needed for a perfect onboarding: warm welcome email, Week 1 plan, 90-day roadmap overview, and first check-in questions. Tone: we've got you, this is going to change everything — professional but human.`,
      userPrompt: `Generate an onboarding package for this new client:

${leadContext(lead)}
${context ? `\nGoals / key transformation areas: ${context}` : ''}

Return JSON:
{
  "welcomeEmail": {
    "subject": "...",
    "body": "..."
  },
  "weekOnePlan": ["day 1 action", "day 2-3 action", "day 4-5 action", "end of week 1 milestone"],
  "ninetyDayRoadmap": "structured overview of Month 1 (Foundation), Month 2 (Execution), Month 3 (Scale)",
  "firstCheckInQuestions": ["question 1", "question 2", "question 3", "question 4"],
  "quickWins": ["quick win 1", "quick win 2", "quick win 3"]
}`
    };

    case 'case_study': return {
      systemPrompt: `${base} You are a marketing and referral specialist. A client has completed their 90-day transformation. Generate a compelling case study outline, a referral request email, and a testimonial request. Position results powerfully. The referral email should feel personal and low-pressure.`,
      userPrompt: `Generate a case study and referral package for this completed client:

${leadContext(lead)}
${context ? `\nResults achieved / transformation highlights: ${context}` : ''}

Return JSON:
{
  "caseStudyOutline": {
    "headline": "result-focused headline",
    "situation": "the before state",
    "intervention": "what we did together",
    "results": "the after state / outcomes",
    "quote": "suggested testimonial quote in their voice"
  },
  "referralEmail": {
    "subject": "...",
    "body": "..."
  },
  "testimonialRequest": "exact message to send asking for a testimonial",
  "nextOpportunity": "is there a potential upsell or continuation? What would you suggest?"
}`
    };

    case 'reply_analysis': return {
      systemPrompt: `${base} You are a sales conversation expert. Analyze a prospect's reply, extract sentiment and buying signals, and draft the perfect response. Be decisive about the recommended next action and pipeline stage.`,
      userPrompt: `Analyze this prospect's reply and recommend the best response:

${leadContext(lead)}

Prospect's reply:
${context || 'No reply content provided.'}

Return JSON:
{
  "sentiment": "positive|neutral|negative|objecting|interested|not_interested",
  "buyingSignals": ["signal 1", "signal 2"],
  "keyTakeaways": ["takeaway 1", "takeaway 2"],
  "recommendedStage": "new_lead|contacted|qualified|diagnostic_paid|diagnostic_done|90_day_active|completed",
  "suggestedReply": {
    "subject": "...",
    "body": "..."
  },
  "recommendedAction": "specific next action to take",
  "urgency": "high|medium|low"
}`
    };

    case 'cold_call_brief': return {
      systemPrompt: `${base} You are an elite cold call coach for high-ticket B2B sales. Generate a complete cold call battle card for a 90-day business transformation offer. The opener must be a pattern interrupt — NOT "how are you?" or "is this a bad time?". The pitch must be under 30 seconds when spoken aloud. Everything must be punchy, direct, and natural — written exactly as it should be spoken, not corporate. The goal of the call is NOT to close on the spot — it's to qualify and book a discovery call or get them interested in the diagnostic.`,
      userPrompt: `Generate a complete cold call brief for this prospect:

${leadContext(lead)}
${context ? `\nExtra context: ${context}` : ''}

Return JSON:
{
  "whyThisLead": "1 sentence — why this specific company is a strong fit",
  "openingLine": "exact word-for-word opener — pattern interrupt, states who you are and why you're calling in under 10 seconds",
  "permissionAsk": "the permission-based question after the opener (e.g. 'caught you at a bad time?')",
  "problemStatement": "the pain/problem framed for their specific business type — spoken naturally, 1-2 sentences",
  "qualifyingQuestions": ["Q1 — decision maker check", "Q2 — pain/problem check", "Q3 — motivation/timing check"],
  "thirtySecondPitch": "full pitch spoken naturally — what Arcane does, who it's for, what outcome they get — max 30 seconds",
  "closeLine": "the exact ask to book the next step",
  "altCloseLines": ["alternative close 1", "alternative close 2"],
  "objections": [
    {"trigger": "I'm busy / bad time", "response": "..."},
    {"trigger": "Not interested", "response": "..."},
    {"trigger": "Already working with someone", "response": "..."},
    {"trigger": "How much does it cost?", "response": "..."},
    {"trigger": "Send me an email", "response": "..."},
    {"trigger": "I need to think about it", "response": "..."}
  ],
  "voicemailScript": "15-second voicemail — leaves curiosity, not a pitch",
  "talkingPoints": ["key point 1", "key point 2", "key point 3"],
  "redFlags": ["thing to watch out for 1", "thing to watch out for 2"],
  "callGoal": "the specific outcome to aim for on this call"
}`
    };

    default:
      return { systemPrompt: base, userPrompt: 'Return { "error": "unknown action" }' };
  }
}
