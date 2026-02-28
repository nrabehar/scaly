import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useInstruments, usePrice } from '@/hooks/use-market-data';
import { useSocket } from '@/hooks/use-socket';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { SymbolType, TimeframeType } from '@/types/market';

const TIMEFRAMES: { value: TimeframeType; label: string }[] = [
  { value: '1min', label: '1m' },
  { value: '5min', label: '5m' },
  { value: '15min', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
];

export function InstrumentSelector() {
  const { t } = useTranslation();
  const { currentSymbol, setCurrentSymbol, currentTimeframe, setCurrentTimeframe } = useMarket();
  const { data: instrumentsResp } = useInstruments();
  const { data: price } = usePrice(currentSymbol);
  const { status } = useSocket(currentSymbol);

  const instruments = instrumentsResp?.instruments ?? [];

  const statusColor =
    status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Symbol selector */}
      <Select value={currentSymbol} onValueChange={(v) => setCurrentSymbol(v as SymbolType)}>
        <SelectTrigger className="w-[140px] h-8 text-sm font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(instruments ?? []).map((inst) => (
            <SelectItem key={inst.symbol} value={inst.symbol}>
              {inst.symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Timeframe selector */}
      <Select value={currentTimeframe} onValueChange={(v) => setCurrentTimeframe(v as TimeframeType)}>
        <SelectTrigger className="w-[80px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIMEFRAMES.map((tf) => (
            <SelectItem key={tf.value} value={tf.value}>
              {tf.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Live price */}
      {price && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tabular-nums">
            {price.price?.toFixed(2)}
          </span>
          {price.bid != null && price.ask != null && (
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {price.bid.toFixed(2)} / {price.ask.toFixed(2)}
            </span>
          )}
          <Badge variant="outline" className="text-[10px] h-5">
            {price.source ?? 'api'}
          </Badge>
        </div>
      )}

      {/* WS status */}
      <div className="flex items-center gap-1.5 ml-auto">
        <div className={`w-2 h-2 rounded-full ${statusColor}`} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {status === 'connected' ? t('common.live') : status}
        </span>
      </div>
    </div>
  );
}
