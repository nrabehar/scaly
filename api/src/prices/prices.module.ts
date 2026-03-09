import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { KrakenApi } from './kraken.api';
import { TradingViewApi } from './tradingview.api';
import { HttpModule } from '@nestjs/axios';
import { YahooFinanceApi } from './yahoo-finance.api';
import { OrderbookService } from '../orderbook/orderbook.service';

@Module({
    imports: [HttpModule],
    controllers: [PricesController],
    providers: [
        PricesService,
        KrakenApi,
        TradingViewApi,
        YahooFinanceApi,
        OrderbookService,
    ],
    exports: [PricesService, OrderbookService],
})
export class PricesModule {}
