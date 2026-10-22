import { AnalysisInput, AnalysisResult } from './types';
import { validateAnalysis } from './validate';
import { computeScore, computeStats } from './score';
import { timeToMinutes, minutesToTime } from './schedule';

export interface ClaudeResponse {
  parsed: any | null;
  rawText: string | null;
  stopReason: string | null;
}

export type CallClaudeFn = (messages: Array<{role: string; content: string}>) => Promise<ClaudeResponse>;

export type FlowResult = {
  ok: true;
  result: AnalysisResult;
} | {
  ok: false;
  code: string;
  message: string;
  status: number;
  violations?: string[];
};

const IDENTIFIER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bcurrentTime\b/gi, 'the current time'],
  [/\bnoTaskBefore\b/gi, 'the end of your morning routine'],
  [/\bdayProfile\b/gi, 'day type'],
  [/\bfixedBlocks\b/gi, 'fixed blocks'],
  [/\bdeadZoneSettings\b/gi, 'dead zone settings'],
  [/\btotalFreeMinutes\b/gi, 'free time'],
  [/\bfreeWindows\b/gi, 'free windows'],
];

export function cleanUserFacingText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of IDENTIFIER_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

const ERROR_MESSAGES: Record<string, { message: string; status: number }> = {
  ai_unavailable: { message: "The AI brain didn't respond. Try again.", status: 502 },
  invalid_plan: { message: "The AI couldn't build a plan that respects your schedule rules. Try again — nothing was saved.", status: 422 },
};

export async function runAnalysisFlow(
  input: AnalysisInput,
  nowMinutes: number,
  callClaude: CallClaudeFn,
  userMessage: string,
): Promise<FlowResult> {
  let callCount = 0;

  const r1 = await callClaude([{role: 'user', content: userMessage}]);
  callCount++;

  let parsed = r1.parsed;
  let rawText = r1.rawText;

  if (!parsed || r1.stopReason === 'max_tokens') {
    if (callCount >= 2) return flowError('ai_unavailable');

    const r2 = await callClaude([{role: 'user', content: userMessage}]);
    callCount++;

    if (!r2.parsed || r2.stopReason === 'max_tokens') return flowError('ai_unavailable');

    parsed = r2.parsed;
    rawText = r2.rawText;
  }

  const validation = validateAnalysis(parsed, input, nowMinutes);
  let finalResult = validation.repaired;

  if (!validation.valid) {
    if (callCount >= 2) return flowError('invalid_plan', validation.violations);

    console.warn('Validation violations:', validation.violations);

    const violationLines = validation.violations.map(v => `• ${v}`).join('\n');
    const r2 = await callClaude([
      {role: 'user', content: userMessage},
      {role: 'assistant', content: rawText || ''},
      {role: 'user', content: `Your plan broke these rules. Fix only these problems and return the complete corrected JSON, JSON only.\n${violationLines}`},
    ]);
    callCount++;

    if (!r2.parsed || r2.stopReason === 'max_tokens') return flowError('ai_unavailable');

    const retryValidation = validateAnalysis(r2.parsed, input, nowMinutes);
    if (!retryValidation.valid) {
      console.warn('Retry still has violations:', retryValidation.violations);
      return flowError('invalid_plan', retryValidation.violations);
    }

    finalResult = retryValidation.repaired;
  }

  computeScore(finalResult, input, nowMinutes);
  computeStats(finalResult, input, nowMinutes);

  if (finalResult.schedule && finalResult.overflow) {
    const scheduledIds = new Set(finalResult.schedule.map(b => b.id));
    finalResult.overflow = finalResult.overflow.filter(o => !scheduledIds.has(o.id));
    finalResult.stats.tasksOverflow = finalResult.overflow.length;
  }

  if (finalResult.schedule) {
    finalResult.schedule = fillTimelineGaps(
      finalResult.schedule,
      input.user.wakeTime,
      input.user.sleepTime,
    );
  }

  if (finalResult.mentorAssessment) {
    finalResult.mentorAssessment = cleanUserFacingText(finalResult.mentorAssessment);
  }
  if (finalResult.overflow) {
    for (const item of finalResult.overflow) {
      item.reason = cleanUserFacingText(item.reason);
    }
  }
  if (finalResult.schedule) {
    for (const block of finalResult.schedule) {
      if (block.name) block.name = cleanUserFacingText(block.name);
      if (block.notes) block.notes = cleanUserFacingText(block.notes);
    }
  }

  return { ok: true, result: finalResult };
}

function flowError(code: string, violations?: string[]): FlowResult {
  const info = ERROR_MESSAGES[code] || { message: 'Unknown error', status: 500 };
  return { ok: false, code, message: info.message, status: info.status, violations };
}

function fillTimelineGaps(schedule: any[], wakeTime: string, sleepTime: string): any[] {
  const sorted = [...schedule]
    .filter(b => b.type !== 'wake' && b.type !== 'sleep')
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  const filled: any[] = [];
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);

  filled.push({
    id: 'wake', name: 'Wake up', start: wakeTime, end: wakeTime,
    type: 'wake', category: null, estimatedMinutes: 0, energyType: null, notes: null,
  });

  let cursor = wakeMin;
  for (const block of sorted) {
    const blockStart = timeToMinutes(block.start);
    if (blockStart > cursor + 29) {
      const gapMin = blockStart - cursor;
      filled.push({
        id: `gap-${cursor}`, name: getGapLabel(cursor, blockStart),
        start: minutesToTime(cursor), end: minutesToTime(blockStart),
        type: 'buffer', category: null, estimatedMinutes: gapMin, energyType: null, notes: null,
      });
    }
    filled.push(block);
    cursor = Math.max(cursor, timeToMinutes(block.end));
  }

  if (sleepMin > cursor + 29) {
    filled.push({
      id: `gap-${cursor}`, name: getGapLabel(cursor, sleepMin),
      start: minutesToTime(cursor), end: minutesToTime(sleepMin),
      type: 'buffer', category: null, estimatedMinutes: sleepMin - cursor, energyType: null, notes: null,
    });
  }

  filled.push({
    id: 'sleep', name: 'Wind down & sleep', start: sleepTime, end: sleepTime,
    type: 'sleep', category: null, estimatedMinutes: 0, energyType: null, notes: null,
  });

  return filled;
}

function getGapLabel(startMin: number, endMin: number): string {
  const mid = (startMin + endMin) / 2;
  if (startMin >= 7 * 60 && endMin <= 8 * 60) return 'Morning routine';
  if (mid >= 12 * 60 && mid <= 13.5 * 60) return 'Lunch break';
  if (mid >= 18 * 60 && mid <= 20 * 60) return 'Dinner & rest';
  if (startMin >= 21 * 60) return 'Wind down';
  if (endMin - startMin <= 30) return 'Transit';
  return 'Free block';
}
