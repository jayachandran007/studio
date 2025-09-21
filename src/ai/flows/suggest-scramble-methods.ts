// src/ai/flows/suggest-scramble-methods.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow that suggests different scrambling methods for messages.
 *
 * The flow uses an LLM to generate scrambling method suggestions based on the input message.
 * It exports:
 * - `suggestScrambleMethods`: The main function to trigger the flow.
 * - `SuggestScrambleMethodsInput`: The input type for the flow.
 * - `SuggestScrambleMethodsOutput`: The output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestScrambleMethodsInputSchema = z.object({
  message: z.string().describe('The message to be scrambled.'),
});

export type SuggestScrambleMethodsInput = z.infer<
  typeof SuggestScrambleMethodsInputSchema
>;

const SuggestScrambleMethodsOutputSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe('An array of suggested scrambling methods.'),
});

export type SuggestScrambleMethodsOutput = z.infer<
  typeof SuggestScrambleMethodsOutputSchema
>;

export async function suggestScrambleMethods(
  input: SuggestScrambleMethodsInput
): Promise<SuggestScrambleMethodsOutput> {
  return suggestScrambleMethodsFlow(input);
}

const suggestScrambleMethodsPrompt = ai.definePrompt({
  name: 'suggestScrambleMethodsPrompt',
  input: {schema: SuggestScrambleMethodsInputSchema},
  output: {schema: SuggestScrambleMethodsOutputSchema},
  prompt: `Suggest at least three different methods for scrambling the following message, make them creative and diverse. The suggestion should be usable by the user.

Message: {{{message}}}`,
});

const suggestScrambleMethodsFlow = ai.defineFlow(
  {
    name: 'suggestScrambleMethodsFlow',
    inputSchema: SuggestScrambleMethodsInputSchema,
    outputSchema: SuggestScrambleMethodsOutputSchema,
  },
  async input => {
    const {output} = await suggestScrambleMethodsPrompt(input);
    return output!;
  }
);
