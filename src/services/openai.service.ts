import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { withRetry } from '../utils/retry';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'dummy',
  baseURL: 'https://api.groq.com/openai/v1',
});

// Global streaming state
let activeEmitter: EventEmitter | null = null;
let activeRunId: string = '';
let activeAgentId: string = 'unknown';

export function setStreamEmitter(emitter: EventEmitter, runId: string): void {
  activeEmitter = emitter;
  activeRunId = runId;
  console.log('✓ Stream emitter set for run:', runId.slice(0, 8));
}

export function setActiveAgentId(agentId: string): void {
  activeAgentId = agentId;
}

function emitToken(token: string): void {
  if (!activeEmitter || !activeRunId || !token) {
    console.log('EMIT SKIP — emitter:', !!activeEmitter, 'runId:', !!activeRunId);
    return;
  }
  activeEmitter.emit('agent:token', {
    runId: activeRunId,
    agentId: activeAgentId || 'unknown',
    token,
  });
}

function stripMarkdownCodeFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  model = 'llama-3.3-70b-versatile',
  agentId = 'unknown'
): Promise<string> {
  return withRetry(async () => {
    setActiveAgentId(agentId);
    let fullText = '';

    const stream = await groq.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullText += token;
        emitToken(token);
      }
    }

    if (!fullText) throw new Error('Groq returned empty response');
    return fullText;
  });
}

export async function callLLMJSON<T>(
  systemPrompt: string,
  userMessage: string,
  agentId = 'unknown'
): Promise<T> {
  const raw = await callLLM(
    systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown. No code fences. No explanation.',
    userMessage,
    'llama-3.3-70b-versatile',
    agentId
  );

  const cleaned = stripMarkdownCodeFences(raw);

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Invalid JSON from Groq: ${err instanceof Error ? err.message : String(err)}. Response: ${cleaned.slice(0, 200)}`
    );
  }
}