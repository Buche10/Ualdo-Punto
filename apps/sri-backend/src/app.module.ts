import { Module } from '@nestjs/common';
import { SriModule } from './modules/sri/sri.module';
import { InvoicesModule } from './modules/invoices/invoices.module';

@Module({
  imports: [SriModule, InvoicesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
