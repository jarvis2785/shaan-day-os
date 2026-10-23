import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { consumeAiCall } from '@/lib/aiLimit';

const ESTIMATE_SYSTEM_PROMPT = `You are a productivity advisor. Given a task name, category, and user's time estimate, evaluate if the estimate is realistic.

Return JSON only:
{
  "isRealistic": boolean,
  "warning": string | null,
  "suggestedMinutes": number | null
}

If estimate is realistic: isRealistic: true, warning: null, suggestedMinutes: null.

If estimate is too low: isRealistic: false, warning: one sentence explanation of why it's not enough and what's more realistic. Keep it direct and specific to the task name. suggestedMinutes: your realistic estimate.

Category energy types:
- Agency & Client, College = deep focus, min 90 min
- Personal Brand creative work = min 60 min
- Personal/admin = 20-30 min is fine

Good warning examples:
'UI redesign requires sustained focus — 40 min gets you started but not finished. 120 min is more realistic.'
'Client proposals need uninterrupted deep work — 90 min minimum to produce quality output.'

Return raw JSON only. No preamble. No backticks.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized', message: 'Sign in first.' }, { status: 401 });
    }

    const { taskName, category, estimatedMinutes } = await req.json();

    if (!taskName || !category || !estimatedMinutes) {
      return NextResponse.json({ isRealistic: true, warning: null, suggestedMinutes: null });
    }

    const limit = await consumeAiCall(supabase, 'estimate');
    if (!limit.allowed) {
      return NextResponse.json({ isRealistic: true, warning: null, suggestedMinutes: null });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ isRealistic: true, warning: null, suggestedMinutes: null });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: ESTIMATE_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Task: "${taskName}"\nCategory: ${category}\nEstimated time: ${estimatedMinutes} minutes`,
        }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ isRealistic: true, warning: null, suggestedMinutes: null });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text ?? '';
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const cleaned = jsonMatch ? jsonMatch[1].trim() : content.trim();
    const result = JSON.parse(cleaned);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ isRealistic: true, warning: null, suggestedMinutes: null });
  }
}
