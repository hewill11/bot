"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../src/index");
/** A representative message that exercises every component type. */
function buildSample() {
    return new index_1.MessageV2Builder().addComponents(new index_1.ContainerBuilder()
        .setAccentColor(0xf8e16c)
        .addComponents(new index_1.SectionBuilder()
        .addText('## Поздравляем всех игроков ZeroWorlds с 1 мая!')
        .setThumbnailAccessory(new index_1.ThumbnailBuilder().setURL('https://example.com/flowers.png').setDescription('flowers')), new index_1.TextDisplayBuilder('@everyone Дамы и господа, от всего сердца...'), new index_1.SeparatorBuilder().setDivider(true).setSpacing(index_1.SeparatorSpacing.Large), new index_1.MediaGalleryBuilder().addItems({ url: 'https://example.com/1.png', description: 'one' }, { url: 'https://example.com/2.png', spoiler: true }), new index_1.FileBuilder().setURL('attachment://manual.pdf'), new index_1.ActionRowBuilder().addButtons((0, index_1.linkButton)('https://shop.example', 'Магазин'), (0, index_1.linkButton)('https://wiki.example', 'Википедия'), new index_1.ButtonBuilder().setStyle(index_1.ButtonStyle.Primary).setCustomId('sets').setLabel('Наборы')), new index_1.ActionRowBuilder().setSelect(new index_1.StringSelectBuilder()
        .setCustomId('pick')
        .setPlaceholder('Выберите набор')
        .addOptions(new index_1.SelectOptionBuilder('Level 1', 'l1').setDescription('-10%'), new index_1.SelectOptionBuilder('Level 2', 'l2').setDescription('-20%')))));
}
(0, node_test_1.test)('sample message validates cleanly and sets IsComponentsV2 flag', () => {
    const msg = buildSample();
    const payload = msg.toJSON();
    strict_1.default.equal((payload.flags & index_1.MessageFlags.IsComponentsV2) !== 0, true);
    const res = msg.validate();
    strict_1.default.deepEqual(res.errors, []);
    strict_1.default.equal(res.ok, true);
});
(0, node_test_1.test)('export -> import -> export is stable', () => {
    const original = buildSample().toJSON();
    const reimported = (0, index_1.importMessage)(original).toJSON();
    strict_1.default.deepEqual(reimported, original);
});
(0, node_test_1.test)('serialize -> deserialize is stable', () => {
    const msg = buildSample();
    const doc = (0, index_1.serializeMessage)(msg);
    strict_1.default.equal(doc.version, 1);
    const back = (0, index_1.deserializeMessage)(doc).toJSON();
    strict_1.default.deepEqual(back, msg.toJSON());
});
(0, node_test_1.test)('serialize via JSON string round-trips', () => {
    const msg = buildSample();
    const str = msg.toString();
    const back = index_1.MessageV2Builder.deserialize(str).toJSON();
    strict_1.default.deepEqual(back, msg.toJSON());
});
(0, node_test_1.test)('top-level component types are correct', () => {
    const container = buildSample().toJSON().components[0];
    strict_1.default.equal(container.type, index_1.ComponentType.Container);
});
(0, node_test_1.test)('countComponents counts nested nodes', () => {
    const payload = buildSample().toJSON();
    // 1 container + (section[1] + 1 text + 1 accessory) + text + separator
    //  + media gallery + file + actionrow(+3 buttons) + actionrow(+1 select)
    const n = (0, index_1.countComponents)(payload.components);
    strict_1.default.equal(n, 14);
});
(0, node_test_1.test)('validator: missing IsComponentsV2 flag is an error', () => {
    const res = (0, index_1.validateMessage)({ flags: 0, components: [new index_1.TextDisplayBuilder('hi').toJSON()] });
    strict_1.default.equal(res.ok, false);
    strict_1.default.ok(res.errors.some((e) => e.path === 'flags'));
});
(0, node_test_1.test)('validator: forbidden coexisting fields', () => {
    const res = (0, index_1.validateMessage)({
        flags: index_1.MessageFlags.IsComponentsV2,
        components: [new index_1.TextDisplayBuilder('hi').toJSON()],
        // @ts-expect-error intentionally invalid extra field
        content: 'nope',
    });
    strict_1.default.ok(res.errors.some((e) => e.path === 'content'));
});
(0, node_test_1.test)('validator: link button cannot have custom_id', () => {
    const bad = { type: index_1.ComponentType.Button, style: index_1.ButtonStyle.Link, url: 'https://x', custom_id: 'oops', label: 'x' };
    const res = (0, index_1.validateMessage)({
        flags: index_1.MessageFlags.IsComponentsV2,
        components: [{ type: index_1.ComponentType.ActionRow, components: [bad] }],
    });
    strict_1.default.ok(res.errors.some((e) => /custom_id/.test(e.message)));
});
(0, node_test_1.test)('validator: action row cannot exceed 5 buttons', () => {
    const buttons = Array.from({ length: 6 }, (_, i) => new index_1.ButtonBuilder().setStyle(index_1.ButtonStyle.Secondary).setCustomId(`b${i}`).setLabel(`${i}`));
    const row = new index_1.ActionRowBuilder().addButtons(...buttons);
    const res = (0, index_1.validateMessage)({ flags: index_1.MessageFlags.IsComponentsV2, components: [row.toJSON()] });
    strict_1.default.ok(res.errors.some((e) => /at most 5 buttons/.test(e.message)));
});
(0, node_test_1.test)('validator: section requires 1-3 texts and an accessory', () => {
    const section = {
        type: index_1.ComponentType.Section,
        components: [],
        accessory: { type: index_1.ComponentType.Thumbnail, media: { url: 'https://x/y.png' } },
    };
    const res = (0, index_1.validateMessage)({ flags: index_1.MessageFlags.IsComponentsV2, components: [section] });
    strict_1.default.ok(res.errors.some((e) => /text displays/.test(e.message)));
});
(0, node_test_1.test)('validator: file accessory must use attachment:// scheme', () => {
    const res = (0, index_1.validateMessage)({
        flags: index_1.MessageFlags.IsComponentsV2,
        components: [new index_1.FileBuilder().setURL('https://example.com/x.pdf').toJSON()],
    });
    strict_1.default.ok(res.errors.some((e) => /attachment:\/\//.test(e.message)));
});
(0, node_test_1.test)('validator: 4000-char text budget enforced', () => {
    const big = 'a'.repeat(4001);
    const res = (0, index_1.validateMessage)({
        flags: index_1.MessageFlags.IsComponentsV2,
        components: [new index_1.TextDisplayBuilder(big).toJSON()],
    });
    strict_1.default.ok(res.errors.some((e) => /text content is/.test(e.message)));
    strict_1.default.equal((0, index_1.countTextChars)([new index_1.TextDisplayBuilder(big).toJSON()]), 4001);
});
(0, node_test_1.test)('validator: 40 total components cap enforced', () => {
    const rows = Array.from({ length: 9 }, () => new index_1.ActionRowBuilder().addButtons(...Array.from({ length: 5 }, (_, i) => new index_1.ButtonBuilder().setStyle(index_1.ButtonStyle.Secondary).setCustomId(`x${Math.random()}${i}`).setLabel('x'))).toJSON()); // 9 rows * (1 + 5) = 54 components
    const res = (0, index_1.validateMessage)({ flags: index_1.MessageFlags.IsComponentsV2, components: rows });
    strict_1.default.ok(res.errors.some((e) => /max is 40/.test(e.message)));
});
(0, node_test_1.test)('channel select round-trips with channel_types', () => {
    const sel = new index_1.ChannelSelectBuilder().setCustomId('ch').setChannelTypes(0, 5).setMaxValues(2);
    const json = sel.toJSON();
    strict_1.default.equal(json.type, index_1.ComponentType.ChannelSelect);
    strict_1.default.deepEqual(json.channel_types, [0, 5]);
    const back = index_1.ChannelSelectBuilder.from(json).toJSON();
    strict_1.default.deepEqual(back, json);
});
(0, node_test_1.test)('button emoji shorthand parses custom emoji', () => {
    const b = new index_1.ButtonBuilder().setStyle(index_1.ButtonStyle.Secondary).setCustomId('e').setEmoji('a:blob:12345').toJSON();
    strict_1.default.deepEqual(b.emoji, { animated: true, name: 'blob', id: '12345' });
});
(0, node_test_1.test)('unicode emoji shorthand', () => {
    const b = new index_1.ButtonBuilder().setStyle(index_1.ButtonStyle.Secondary).setCustomId('e').setEmoji('🔥').toJSON();
    strict_1.default.deepEqual(b.emoji, { name: '🔥' });
});
//# sourceMappingURL=roundtrip.test.js.map