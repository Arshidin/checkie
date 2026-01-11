import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbedType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmbedDto, UpdateEmbedDto } from './dto';

@Injectable()
export class EmbedsService {
  private readonly widgetUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.widgetUrl = this.config.get('WIDGET_URL') || 'https://checkout.checkie.io';
  }

  async create(pageId: string, dto: CreateEmbedDto) {
    // Verify page exists
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { store: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Generate embed code
    const embedCode = this.generateEmbedCode(
      dto.type,
      page.store.slug,
      page.slug,
      dto.settings,
    );

    return this.prisma.pageEmbed.create({
      data: {
        pageId,
        type: dto.type,
        embedCode,
        settings: (dto.settings as Record<string, any>) || {},
      },
    });
  }

  async findAllByPage(pageId: string) {
    return this.prisma.pageEmbed.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(pageId: string, embedId: string) {
    const embed = await this.prisma.pageEmbed.findFirst({
      where: { id: embedId, pageId },
    });

    if (!embed) {
      throw new NotFoundException('Embed not found');
    }

    return embed;
  }

  async update(pageId: string, embedId: string, dto: UpdateEmbedDto) {
    const embed = await this.prisma.pageEmbed.findFirst({
      where: { id: embedId, pageId },
      include: { page: { include: { store: true } } },
    });

    if (!embed) {
      throw new NotFoundException('Embed not found');
    }

    // Regenerate embed code if type or settings changed
    const newType = dto.type || embed.type;
    const newSettings = dto.settings || (embed.settings as Record<string, any>);

    const embedCode = this.generateEmbedCode(
      newType,
      embed.page.store.slug,
      embed.page.slug,
      newSettings,
    );

    return this.prisma.pageEmbed.update({
      where: { id: embedId },
      data: {
        type: dto.type,
        settings: (dto.settings as Record<string, any>) || undefined,
        embedCode,
      },
    });
  }

  async delete(pageId: string, embedId: string) {
    const embed = await this.prisma.pageEmbed.findFirst({
      where: { id: embedId, pageId },
    });

    if (!embed) {
      throw new NotFoundException('Embed not found');
    }

    await this.prisma.pageEmbed.delete({
      where: { id: embedId },
    });

    return { message: 'Embed deleted successfully' };
  }

  async getEmbedCode(pageId: string, embedId: string) {
    const embed = await this.prisma.pageEmbed.findFirst({
      where: { id: embedId, pageId },
      include: { page: { include: { store: true } } },
    });

    if (!embed) {
      throw new NotFoundException('Embed not found');
    }

    return {
      type: embed.type,
      embedCode: embed.embedCode,
      settings: embed.settings,
    };
  }

  async regenerateCode(pageId: string, embedId: string) {
    const embed = await this.prisma.pageEmbed.findFirst({
      where: { id: embedId, pageId },
      include: { page: { include: { store: true } } },
    });

    if (!embed) {
      throw new NotFoundException('Embed not found');
    }

    const embedCode = this.generateEmbedCode(
      embed.type,
      embed.page.store.slug,
      embed.page.slug,
      embed.settings as Record<string, any>,
    );

    return this.prisma.pageEmbed.update({
      where: { id: embedId },
      data: { embedCode },
    });
  }

  private generateEmbedCode(
    type: EmbedType,
    storeSlug: string,
    pageSlug: string,
    settings?: Record<string, any>,
  ): string {
    const checkoutUrl = `${this.widgetUrl}/${storeSlug}/${pageSlug}`;
    const s = settings || {};

    switch (type) {
      case EmbedType.STANDALONE:
        return `<a href="${checkoutUrl}" target="_blank" rel="noopener">${s.buttonText || 'Buy Now'}</a>`;

      case EmbedType.IFRAME:
        return `<iframe
  src="${checkoutUrl}?embed=true"
  width="${s.width || '100%'}"
  height="${s.height || '600px'}"
  frameborder="0"
  style="border-radius: ${s.borderRadius || '8px'}; ${s.showBorder ? 'border: 1px solid #e0e0e0;' : 'border: none;'}"
  allow="payment">
</iframe>`;

      case EmbedType.POPUP:
        return `<script src="${this.widgetUrl}/embed.js"></script>
<button
  class="checkie-popup-trigger"
  data-checkout-url="${checkoutUrl}"
  style="background-color: ${s.buttonColor || '#ee5a29'}; color: ${s.buttonTextColor || '#ffffff'}; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
  ${s.buttonText || 'Buy Now'}
</button>`;

      case EmbedType.BUTTON:
        return `<a
  href="${checkoutUrl}"
  target="_blank"
  rel="noopener"
  style="display: inline-block; background-color: ${s.buttonColor || '#ee5a29'}; color: ${s.buttonTextColor || '#ffffff'}; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
  ${s.buttonText || 'Buy Now'}
</a>`;

      case EmbedType.QR_CODE:
        const qrSize = s.qrSize || 256;
        const qrFg = encodeURIComponent(s.qrForeground || '#000000');
        const qrBg = encodeURIComponent(s.qrBackground || '#ffffff');
        // Using a QR code API
        return `<img
  src="https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(checkoutUrl)}&color=${qrFg.slice(1)}&bgcolor=${qrBg.slice(1)}"
  alt="Checkout QR Code"
  width="${qrSize}"
  height="${qrSize}"
/>`;

      default:
        return `<a href="${checkoutUrl}" target="_blank" rel="noopener">Checkout</a>`;
    }
  }
}
