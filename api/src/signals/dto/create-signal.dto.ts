import {
    IsString,
    IsOptional,
    IsNumber,
    IsIn,
    IsObject,
} from 'class-validator';

export class CreateSignalDto {
    @IsString()
    symbol: string;

    @IsString()
    @IsIn(['BUY', 'SELL', 'HOLD'])
    signal: string;

    @IsOptional()
    @IsString()
    provider?: string;

    @IsOptional()
    @IsNumber()
    score?: number;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
