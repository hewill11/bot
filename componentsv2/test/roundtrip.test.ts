import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MessageV2Builder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  FileBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectBuilder,
  ChannelSelectBuilder,
  SelectOptionBuilder,
  linkButton,
  ButtonStyle,
  SeparatorSpacing,
  ComponentType,
  MessageFlags,
  validateMessage,
  countComponents,
  countTextChars,
  importMessage,
  serializeMessage,
  deserializeMessage,
} from '../src/index';

/** A representative message that exercises every component type. */
function buildSample(): MessageV2Builder {
  return new MessageV2Builder().addComponents(
    new ContainerBuilder()
      .setAccentColor(0xf8e16c)
      .addComponents(
        new SectionBuilder()
          .addText('## Поздравляем всех игроков ZeroWorlds с 1 мая!')
          .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://example.com/flowers.png').setDescription('flowers')),
        new TextDisplayBuilder('@everyone Дамы и господа, от всего сердца...'),
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacing.Large),
        new MediaGalleryBuilder().addItems(
          { url: 'https://example.com/1.png', description: 'one' },
          { url: 'https://example.com/2.png', spoiler: true },
        ),
        new FileBuilder().setURL('attachment://manual.pdf'),
        new ActionRowBuilder().addButtons(
          linkButton('https://shop.example', 'Магазин'),
          linkButton('https://wiki.example', 'Википедия'),
          new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId('sets').setLabel('Наборы'),
        ),
        new ActionRowBuilder().setSelect(
          new StringSelectBuilder()
            .setCustomId('pick')
            .setPlaceholder('Выберите набор')
            .addOptions(
              new SelectOptionBuilder('Level 1', 'l1').setDescription('-10%'),
              new SelectOptionBuilder('Level 2', 'l2').setDescription('-20%'),
            ),
        ),
      ),
  );
}

test('sample message validates cleanly and sets IsComponentsV2 flag', () => {
  const msg = buildSample();
  const payload = msg.toJSON();
  assert.equal((payload.flags & MessageFlags.IsComponentsV2) !== 0, true);
  const res = msg.validate();
  assert.deepEqual(res.errors, []);
  assert.equal(res.ok, true);
});

test('export -> import -> export is stable', () => {
  const original = buildSample().toJSON();
  const reimported = importMessage(original).toJSON();
  assert.deepEqual(reimported, original);
});

test('serialize -> deserialize is stable', () => {
  const msg = buildSample();
  const doc = serializeMessage(msg);
  assert.equal(doc.version, 1);
  const back = deserializeMessage(doc).toJSON();
  assert.deepEqual(back, msg.toJSON());
});

test('serialize via JSON string round-trips', () => {
  const msg = buildSample();
  const str = msg.toString();
  const back = MessageV2Builder.deserialize(str).toJSON();
  assert.deepEqual(back, msg.toJSON());
});

test('top-level component types are correct', () => {
  const container = buildSample().toJSON().components[0];
  assert.equal(container.type, ComponentType.Container);
});

test('countComponents counts nested nodes', () => {
  const payload = buildSample().toJSON();
  // 1 container + (section[1] + 1 text + 1 accessory) + text + separator
  //  + media gallery + file + actionrow(+3 buttons) + actionrow(+1 select)
  const n = countComponents(payload.components);
  assert.equal(n, 14);
});

test('validator: missing IsComponentsV2 flag is an error', () => {
  const res = validateMessage({ flags: 0, components: [new TextDisplayBuilder('hi').toJSON()] });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.path === 'flags'));
});

test('validator: forbidden coexisting fields', () => {
  const res = validateMessage({
    flags: MessageFlags.IsComponentsV2,
    components: [new TextDisplayBuilder('hi').toJSON()],
    // @ts-expect-error intentionally invalid extra field
    content: 'nope',
  });
  assert.ok(res.errors.some((e) => e.path === 'content'));
});

test('validator: link button cannot have custom_id', () => {
  const bad = { type: ComponentType.Button, style: ButtonStyle.Link, url: 'https://x', custom_id: 'oops', label: 'x' };
  const res = validateMessage({
    flags: MessageFlags.IsComponentsV2,
    components: [{ type: ComponentType.ActionRow, components: [bad as any] }],
  });
  assert.ok(res.errors.some((e) => /custom_id/.test(e.message)));
});

test('validator: action row cannot exceed 5 buttons', () => {
  const buttons = Array.from({ length: 6 }, (_, i) =>
    new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`b${i}`).setLabel(`${i}`),
  );
  const row = new ActionRowBuilder().addButtons(...buttons);
  const res = validateMessage({ flags: MessageFlags.IsComponentsV2, components: [row.toJSON()] });
  assert.ok(res.errors.some((e) => /at most 5 buttons/.test(e.message)));
});

test('validator: section requires 1-3 texts and an accessory', () => {
  const section = {
    type: ComponentType.Section,
    components: [],
    accessory: { type: ComponentType.Thumbnail, media: { url: 'https://x/y.png' } },
  };
  const res = validateMessage({ flags: MessageFlags.IsComponentsV2, components: [section as any] });
  assert.ok(res.errors.some((e) => /text displays/.test(e.message)));
});

test('validator: file accessory must use attachment:// scheme', () => {
  const res = validateMessage({
    flags: MessageFlags.IsComponentsV2,
    components: [new FileBuilder().setURL('https://example.com/x.pdf').toJSON()],
  });
  assert.ok(res.errors.some((e) => /attachment:\/\//.test(e.message)));
});

test('validator: 4000-char text budget enforced', () => {
  const big = 'a'.repeat(4001);
  const res = validateMessage({
    flags: MessageFlags.IsComponentsV2,
    components: [new TextDisplayBuilder(big).toJSON()],
  });
  assert.ok(res.errors.some((e) => /text content is/.test(e.message)));
  assert.equal(countTextChars([new TextDisplayBuilder(big).toJSON()]), 4001);
});

test('validator: 40 total components cap enforced', () => {
  const rows = Array.from({ length: 9 }, () =>
    new ActionRowBuilder().addButtons(
      ...Array.from({ length: 5 }, (_, i) =>
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`x${Math.random()}${i}`).setLabel('x'),
      ),
    ).toJSON(),
  ); // 9 rows * (1 + 5) = 54 components
  const res = validateMessage({ flags: MessageFlags.IsComponentsV2, components: rows });
  assert.ok(res.errors.some((e) => /max is 40/.test(e.message)));
});

test('channel select round-trips with channel_types', () => {
  const sel = new ChannelSelectBuilder().setCustomId('ch').setChannelTypes(0, 5).setMaxValues(2);
  const json = sel.toJSON();
  assert.equal(json.type, ComponentType.ChannelSelect);
  assert.deepEqual(json.channel_types, [0, 5]);
  const back = ChannelSelectBuilder.from(json).toJSON();
  assert.deepEqual(back, json);
});

test('button emoji shorthand parses custom emoji', () => {
  const b = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId('e').setEmoji('a:blob:12345').toJSON();
  assert.deepEqual(b.emoji, { animated: true, name: 'blob', id: '12345' });
});

test('unicode emoji shorthand', () => {
  const b = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId('e').setEmoji('🔥').toJSON();
  assert.deepEqual(b.emoji, { name: '🔥' });
});
