// ============================================================
// Solana Narrative Pulse — Multi-Model AI Router
// ============================================================
// Routes tasks to the best model:
//   • Reasoning (narrative detection)  → o3-mini (deep thinking)
//   • Writing (idea generation)        → Claude Sonnet or GPT-4o-mini
//   • Fallback                         → GPT-4o-mini (always available)

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ── Clients ──────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

// ── Anthropic credit exhaustion tracking ─────────────────────
// When Anthropic returns a billing/quota error, we disable it for the
// rest of this server process and route writing tasks to o3-mini instead.
let anthropicDisabled = false;

function isAnthropicCreditError(err: any): boolean {
    const status = err?.status || err?.statusCode;
    const errType = err?.error?.type || err?.type || '';
    const message = (err?.message || '').toLowerCase();

    // Anthropic billing errors: 400/403 with billing-related messages
    if ((status === 400 || status === 403) &&
        (errType === 'billing_error' || message.includes('billing') || message.includes('credit') || message.includes('quota'))) {
        return true;
    }
    // Anthropic overloaded / insufficient credits via 429 with specific type
    if (status === 429 && (errType === 'insufficient_credits' || message.includes('credit'))) {
        return true;
    }
    // Catch-all for common credit exhaustion messages
    if (message.includes('insufficient funds') || message.includes('payment required') || message.includes('exceeded your current quota')) {
        return true;
    }
    return false;
}

// ── Model Configuration ─────────────────────────────────────
export const MODELS = {
    // Reasoning model — used for narrative detection
    // NOTE: o3-mini produces better results but takes 30-60s+ which exceeds
    // Vercel serverless timeouts. Using gpt-4o-mini for reliable performance.
    reasoning: {
        provider: 'openai' as const,
        model: 'gpt-4o-mini',
        label: 'GPT-4o-mini (reasoning)',
    },
    // Fast creative model — used for idea generation
    writing: {
        provider: (anthropic ? 'anthropic' : 'openai') as 'openai' | 'anthropic',
        model: anthropic ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini',
        label: anthropic ? 'Claude Sonnet 4 (writing)' : 'GPT-4o-mini (writing)',
    },
    // Cheap fallback
    fallback: {
        provider: 'openai' as const,
        model: 'gpt-4o-mini',
        label: 'GPT-4o-mini (fallback)',
    },
} as const;

// ── Types ────────────────────────────────────────────────────
interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ModelResponse {
    content: string;
    model: string;
    provider: string;
    tokensUsed?: number;
}

type ModelRole = keyof typeof MODELS;

// ── Core Router ──────────────────────────────────────────────
export async function routeToModel(
    role: ModelRole,
    messages: ChatMessage[],
    options: {
        jsonMode?: boolean;
        maxTokens?: number;
        temperature?: number;
    } = {}
): Promise<ModelResponse> {
    const config = MODELS[role];
    const { jsonMode = false, maxTokens = 4000, temperature = 0.7 } = options;

    // If Anthropic credits are exhausted, route writing tasks to o3-mini
    const useAnthropicFallback = config.provider === 'anthropic' && anthropicDisabled;
    if (useAnthropicFallback) {
        console.log(`⚠️ Anthropic disabled (credits exhausted) — routing "${role}" to gpt-4o-mini`);
        return await callOpenAI('gpt-4o-mini', messages, { jsonMode, maxTokens, temperature });
    }

    try {
        if (config.provider === 'anthropic' && anthropic) {
            return await callAnthropic(config.model, messages, { maxTokens, temperature });
        }
        return await callOpenAI(config.model, messages, { jsonMode, maxTokens, temperature });
    } catch (err: any) {
        // Check if this is a credit/billing error from Anthropic
        if (config.provider === 'anthropic' && isAnthropicCreditError(err)) {
            anthropicDisabled = true;
            console.error(`🚨 Anthropic credits exhausted — all writing tasks will use o3-mini for this session`);
            return await callOpenAI('o3-mini', messages, { jsonMode, maxTokens, temperature });
        }

        console.warn(`Model ${config.label} failed, falling back to ${MODELS.fallback.label}:`, err);
        return await callOpenAI(MODELS.fallback.model, messages, { jsonMode, maxTokens, temperature });
    }
}

// ── OpenAI Call ──────────────────────────────────────────────
async function callOpenAI(
    model: string,
    messages: ChatMessage[],
    options: { jsonMode: boolean; maxTokens: number; temperature: number }
): Promise<ModelResponse> {
    // o3-mini doesn't support response_format or temperature
    const isO3 = model.startsWith('o3') || model.startsWith('o4');

    const completion = await openai.chat.completions.create({
        model,
        messages,
        ...(isO3
            ? { max_completion_tokens: options.maxTokens }
            : {
                response_format: options.jsonMode ? { type: 'json_object' as const } : undefined,
                max_tokens: options.maxTokens,
                temperature: options.temperature,
            }
        ),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error(`Empty response from ${model}`);

    // Detect error text returned as model content (e.g. "An error occurred...")
    const lower = content.trim().toLowerCase();
    if (lower.startsWith('an error') || lower.startsWith('i apologize') || lower.startsWith('sorry,')) {
        throw new Error(`Model returned error text instead of completion: ${content.slice(0, 120)}`);
    }

    return {
        content,
        model,
        provider: 'openai',
        tokensUsed: completion.usage?.total_tokens,
    };
}

// ── Anthropic Call ───────────────────────────────────────────
async function callAnthropic(
    model: string,
    messages: ChatMessage[],
    options: { maxTokens: number; temperature: number }
): Promise<ModelResponse> {
    if (!anthropic) throw new Error('Anthropic client not initialized');

    // Anthropic uses 'system' as a top-level param, not in messages
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await anthropic.messages.create({
        model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        system: systemMsg?.content || '',
        messages: nonSystemMessages,
    });

    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error(`Empty response from ${model}`);

    return {
        content: textBlock.text,
        model,
        provider: 'anthropic',
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    };
}

// ── Utility: Get active model info (for dashboard) ──────────
export function getActiveModels() {
    return {
        reasoning: MODELS.reasoning.label,
        writing: anthropicDisabled ? 'o3-mini (Anthropic credits exhausted)' : MODELS.writing.label,
        fallback: MODELS.fallback.label,
        hasAnthropic: !!anthropic && !anthropicDisabled,
    };
}
