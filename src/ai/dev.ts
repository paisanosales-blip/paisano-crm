import { config } from 'dotenv';
config();

import '@/ai/flows/generate-quotation-summary.ts';
import '@/ai/flows/summarize-client-interactions.ts';
import '@/ai/flows/suggest-next-action.ts';
