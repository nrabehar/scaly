import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateSignalDto {
  @IsString()
  symbol: string;

  @IsString()
  signal: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  metadata?: any;
}
