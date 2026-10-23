import { SupabaseClient } from '@supabase/supabase-js';

interface LimitResult {
  allowed: boolean;
  status: number;
  message: string;
}

export async function consumeAiCall(
  supabase: SupabaseClient,
  kind: 'analyze' | 'estimate'
): Promise<LimitResult> {
  try {
    const { data, error } = await supabase.rpc('consume_ai_call', { p_kind: kind });

    if (error) {
      console.error('consume_ai_call RPC error:', error);
      return { allowed: false, status: 503, message: 'Could not check usage limit. Try again shortly.' };
    }

    if (!data || typeof data !== 'object' || !('allowed' in data)) {
      console.error('consume_ai_call: malformed result', data);
      return { allowed: false, status: 503, message: 'Usage limit check returned an unexpected result.' };
    }

    if (data.allowed === true) {
      return { allowed: true, status: 200, message: '' };
    }

    const limit = data.limit ?? '?';
    if (data.reason === 'user_limit') {
      return {
        allowed: false,
        status: 429,
        message: `You've hit today's ${kind} limit (${limit}). Try again tomorrow.`,
      };
    }
    if (data.reason === 'global_limit') {
      return {
        allowed: false,
        status: 429,
        message: 'The app has hit its daily AI limit. Try again tomorrow.',
      };
    }

    return { allowed: false, status: 429, message: "You've hit today's limit. Try again tomorrow." };
  } catch (e) {
    console.error('consumeAiCall exception:', e);
    return { allowed: false, status: 503, message: 'Could not check usage limit. Try again shortly.' };
  }
}
