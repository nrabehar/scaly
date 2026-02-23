import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { KrakenApi } from './kraken.api';

@Module({
  controllers: [PricesController],
  providers: [PricesService, KrakenApi],
})
export class PricesModule {}
