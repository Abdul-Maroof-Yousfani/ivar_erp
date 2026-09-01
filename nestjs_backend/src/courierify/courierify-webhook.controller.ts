import {
  Controller,
  Post,
  Req,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { CourierifyService } from './courierify.service';
import { CourierifyWebhookEnvelope } from './interfaces/courierify.interface';

@ApiTags('Courierify Webhook')
@Controller('courierify')
export class CourierifyWebhookController {
  private readonly logger = new Logger(CourierifyWebhookController.name);

  constructor(private readonly courierifyService: CourierifyService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Courierify inbound webhook receiver' })
  async handleWebhook(
    @Req() req: any,
    @Headers('x-courierify-signature') signature?: string,
    @Headers('x-courierify-timestamp') timestamp?: string,
    @Headers('x-courierify-topic') topic?: string,
    @Headers('x-courierify-event-id') eventIdHeader?: string,
  ) {
    // Extract raw body or string body for HMAC calculation
    let rawBody: string | Buffer = '';
    if ((req as any).rawBody) {
      rawBody = (req as any).rawBody;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body || {});
    }

    // Verify HMAC signature and timestamp freshness (5 min window)
    const isValid = this.courierifyService.verifyWebhookSignature(
      signature,
      timestamp,
      rawBody,
    );

    if (!isValid) {
      this.logger.warn(
        `[Courierify Webhook Rejected] Invalid signature or expired timestamp. Signature=${signature}, Timestamp=${timestamp}`,
      );
      throw new UnauthorizedException({
        error: 'Invalid signature or expired timestamp',
        errorType: 'invalid_signature',
      });
    }

    const payload: CourierifyWebhookEnvelope =
      typeof req.body === 'object' && req.body !== null
        ? req.body
        : JSON.parse(rawBody.toString('utf8'));

    const eventId = payload.eventId || eventIdHeader;
    const eventTopic = payload.topic || topic;

    this.logger.log(
      `[Courierify Webhook Received] Topic: ${eventTopic}, EventId: ${eventId}`,
    );

    // Process event asynchronously in background so response returns within 10s requirement
    setImmediate(() => {
      this.courierifyService.handleWebhook(payload).catch((err) => {
        this.logger.error(
          `Error executing async webhook processing for event ${eventId}: ${err.message}`,
        );
      });
    });

    return {
      status: 'success',
      eventId,
      receivedAt: new Date().toISOString(),
    };
  }
}
