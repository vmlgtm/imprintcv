import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveProvider, getLanguageModel } from '../../../src/utils/llm.js';

describe('LLM Provider Resolution & Instantiation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.IMPRINTCV_PROVIDER;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves explicit provider correctly including ollama', () => {
    expect(resolveProvider('ollama')).toBe('ollama');
    expect(resolveProvider('gemini')).toBe('gemini');
    expect(resolveProvider('openai')).toBe('openai');
    expect(resolveProvider('anthropic')).toBe('anthropic');
    expect(resolveProvider('openrouter')).toBe('openrouter');
  });

  it('resolves provider from IMPRINTCV_PROVIDER env var', () => {
    process.env.IMPRINTCV_PROVIDER = 'ollama';
    expect(resolveProvider()).toBe('ollama');

    process.env.IMPRINTCV_PROVIDER = 'openai';
    expect(resolveProvider()).toBe('openai');
  });

  it('auto-resolves ollama when OLLAMA_BASE_URL is set and no API keys present', () => {
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/v1';
    expect(resolveProvider()).toBe('ollama');
  });

  it('instantiates ollama model via OpenAI compatibility client', () => {
    const model = getLanguageModel({
      provider: 'ollama',
      modelName: 'llama3.2',
      baseURL: 'http://localhost:11434/v1',
    });

    expect(model).toBeDefined();
    expect(model.modelId).toBe('llama3.2');
    expect(model.provider).toBe('openai.chat');
  });
});
