import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useAiSignal, useScalp3m, useHistory } from '@/hooks/use-market-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Zap, Brain } from 'lucide-react';

const AI_MODELS = ['gemini', 'groq', 'openrouter', 'ollama'] as const;

export function AiSignalPanel() {
  const { t } = useTranslation();
  const { currentSymbol, currentTimeframe, selectedAiModel, setSelectedAiModel } = useMarket();
  const { data: historyResp } = useHistory(currentSymbol, '1min', 200);
  const candles = (historyResp as any)?.data ?? historyResp ?? [];

  const aiSignal = useAiSignal();
  const scalp3m = useScalp3m();
  const [lastAi, setLastAi] = useState<any>(null);
  const [lastScalp, setLastScalp] = useState<any>(null);

  const buildPrompt = () => {
    const last20 = candles.slice(-20);
    const rows = last20.map((c: any) => `O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume ?? 0}`);
    return `Analyze ${currentSymbol} on ${currentTimeframe}. Last 20 candles:\n${rows.join('\n')}\nProvide: side (BUY/SELL/HOLD), entryPrice, stopLoss, takeProfit, confidence (0-100), reasoning.`;
  };

  const handleAnalyze = async () => {
    try {
      const result = await aiSignal.mutateAsync({
        symbol: currentSymbol,
        prompt: buildPrompt(),
        model: selectedAiModel,
      });
      setLastAi(result);
    } catch { /* silently fail */ }
  };

  const handleScalp = async () => {
    try {
      const result = await scalp3m.mutateAsync({
        symbol: currentSymbol,
        candles,
      });
      setLastScalp(result);
    } catch { /* silently fail */ }
  };

  const signalColor = (side?: string) => {
    if (!side) return 'text-muted-foreground';
    const s = side.toUpperCase();
    return s === 'BUY' || s === 'LONG' ? 'text-buy' : s === 'SELL' || s === 'SHORT' ? 'text-sell' : 'text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4" />
          {t('dashboard.aiSignal')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-3">
        {/* Model selector */}
        <div className="flex items-center gap-2">
          <Select value={selectedAiModel} onValueChange={(v) => setSelectedAiModel(v as any)}>
            <SelectTrigger className="h-7 text-xs w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1"
            onClick={handleAnalyze}
            disabled={aiSignal.isPending}
          >
            {aiSignal.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
            {t('signals.analyze')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={handleScalp}
            disabled={scalp3m.isPending}
          >
            {scalp3m.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Scalp 3m
          </Button>
        </div>

        {/* AI Result */}
        {lastAi && (() => {
          const p = lastAi.parsed ?? lastAi;
          const side = p.side ?? p.signal ?? null;
          const entry = p.entryPrice ?? p.entry ?? null;
          const tp = p.takeProfit ?? p.tp ?? null;
          const sl = p.stopLoss ?? p.sl ?? null;
          const conf = p.confidence ?? null;
          const reasoning = p.reasoning ?? p.reason ?? lastAi.reason ?? null;
		  console.log('AI Signal:', { side, entry, tp, sl, conf, reasoning });
          return (
            <div className="rounded-md border p-2 space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className={`font-bold text-sm ${signalColor(side)}`}>
                  {side ?? 'N/A'}
                </span>
                {conf != null && (
                  <Badge variant="outline" className="text-[10px]">
                    {conf}%
                  </Badge>
                )}
              </div>
              {lastAi.model && (
                <div className="text-[10px] text-muted-foreground">Model: {lastAi.model}</div>
              )}
              {entry != null && (
                <div className="grid grid-cols-3 gap-1 font-mono tabular-nums">
                  <span>E: {entry}</span>
                  <span className="text-buy">TP: {tp ?? '—'}</span>
                  <span className="text-sell">SL: {sl ?? '—'}</span>
                </div>
              )}
              {reasoning && (
                <p className="text-muted-foreground leading-snug">{reasoning}</p>
              )}
            </div>
          );
        })()}

        {/* Scalp Result */}
        {lastScalp && (() => {
          const p = lastScalp.prediction ?? lastScalp;
          const side = p.side ?? null;
          const entry = p.entry ?? null;
          const tp = p.tp ?? null;
          const sl = p.sl ?? null;
          const conf = p.confidence ?? null;
          const reasons = p.reasons ?? [];
          return (
            <div className="rounded-md border p-2 space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Scalp 3m</span>
                <span className={`font-bold ${signalColor(side)}`}>
                  {side ?? '—'}
                </span>
              </div>
              {entry != null && (
                <div className="grid grid-cols-3 gap-1 font-mono tabular-nums">
                  <span>E: {entry}</span>
                  <span className="text-buy">TP: {tp ?? '—'}</span>
                  <span className="text-sell">SL: {sl ?? '—'}</span>
                </div>
              )}
              {conf != null && (
                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${conf}%` }}
                  />
                </div>
              )}
              {reasons.length > 0 && (
                <ul className="text-muted-foreground space-y-0.5 mt-1">
                  {reasons.slice(0, 5).map((r: string, i: number) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
