import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** PrismaModule: kết nối PostgreSQL dùng chung cho các module (backend-data-design §3). */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
