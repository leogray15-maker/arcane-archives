// netlify/functions/lead-agent.js
// Arcane Consulting — AI Lead Research & Email Generation Agent
// Powered by Claude claude-sonnet-4-6

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { companyName, website, linkedin, contactName, contactRole, industry, revenueEstimate, notes } = body;

  if (!companyName) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'companyName is required' }) };
  }

  const systemPrompt = `You are an elite outreach specialist for Arcane Consulting — a high-ticket consulting firm that offers a 90-day complete business transformation. The offer: "Fix the person, fix the business." Max 3 clients per quarter. Results-focused, premium positioning, no fluff.

Your job: research a business prospect and craft a hyper-personalised cold outreach email that will get a response.

The email should:
- Be conversational and direct — no corporate speak, no buzzwords
- Reference something SPECIFIC about their business (from the info provided)
- Connect a real pain point to the transformation Arcane delivers
- Be SHORT — 3-4 paragraphs max, under 150 words in the body
- Have a compelling subject line (max 8 words, curiosity-driven)
- End with a soft, low-friction CTA (e.g. "Worth a quick 15-min call?")
- Sound like it was written by a sharp human who actually looked at their business
- NOT mention AI, automation, or be obviously templated

Qualification criteria:
- highly_qualified: Business owner/founder with obvious pain points, revenue stage where consulting ROI is clear (£50k–£1M revenue range ideal), decision-maker identifiable
- qualified: Owner/founder but less obvious fit or info missing
- maybe: Could be a fit but significant info gaps or unclear decision-maker
- not_qualified: Employee (not owner), too early stage, or clearly not a fit

Always respond with valid JSON only. No markdown, no extra text.`;

  const userPrompt = `Generate a personalised cold outreach email for this prospect:

Company: ${companyName}
Website: ${website || 'not provided'}
LinkedIn: ${linkedin || 'not provided'}
Contact Name: ${contactName || 'unknown'}
Contact Role: ${contactRole || 'unknown'}
Industry: ${industry || 'unknown'}
Revenue Estimate: ${revenueEstimate || 'unknown'}
Additional Notes: ${notes || 'none'}

Return a JSON object with exactly these fields:
{
  "subject": "email subject line",
  "emailBody": "full email body (plain text, use \\n for line breaks)",
  "qualification": "highly_qualified|qualified|maybe|not_qualified",
  "qualificationReason": "1–2 sentence explanation of why",
  "painPoints": ["pain point 1", "pain point 2"],
  "suggestedApproach": "brief note on the angle used in this email"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Claude API error', detail: errText }) };
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    let parsed;
    try {
      // Strip any accidental markdown fences
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse Claude response:', rawText);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to parse AI response', raw: rawText }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        subject: parsed.subject || '',
        emailBody: parsed.emailBody || '',
        qualification: parsed.qualification || 'maybe',
        qualificationReason: parsed.qualificationReason || '',
        painPoints: parsed.painPoints || [],
        suggestedApproach: parsed.suggestedApproach || '',
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0
      })
    };

  } catch (err) {
    console.error('lead-agent error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Server Error', detail: err.message }) };
  }
};
