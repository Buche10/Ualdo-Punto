import { Module } from '@nestjs/common';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';
import { SriModule } from '../sri/sri.module';
import { JobsModule } from '../jobs/jobs.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [SriModule, DatabaseModule, JobsModule],
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
