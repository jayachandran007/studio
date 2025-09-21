'use server';
/**
 * @fileOverview Message scrambling flow using an LLM.
 *
 * - scrambleMessage - A function that scrambles a message using an LLM.
 * - ScrambleMessageInput - The input type for the scrambleMessage function.
 * - ScrambleMessageOutput - The return type for the scrambleMessage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScrambleMessageInputSchema = z.object({
  message: z.string().describe('The message to be scrambled.'),
  method: z
    .string()
    .describe(
      'The method to use for scrambling the message.  Examples: letter substitution, reverse, or incorporate emoticons.'
    ),
});
export type ScrambleMessageInput = z.infer<typeof ScrambleMessageInputSchema>;

const ScrambleMessageOutputSchema = z.object({
  scrambledMessage: z.string().describe('The scrambled message.'),
});
export type ScrambleMessageOutput = z.infer<typeof ScrambleMessageOutputSchema>;

export async function scrambleMessage(input: ScrambleMessageInput): Promise<ScrambleMessageOutput> {
  return scrambleMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scrambleMessagePrompt',
  input: {schema: ScrambleMessageInputSchema},
  output: {schema: ScrambleMessageOutputSchema},
  prompt: `You are a message scrambling expert. You will take a message and scramble it according to the method specified by the user. If the message contains emojis, you must remove them entirely from the scrambled output. Return ONLY the scrambled message.

Message: {{{message}}}
Method: {{{method}}}`,
});

const scrambleMessageFlow = ai.defineFlow(
  {
    name: 'scrambleMessageFlow',
    inputSchema: ScrambleMessageInputSchema,
    outputSchema: ScrambleMessageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
