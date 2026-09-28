import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { EmitirNotaCreditoDto } from './credit-notes.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { createSuccessResponse } from '@pharmastock/shared';

@Controller('credit-notes')
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Post('emitir')
  @UseGuards(ApiKeyGuard)
  public async emitirNotaCredito(@Body() dto: EmitirNotaCreditoDto) {
    const notaCredito = await this.creditNotesService.emitirNotaCredito(dto);
    return createSuccessResponse(notaCredito);
  }
}
