import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

export type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama';

export interface LLMOptions {
  provider?: ProviderType;
  modelName?: string;
  apiKey?: string;
  baseURL?: string;
}

const SUPPORTED_PROVIDERS: ProviderType[] = ['gemini', 'openai', 'anthropic', 'openrouter', 'ollama'];

export function resolveProvider(explicitProvider?: string): ProviderType {
  if (explicitProvider) {
    const p = explicitProvider.toLowerCase() as ProviderType;
    if (SUPPORTED_PROVIDERS.includes(p)) {
      return p;
    }
  }
  const envProvider = process.env.IMPRINTCV_PROVIDER?.toLowerCase() as ProviderType;
  if (envProvider && SUPPORTED_PROVIDERS.includes(envProvider)) {
    return envProvider;
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) return 'ollama';
  return 'gemini';
}

export function getLanguageModel(options: LLMOptions = {}): LanguageModel {
  const provider = options.provider || resolveProvider();
  
  switch (provider) {
    case 'gemini': {
      const google = createGoogleGenerativeAI({
        apiKey: options.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
      });
      return google(options.modelName || process.env.GEMINI_MODEL || 'gemini-3.7-flash');
    }
    case 'openai': {
      const openai = createOpenAI({
        apiKey: options.apiKey || process.env.OPENAI_API_KEY,
        baseURL: options.baseURL,
      });
      return openai(options.modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini');
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: options.baseURL,
      });
      return anthropic(options.modelName || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest');
    }
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: options.apiKey || process.env.OPENROUTER_API_KEY,
      });
      return openrouter(options.modelName || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001');
    }
    case 'ollama': {
      const ollama = createOpenAI({
        baseURL: options.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        apiKey: options.apiKey || process.env.OLLAMA_API_KEY || 'ollama',
      });
      return ollama(options.modelName || process.env.OLLAMA_MODEL || 'llama3.2');
    }
    default: {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}
