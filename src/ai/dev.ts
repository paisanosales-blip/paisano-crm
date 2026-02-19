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
import '@/ai/flows/generate-sales-coaching.ts';
import '@/ai/flows/generate-marketing-plan.ts';
import '@/ai/flows/summarize-seller-activity.ts';
import '@/ai/flows/enrich-prospect-data.ts';
import '@/ai/flows/generate-presentation-video.ts';
