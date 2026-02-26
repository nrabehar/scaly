import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { KrakenApi } from './kraken.api';
import { TradingViewApi } from './tradingview.api';
import { HttpModule } from '@nestjs/axios';
import { YahooFinanceApi } from './yahoo-finance.api';
import { SimulationService } from './simulation.service';
import { OrderbookService } from '../orderbook/orderbook.service';

@Module({
  imports: [HttpModule],
  controllers: [PricesController],
  providers: [
    PricesService,
    KrakenApi,
    TradingViewApi,
    YahooFinanceApi,
    SimulationService,
    OrderbookService,
  ],
  exports: [PricesService, SimulationService, OrderbookService],
})
export class PricesModule {}
