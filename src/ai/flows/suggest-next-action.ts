'use server';

/**
 * @fileOverview An AI agent that suggests the next best action for a salesperson to take with a client.
 *
 * - suggestNextAction - A function that suggests the next best action for a salesperson.
 * - SuggestNextActionInput - The input type for the suggestNextAction function.
 * - SuggestNextActionOutput - The return type for the suggestNextAction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestNextActionInputSchema = z.object({
  pastInteractions: z
    .string()
    .describe(
      'A summary of past interactions with the client, including dates, topics discussed, and outcomes.'
    ),
  quotationStatus: z
    .string()
    .describe(
      'The current status of the quotation, including whether it has been sent, accepted, rejected, or is pending.'
    ),
  salesPipelineStage: z
    .string()
    .describe(
      'The current stage of the client in the sales pipeline (e.g., Prospect, Qualification, Proposal, Negotiation, Closed Won, Closed Lost).'
    ),
  clientDetails: z.string().describe('Details about the client and their needs.'),
});
export type SuggestNextActionInput = z.infer<typeof SuggestNextActionInputSchema>;

const SuggestNextActionOutputSchema = z.object({
  nextAction: z
    .string()
    .describe(
      'The suggested next action for the salesperson to take with the client. This should be a specific and actionable step.'
    ),
  rationale: z
    .string()
    .describe(
      'The rationale behind the suggested next action. Explain why this action is recommended based on the input data.'
    ),
});
export type SuggestNextActionOutput = z.infer<typeof SuggestNextActionOutputSchema>;

export async function suggestNextAction(
  input: SuggestNextActionInput
): Promise<SuggestNextActionOutput> {
  return suggestNextActionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestNextActionPrompt',
  input: {schema: SuggestNextActionInputSchema},
  output: {schema: SuggestNextActionOutputSchema},
  prompt: `You are an AI assistant helping a salesperson determine the next best action to take with a client.

  Based on the following information, suggest the single, most effective next action for the salesperson to take.
  Explain your rationale for the suggestion.

  Client Details: {{{clientDetails}}}
  Past Interactions: {{{pastInteractions}}}
  Quotation Status: {{{quotationStatus}}}
  Sales Pipeline Stage: {{{salesPipelineStage}}}

  Consider the client's needs, the current stage in the sales pipeline, and the status of any outstanding quotations.
  Suggest a specific and actionable next step that the salesperson can take to move the deal forward.
  The suggestion should be realistic.

  The response should be formatted as follows:
  Next Action: [The suggested next action]
  Rationale: [Explanation of why this action is recommended]
  `,
});

const suggestNextActionFlow = ai.defineFlow(
  {
    name: 'suggestNextActionFlow',
    inputSchema: SuggestNextActionInputSchema,
    outputSchema: SuggestNextActionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
