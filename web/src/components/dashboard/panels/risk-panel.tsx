/**
 * RiskPanel — live position sizer / risk calculator.
 *
 * Computes risk $, reward $, risk %, R:R and suggested 2% lot size
 * from live bid/ask and user-configurable inputs.
 *
 * Inspired by MiniRiskPanel from ari-trading-bot/xauusd-analyzer-v2,
 * adapted to use the scaly shadcn/ui + Tailwind design system.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarket } from '@/contexts/market.context';
import { usePrice } from '@/hooks/use-market-data';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Calculator } from 'lucide-react';
import { getSymbolDecimals, getPointSize } from '@/lib/priceFormat';

function toN(s: string, fallback: number) {
	const n = parseFloat(s.replace(',', '.'));
	return isFinite(n) ? n : fallback;
}
function round(symbol: string, v: number) {
	return parseFloat(v.toFixed(getSymbolDecimals(symbol)));
}
function inferUsdPerPoint(symbol: string, lot: number) {
	const s = symbol.toUpperCase();
	const base =
		s.includes('XAU') || s.includes('XAG') || s.includes('WTI')
			? 0.1
			: s.includes('JPY')
				? 0.09
				: s.includes('BTC') ||
					  s.includes('ETH') ||
					  s.includes('SOL')
					? 0.12
					: 0.1;
	return base * (lot / 0.01);
}
const fmt = (v: number, prefix = '$') => `${prefix}${v.toFixed(2)}`;

export function RiskPanel() {
	const { t } = useTranslation();
	const { currentSymbol } = useMarket();
	const { data: price } = usePrice(currentSymbol);

	const [accountInput, setAccountInput] = useState('1000');
	const [lotInput, setLotInput] = useState('0.01');
	const [spreadInput, setSpreadInput] = useState('10');
	const [slInput, setSlInput] = useState('25');
	const [tpInput, setTpInput] = useState('50');

	const model = useMemo(() => {
		const account = Math.max(100, toN(accountInput, 1000));
		const lot = Math.max(0.001, toN(lotInput, 0.01));
		const spread = Math.max(0, toN(spreadInput, 10));
		const sl = Math.max(1, toN(slInput, 25));
		const tp = Math.max(1, toN(tpInput, 50));
		const usdPerPt = inferUsdPerPoint(currentSymbol, lot);
		const riskUsd = (sl + spread) * usdPerPt;
		const rewardUsd = Math.max(0, tp - spread) * usdPerPt;
		const riskPct = (riskUsd / account) * 100;
		const rewardPct = (rewardUsd / account) * 100;
		const rr = riskUsd > 0 ? rewardUsd / riskUsd : 0;
		const twoPctLot =
			(account * 0.02) /
			Math.max(0.0001, ((sl + spread) * usdPerPt) / lot);

		const pt = getPointSize(currentSymbol);
		const bid = price?.bid ?? 0;
		const ask = price?.ask ?? 0;
		const ref = price?.price ?? 0;
		const buyEntry = ask > 0 ? ask : ref;
		const sellEntry = bid > 0 ? bid : ref;

		const buy = {
			entry: round(currentSymbol, buyEntry),
			sl: round(currentSymbol, buyEntry - sl * pt),
			tp: round(currentSymbol, buyEntry + tp * pt),
		};
		const sell = {
			entry: round(currentSymbol, sellEntry),
			sl: round(currentSymbol, sellEntry + sl * pt),
			tp: round(currentSymbol, sellEntry - tp * pt),
		};

		return {
			account,
			lot,
			spread,
			sl,
			tp,
			usdPerPt,
			riskUsd,
			rewardUsd,
			riskPct,
			rewardPct,
			rr,
			twoPctLot,
			buy,
			sell,
		};
	}, [
		currentSymbol,
		price,
		accountInput,
		lotInput,
		spreadInput,
		slInput,
		tpInput,
	]);

	const riskColor =
		model.riskPct <= 1
			? 'text-buy'
			: model.riskPct <= 2
				? 'text-yellow-400'
				: 'text-sell';

	const Input = ({
		label,
		value,
		onChange,
		step = '1',
	}: {
		label: string;
		value: string;
		onChange: (v: string) => void;
		step?: string;
	}) => (
		<div className="flex flex-col gap-0.5">
			<span className="text-[9px] text-muted-foreground uppercase tracking-wide">
				{label}
			</span>
			<input
				type="number"
				step={step}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono text-right focus:outline-none focus:ring-1 focus:ring-ring"
			/>
		</div>
	);

	return (
		<Card>
			<CardHeader className="pb-2 pt-3 px-4">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Calculator className="h-4 w-4" />
					{t('dashboard.riskPanel', 'Risk / Position')}
					{/* R:R badge */}
					<span
						className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded ${
							model.rr >= 2
								? 'bg-buy/15 text-buy'
								: model.rr >= 1.2
									? 'bg-yellow-400/15 text-yellow-400'
									: 'bg-sell/15 text-sell'
						}`}
					>
						R:R {model.rr.toFixed(2)}
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-3 space-y-3">
				{/* Inputs grid */}
				<div className="grid grid-cols-2 gap-2">
					<Input
						label="Account ($)"
						value={accountInput}
						onChange={setAccountInput}
						step="100"
					/>
					<Input
						label="Lot size"
						value={lotInput}
						onChange={setLotInput}
						step="0.01"
					/>
					<Input
						label="Spread (pts)"
						value={spreadInput}
						onChange={setSpreadInput}
					/>
					<Input
						label="SL (pts)"
						value={slInput}
						onChange={setSlInput}
					/>
					<Input
						label="TP (pts)"
						value={tpInput}
						onChange={setTpInput}
					/>
					<div className="flex flex-col gap-0.5">
						<span className="text-[9px] text-muted-foreground uppercase tracking-wide">
							2% Risk lot
						</span>
						<span className="text-[11px] font-mono text-right text-buy font-bold pt-1">
							{model.twoPctLot.toFixed(3)}
						</span>
					</div>
				</div>

				{/* Stats row */}
				<div className="grid grid-cols-3 gap-2">
					{[
						{
							label: 'Risk $',
							value: fmt(model.riskUsd),
							color: riskColor,
						},
						{
							label: 'Reward $',
							value: fmt(model.rewardUsd),
							color: 'text-buy',
						},
						{
							label: 'Risk %',
							value: `${model.riskPct.toFixed(2)}%`,
							color: riskColor,
						},
					].map((s) => (
						<div
							key={s.label}
							className="flex flex-col items-center rounded bg-muted/40 p-1.5"
						>
							<span className="text-[9px] text-muted-foreground">
								{s.label}
							</span>
							<span
								className={`text-xs font-bold font-mono ${s.color}`}
							>
								{s.value}
							</span>
						</div>
					))}
				</div>

				{/* BUY / SELL level previews */}
				<div className="grid grid-cols-2 gap-2 text-[10px]">
					{/* BUY */}
					<div className="rounded border border-buy/30 bg-buy/5 p-2 space-y-0.5">
						<div className="text-[9px] font-bold text-buy mb-1">
							↑ BUY
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								Entry
							</span>
							<span className="font-mono">
								{model.buy.entry || '—'}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								SL
							</span>
							<span className="font-mono text-sell">
								{model.buy.sl || '—'}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								TP
							</span>
							<span className="font-mono text-buy">
								{model.buy.tp || '—'}
							</span>
						</div>
					</div>
					{/* SELL */}
					<div className="rounded border border-sell/30 bg-sell/5 p-2 space-y-0.5">
						<div className="text-[9px] font-bold text-sell mb-1">
							↓ SELL
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								Entry
							</span>
							<span className="font-mono">
								{model.sell.entry || '—'}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								SL
							</span>
							<span className="font-mono text-sell">
								{model.sell.sl || '—'}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								TP
							</span>
							<span className="font-mono text-buy">
								{model.sell.tp || '—'}
							</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
