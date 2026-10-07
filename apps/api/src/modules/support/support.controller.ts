import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SupportContactResponse } from "@nadar-kalyanam/schemas";
import type { Env } from "../config/env.schema.js";

// Public: the contact details actually configured (SUPPORT_EMAIL,
// SUPPORT_WHATSAPP_NUMBER). Nothing is made up when they're not set.
@Controller("support")
export class SupportController {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  @Get("contact")
  contact(): SupportContactResponse {
    return {
      email: this.configService.get("SUPPORT_EMAIL", { infer: true }) ?? null,
      whatsappNumber:
        this.configService.get("SUPPORT_WHATSAPP_NUMBER", { infer: true }) ??
        null,
    };
  }
}
