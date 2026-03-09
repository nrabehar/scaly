import { Injectable, Logger } from '@nestjs/common';
import { GroqAgent } from './groq.agent';
import { AiService } from '../ai/ai.service';

export type AgentTask =
    | 'market-analysis'
    | 'risk-assessment'
    | 'signal-validate'
    | 'news-impact';

export interface AgentTaskResult {
    task: AgentTask;
    model: string;
    output: Record<string, unknown> | null;
    raw: string | null;
    success: boolean;
}

// Typed prompt builders per task
const buildPrompt = {
    'market-analysis': (ctx: Record<string, unknown>) =>
        `You are a professional quantitative trading analyst.\n\nAnalyze the following market context and return a JSON object with fields:\n{ "bias": "BULLISH|BEARISH|NEUTRAL", "confidence": 0-100, "reasons": [string], "keyLevels": { "support": number|null, "resistance": number|null }, "summary": string }\n\nContext:\n${JSON.stringify(ctx, null, 2)}\n\nRespond with raw JSON only.`,

    'risk-assessment': (ctx: Record<string, unknown>) =>
        `You are a risk manager for a trading desk.\n\nGiven the following trade plan, return a JSON object with fields:\n{ "approved": boolean, "riskScore": 0-100, "warnings": [string], "maxLotSuggestion": number|null, "adjustedSL": number|null, "adjustedTP": number|null }\n\nTrade context:\n${JSON.stringify(ctx, null, 2)}\n\nRespond with raw JSON only.`,

    'signal-validate': (ctx: Record<string, unknown>) =>
        `You are an ICT/SMC trading expert.\n\nValidate the following algorithmic signal and return a JSON object:\n{ "valid": boolean, "conviction": "HIGH|MEDIUM|LOW|CONFLICT", "supportingFactors": [string], "conflictingFactors": [string], "revisedConfidence": 0-100 }\n\nSignal data:\n${JSON.stringify(ctx, null, 2)}\n\nRespond with raw JSON only.`,

    'news-impact': (ctx: Record<string, unknown>) =>
        `You are a macro economist and news analyst.\n\nAssess the market impact of the following news items and return a JSON object:\n{ "impact": "HIGH|MEDIUM|LOW", "direction": "BULLISH|BEARISH|NEUTRAL", "affectedSymbols": [string], "summary": string, "recommendation": string }\n\nNews:\n${JSON.stringify(ctx, null, 2)}\n\nRespond with raw JSON only.`,
};

@Injectable()
export class AgentsService {
    private readonly logger = new Logger(AgentsService.name);

    constructor(
        private readonly grok: GroqAgent,
        private readonly ai: AiService,
    ) {}

    /** Legacy single-prompt call — kept for backward compatibility. */
    async askAgent(prompt: string) {
        return this.grok.call(prompt);
    }

    /**
     * Run a typed AI agent task.
     * Uses the multi-provider AiService with structured prompts per task type.
     */
    async runTask(
        task: AgentTask,
        context: Record<string, unknown>,
        model = 'auto',
    ): Promise<AgentTaskResult> {
        const promptFn = buildPrompt[task];
        if (!promptFn) {
            this.logger.warn(`Unknown agent task: ${task}`);
            return {
                task,
                model: 'none',
                output: null,
                raw: null,
                success: false,
            };
        }

        const prompt = promptFn(context);
        this.logger.debug(`AgentTask[${task}] model=${model}`);

        const res = await this.ai.callAI(prompt, model);
        if (!res?.success) {
            return {
                task,
                model: 'none',
                output: null,
                raw: null,
                success: false,
            };
        }

        return {
            task,
            model: res.model ?? 'unknown',
            output: res.result?.signal ?? null,
            raw: typeof res.result?.raw === 'string' ? res.result.raw : null,
            success: true,
        };
    }
}
