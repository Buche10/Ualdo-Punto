import { Module } from '@nestjs/common';
import { DatabaseModule } from './modules/database/database.module';
import { SriModule } from './modules/sri/sri.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { InvoicesModule } from './modules/invoices/invoices.module';

@Module({
  imports: [DatabaseModule, SriModule, JobsModule, InvoicesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}

