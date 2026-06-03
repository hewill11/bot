"use strict";
/**
 * Discord Components V2 (Display Components) constructor — public API.
 *
 * A framework-agnostic core for building, validating, serializing and
 * round-tripping Components V2 messages. No EmbedBuilder, no legacy components —
 * uses only the modern display-component API and the IsComponentsV2 flag.
 *
 * --------------------------------------------------------------------------
 * Quick start
 * --------------------------------------------------------------------------
 *
 *   import {
 *     MessageV2Builder, ContainerBuilder, TextDisplayBuilder, SectionBuilder,
 *     ThumbnailBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder,
 *     linkButton, ButtonStyle, SeparatorSpacing,
 *   } from './componentsv2/src';
 *
 *   const msg = new MessageV2Builder().addComponents(
 *     new ContainerBuilder()
 *       .setAccentColor(0xF8E16C)
 *       .addComponents(
 *         new SectionBuilder()
 *           .addText('## Поздравляем всех игроков ZeroWorlds с 1 мая!')
 *           .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://.../flowers.png')),
 *         new TextDisplayBuilder('@everyone Дамы и господа, от всего сердца...'),
 *         new SeparatorBuilder().setSpacing(SeparatorSpacing.Large),
 *         new ActionRowBuilder().addButtons(
 *           linkButton('https://shop.example', 'Магазин'),
 *           linkButton('https://wiki.example', 'Википедия'),
 *           linkButton('https://sets.example', 'Наборы'),
 *         ),
 *       ),
 *   );
 *
 *   const result = msg.validate();           // { ok, errors, warnings }
 *   if (result.ok) await channel.send(msg.toDiscordPayload());
 *
 *   // Persist a draft, then reload & edit later:
 *   const doc = msg.serialize();             // plain JSON
 *   const again = MessageV2Builder.deserialize(doc);
 *
 *   // Import an existing message you fetched from Discord:
 *   const editable = MessageV2Builder.fromAPI(fetchedMessage);
 *
 * --------------------------------------------------------------------------
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./types"), exports);
__exportStar(require("./constants"), exports);
__exportStar(require("./validators"), exports);
__exportStar(require("./builders"), exports);
__exportStar(require("./serialize"), exports);
//# sourceMappingURL=index.js.map