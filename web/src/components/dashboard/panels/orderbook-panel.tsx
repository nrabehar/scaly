import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { useOrderbook } from '@/hooks/use-market-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

function DepthRow({ price, amount, side, maxAmount }: { price: number; amount: number; side: 'bid' | 'ask'; maxAmount: number }) {
  const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
  return (
    <div className="relative flex justify-between items-center py-[2px] text-xs font-mono tabular-nums">
      <div
        className={`absolute inset-y-0 ${side === 'bid' ? 'left-0 bg-buy' : 'right-0 bg-sell'} opacity-15 rounded-sm`}
        style={{ width: `${pct}%` }}
      />
      <span className={side === 'bid' ? 'text-buy' : 'text-sell'}>{Number(price).toFixed(2)}</span>
      <span className="text-muted-foreground">{Number(amount).toFixed(4)}</span>
    </div>
  );
}

export function OrderbookPanel() {
  const { t } = useTranslation();
  const { currentSymbol } = useMarket();
  const { data: obResp } = useOrderbook(currentSymbol);

  const bids: [number, number][] = (obResp as any)?.bids ?? [];
  const asks: [number, number][] = (obResp as any)?.asks ?? [];

  const isCrypto = currentSymbol.includes('BTC') || currentSymbol.includes('ETH');

  if (!isCrypto) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('dashboard.orderbook')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 text-xs text-muted-foreground">
          {t('market.cryptoOnly')}
        </CardContent>
      </Card>
    );
  }

  const maxBidAmt = bids.length > 0 ? Math.max(...bids.map((b) => Number(b[1]))) : 1;
  const maxAskAmt = asks.length > 0 ? Math.max(...asks.map((a) => Number(a[1]))) : 1;
  const maxAmt = Math.max(maxBidAmt, maxAskAmt);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {t('dashboard.orderbook')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          <div className="flex justify-between"><span>Price</span><span>Amount</span></div>
          <div className="flex justify-between"><span>Price</span><span>Amount</span></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Bids */}
          <div className="space-y-[1px]">
            {bids.slice(0, 8).map((b, i) => (
              <DepthRow key={i} price={Number(b[0])} amount={Number(b[1])} side="bid" maxAmount={maxAmt} />
            ))}
          </div>
          {/* Asks */}
          <div className="space-y-[1px]">
            {asks.slice(0, 8).map((a, i) => (
              <DepthRow key={i} price={Number(a[0])} amount={Number(a[1])} side="ask" maxAmount={maxAmt} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
