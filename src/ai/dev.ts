'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-quotation-summary.ts';
import '@/ai/flows/summarize-client-interactions.ts';
import '@/ai/flows/suggest-next-action.ts';
import '@/ai/flows/draft-follow-up-script.ts';
import '@/ai/flows/analyze-discard-reasons.ts';
import '@/ai/flows/generate-daily-summary.ts';
import '@/ai/flows/generate-product-summary.ts';
import '@/ai/flows/generate-follow-up-summary.ts';
