import { Module } from '@nestjs/common';
import { SriModule } from '../sri/sri.module';
import { DatabaseModule } from '../database/database.module';
import { SriQueueProcessor } from './sri-queue.processor';
import { SriComprobanteRepository } from './sri-comprobante.repository';
import { SriQueueWorker } from './sri-queue.worker';
import { SriSoapClientService } from '../sri/sri-soap-client.service';
import { SriMailerService } from '../sri/sri-mailer.service';
import { RideGeneratorService } from '../sri/ride-generator.service';

@Module({
  imports: [SriModule, DatabaseModule],
  providers: [
    SriComprobanteRepository,
    {
      provide: SriQueueProcessor,
      useFactory: (
        soapClient: SriSoapClientService,
        repo: SriComprobanteRepository,
        mailer: SriMailerService,
        rideGen: RideGeneratorService,
      ) => {
        return new SriQueueProcessor(soapClient, repo, mailer, rideGen);
      },
      inject: [SriSoapClientService, SriComprobanteRepository, SriMailerService, RideGeneratorService],
    },
    SriQueueWorker,
  ],
  exports: [SriComprobanteRepository, SriQueueProcessor, SriQueueWorker],
})
export class JobsModule {}
