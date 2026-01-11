import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { VariantsController } from './variants/variants.controller';
import { VariantsService } from './variants/variants.service';
import { CustomFieldsController } from './custom-fields/custom-fields.controller';
import { CustomFieldsService } from './custom-fields/custom-fields.service';
import { EmbedsController } from './embeds/embeds.controller';
import { EmbedsService } from './embeds/embeds.service';
import { PageStatsService } from './page-stats.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PagesController,
    VariantsController,
    CustomFieldsController,
    EmbedsController,
  ],
  providers: [
    PagesService,
    VariantsService,
    CustomFieldsService,
    EmbedsService,
    PageStatsService,
  ],
  exports: [PagesService, PageStatsService],
})
export class PagesModule {}
