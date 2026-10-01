import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './modules/database/database.module';
import { SriModule } from './modules/sri/sri.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { SalesModule } from './modules/sales/sales.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CreditNotesModule } from './modules/credit-notes/credit-notes.module';
import { AuthModule } from './modules/auth/auth.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import * as fs from 'fs';
import * as path from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';

function getServeStaticRoot(): string | null {
  const candidates = [
    process.env.SERVE_STATIC_ROOT_PATH,
    '/app/public',
    path.resolve(process.cwd(), 'public'),
  ].filter(Boolean) as string[];

  return (
    candidates.find((dir) => {
      try {
        return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
      } catch {
        return false;
      }
    }) || null
  );
}

@Module({
  controllers: [AppController],
  imports: [
    ServeStaticModule.forRootAsync({
      useFactory: () => {
        const rootPath = getServeStaticRoot();
        if (!rootPath) {
          return [];
        }
        return [
          {
            rootPath,
            exclude: ['/api{*path}'],
          },
        ];
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    DatabaseModule,
    SriModule,
    JobsModule,
    InvoicesModule,
    SalesModule,
    CustomersModule,
    CreditNotesModule,
    AuthModule,
    InventoryModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
