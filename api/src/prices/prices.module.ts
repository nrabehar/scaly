import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { KrakenApi } from './kraken.api';
import { TradingViewApi } from './tradingview.api';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [PricesController],
  providers: [PricesService, KrakenApi, TradingViewApi],
})
export class PricesModule {}
