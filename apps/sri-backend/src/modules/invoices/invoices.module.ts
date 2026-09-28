import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesReconciliationService } from './invoices-reconciliation.service';
import { SriModule } from '../sri/sri.module';
import { JobsModule } from '../jobs/jobs.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [SriModule, DatabaseModule, JobsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesReconciliationService],
  exports: [InvoicesService, InvoicesReconciliationService],
})
export class InvoicesModule {}

