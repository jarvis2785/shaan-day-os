import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/constants';
import { timeToMinutes } from '@/lib/schedule';
import { runAnalysisFlow, ClaudeResponse, CallClaudeFn } from '@/lib/analyzeFlow';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();

    if (!input || !input.tasks || !input.today) {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid input' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'no_api_key', message: "The AI brain isn't set up on the server (missing key)." },
        { status: 500 }
      );
    }

    const userMessage = `Here is today's data. Analyze it and return the JSON response.

USER: ${JSON.stringify(input.user)}
TODAY: ${JSON.stringify(input.today)}
TASKS: ${JSON.stringify(input.tasks)}
DEAD ZONE SETTINGS: ${JSON.stringify(input.deadZoneSettings)}
CURRENT TIME: ${input.currentTime} IST
CONSTRAINTS: ${JSON.stringify(input.constraints)}`;

    const nowMin = timeToMinutes(input.currentTime);

    const callClaudeFn: CallClaudeFn = (messages) => callClaude(apiKey, messages);
    const result = await runAnalysisFlow(input, nowMin, callClaudeFn, userMessage);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.code, message: result.message, violations: result.violations },
        { status: result.status }
      );
    }

    return NextResponse.json(result.result);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Analysis failed unexpectedly' },
      { status: 500 }
    );
  }
}

async function callClaude(
  apiKey: string,
  messages: Array<{role: string; content: string}>
): Promise<ClaudeResponse> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return { parsed: null, rawText: null, stopReason: null };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    const stopReason = data.stop_reason || null;
    if (!content) return { parsed: null, rawText: null, stopReason };

    let parsed = null;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const cleaned = jsonMatch
        ? jsonMatch[1].trim()
        : content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('callClaude: Invalid JSON from Claude');
    }

    return { parsed, rawText: content, stopReason };
  } catch (e) {
    console.error('callClaude failed:', e);
    return { parsed: null, rawText: null, stopReason: null };
  }
}
