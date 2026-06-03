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
export * from './types';
export * from './constants';
export * from './validators';
export * from './builders';
export * from './serialize';
//# sourceMappingURL=index.d.ts.map