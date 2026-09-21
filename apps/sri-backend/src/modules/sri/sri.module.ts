import { Module } from '@nestjs/common';
import { AccessKeyService } from './access-key.service';
import { XmlBuilderService } from './xml-builder.service';
import { XmlSignerService } from './xml-signer.service';
import { SriSoapClientService } from './sri-soap-client.service';
import { RideGeneratorService } from './ride-generator.service';
import { SriMailerService } from './sri-mailer.service';

@Module({
  providers: [
    AccessKeyService,
    XmlBuilderService,
    XmlSignerService,
    SriSoapClientService,
    RideGeneratorService,
    SriMailerService,
  ],
  exports: [
    AccessKeyService,
    XmlBuilderService,
    XmlSignerService,
    SriSoapClientService,
    RideGeneratorService,
    SriMailerService,
  ],
})
export class SriModule {}
