import { IsString, IsOptional } from 'class-validator';

export class AiSignalDto {
  @IsString()
  symbol: string;

  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  model?: string;
}
