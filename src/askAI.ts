import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { askPrompt } from './askPrompt';
import { Readable } from 'stream';

export async function* askAI(
  fileContent: string,
  question: string,
  model: string,
  provider: 'anthropic' | 'openai'
): AsyncGenerator<string, void, undefined> {
  if (provider === 'anthropic') {
    const anthropic = new Anthropic();
    const stream = await anthropic.messages.create({
      messages: [{ role: 'user', content: askPrompt(question) }],
      model: model,
      max_tokens: 4096,
      stream: true,
      system: `CODE:\n${fileContent}\n`,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  } else if (provider === 'openai') {
    const openai = new OpenAI();
    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: `CODE:\n${fileContent}\n` },
        { role: 'user', content: askPrompt(question) }
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}
