import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Provider config — mirrors MODEL_CONFIGS in AIHelper but lives server-side
// ---------------------------------------------------------------------------
const PROVIDER_CONFIG = {
    OPENAI: {
        baseUrl: 'https://api.openai.com/v1',
        envKey: 'OPENAI_API_KEY',
    },
    GEMINI: {
        // Gemini 2.x models are available on v1beta
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        envKey: 'GEMINI_API_KEY',
    },
    DEEPSEEK: {
        baseUrl: 'https://api.deepseek.com/v1',
        envKey: 'DEEPSEEK_API_KEY',
    },
} as const;

type Provider = keyof typeof PROVIDER_CONFIG;

// ---------------------------------------------------------------------------
// Request body shape sent by AIHelper
// ---------------------------------------------------------------------------
interface AIRequestBody {
    provider: Provider;
    model: string;
    /** Full prompt (system + user content merged by AIHelper) */
    prompt: string;
    /**
     * Optional user-supplied API key.
     * If omitted, the route falls back to the corresponding env var.
     * This lets the app work as a demo (pre-configured keys) while still
     * allowing visitors to use their own keys without exposing them in client
     * bundle or network requests to external APIs.
     */
    apiKey?: string;
}

// ---------------------------------------------------------------------------
// Helper: extract text from each provider's response shape
// ---------------------------------------------------------------------------
function extractTextFromResponse(provider: Provider, data: Record<string, unknown>): string {
    switch (provider) {
        case 'OPENAI':
        case 'DEEPSEEK': {
            const choices = data.choices as Array<{ message: { content: string } }>;
            return choices[0].message.content;
        }
        case 'GEMINI': {
            const candidates = data.candidates as Array<{
                content: { parts: Array<{ text: string }> };
            }>;
            return candidates[0].content.parts[0].text;
        }
    }
}

// ---------------------------------------------------------------------------
// Helper: build provider-specific request
// ---------------------------------------------------------------------------
function buildProviderRequest(
    provider: Provider,
    model: string,
    prompt: string,
    apiKey: string,
): { endpoint: string; headers: Record<string, string>; payload: unknown } {
    const config = PROVIDER_CONFIG[provider];

    const commonHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    switch (provider) {
        case 'OPENAI':
        case 'DEEPSEEK':
            return {
                endpoint: `${config.baseUrl}/chat/completions`,
                headers: { ...commonHeaders, Authorization: `Bearer ${apiKey}` },
                payload: {
                    model,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are an AI assistant that generates node setups for a modular computational framework.',
                        },
                        { role: 'user', content: prompt },
                    ],
                },
            };

        case 'GEMINI':
            return {
                endpoint: `${config.baseUrl}/models/${model}:generateContent`,
                headers: { ...commonHeaders, 'x-goog-api-key': apiKey },
                payload: {
                    contents: [{ parts: [{ text: prompt }] }],
                },
            };
    }
}

// ---------------------------------------------------------------------------
// POST /api/ai
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: AIRequestBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { provider, model, prompt, apiKey: clientKey } = body;

    // Validate provider
    if (!provider || !(provider in PROVIDER_CONFIG)) {
        return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    if (!model) {
        return NextResponse.json({ error: 'model is required' }, { status: 400 });
    }

    if (!prompt?.trim()) {
        return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    // Resolve API key: prefer client-supplied, fall back to server env var
    const resolvedKey = clientKey?.trim() || process.env[PROVIDER_CONFIG[provider].envKey] || '';
    if (!resolvedKey) {
        return NextResponse.json(
            {
                error: `No API key available for ${provider}. Provide one in the AI Helper panel or set the ${PROVIDER_CONFIG[provider].envKey} environment variable.`,
            },
            { status: 401 },
        );
    }

    const { endpoint, headers, payload } = buildProviderRequest(
        provider,
        model,
        prompt,
        resolvedKey,
    );

    let upstreamRes: Response;
    try {
        upstreamRes = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { error: `Network error reaching ${provider}: ${message}` },
            { status: 502 },
        );
    }

    const responseText = await upstreamRes.text();

    if (!upstreamRes.ok) {
        return NextResponse.json(
            { error: `${provider} API error ${upstreamRes.status}: ${responseText}` },
            { status: upstreamRes.status },
        );
    }

    let data: Record<string, unknown>;
    try {
        data = JSON.parse(responseText);
    } catch {
        return NextResponse.json(
            { error: 'Failed to parse upstream response as JSON' },
            { status: 502 },
        );
    }

    let text: string;
    try {
        text = extractTextFromResponse(provider, data);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { error: `Unexpected response shape from ${provider}: ${message}` },
            { status: 502 },
        );
    }

    return NextResponse.json({ text });
}
