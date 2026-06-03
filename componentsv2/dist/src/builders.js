"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageV2Builder = exports.ContainerBuilder = exports.SeparatorBuilder = exports.FileBuilder = exports.MediaGalleryBuilder = exports.SectionBuilder = exports.ThumbnailBuilder = exports.TextDisplayBuilder = exports.ActionRowBuilder = exports.ChannelSelectBuilder = exports.MentionableSelectBuilder = exports.RoleSelectBuilder = exports.UserSelectBuilder = exports.StringSelectBuilder = exports.SelectOptionBuilder = exports.ButtonBuilder = exports.UnfurledMediaBuilder = void 0;
exports.linkButton = linkButton;
exports.selectBuilderFrom = selectBuilderFrom;
exports.topLevelBuilderFrom = topLevelBuilderFrom;
/**
 * Fluent builder classes for Components V2.
 *
 * Every builder:
 *   - exposes chainable setters,
 *   - produces the exact Discord API JSON via `toJSON()` (EXPORT / serialize),
 *   - reconstructs itself from Discord API JSON via the static `from()` (IMPORT / deserialize).
 *
 * No dependency on discord.js: the objects produced are plain and plug directly
 * into `channel.send(payload)` / `interaction.reply(payload)`.
 */
const types_1 = require("./types");
const validators_1 = require("./validators");
/** Remove keys whose value is `undefined` (keeps `null`, which Discord treats as meaningful). */
function clean(obj) {
    for (const k of Object.keys(obj)) {
        if (obj[k] === undefined)
            delete obj[k];
    }
    return obj;
}
function normalizeEmoji(emoji) {
    if (emoji === undefined)
        return undefined;
    if (typeof emoji === 'string') {
        // "name:id" / "a:name:id" custom, or a raw unicode glyph
        const m = emoji.match(/^(a?):?([\w-]+):(\d+)$/);
        if (m)
            return clean({ animated: m[1] === 'a' || undefined, name: m[2], id: m[3] });
        return { name: emoji };
    }
    return emoji;
}
/** Base for builders that carry an optional numeric `id`. */
class BaseBuilder {
    /** Set the optional component id. */
    setId(id) {
        this._id = id;
        return this;
    }
}
// ---------------------------------------------------------------------------
// Unfurled media
// ---------------------------------------------------------------------------
class UnfurledMediaBuilder {
    constructor(url = '') {
        this.data = { url };
    }
    setURL(url) {
        this.data.url = url;
        return this;
    }
    toJSON() {
        return { url: this.data.url };
    }
    static from(api) {
        return new UnfurledMediaBuilder(typeof api === 'string' ? api : api.url);
    }
}
exports.UnfurledMediaBuilder = UnfurledMediaBuilder;
// ---------------------------------------------------------------------------
// Button (type 2)
// ---------------------------------------------------------------------------
class ButtonBuilder extends BaseBuilder {
    constructor() {
        super(...arguments);
        this.style = types_1.ButtonStyle.Secondary;
    }
    setStyle(style) {
        this.style = style;
        return this;
    }
    setLabel(label) {
        this.label = label;
        return this;
    }
    setEmoji(emoji) {
        this.emoji = normalizeEmoji(emoji);
        return this;
    }
    setCustomId(id) {
        this.customId = id;
        this.style = this.style === types_1.ButtonStyle.Link || this.style === types_1.ButtonStyle.Premium ? types_1.ButtonStyle.Secondary : this.style;
        return this;
    }
    /** Convenience: build a link button in one call. */
    setURL(url) {
        this.url = url;
        this.style = types_1.ButtonStyle.Link;
        return this;
    }
    setSKUId(skuId) {
        this.skuId = skuId;
        this.style = types_1.ButtonStyle.Premium;
        return this;
    }
    setDisabled(disabled = true) {
        this.disabled = disabled;
        return this;
    }
    toJSON() {
        return clean({
            type: types_1.ComponentType.Button,
            id: this._id,
            style: this.style,
            label: this.label,
            emoji: this.emoji,
            custom_id: this.customId,
            sku_id: this.skuId,
            url: this.url,
            disabled: this.disabled,
        });
    }
    static from(api) {
        const b = new ButtonBuilder().setId(api.id).setStyle(api.style);
        if (api.label !== undefined)
            b.setLabel(api.label);
        if (api.emoji !== undefined)
            b.emoji = api.emoji;
        if (api.custom_id !== undefined)
            b.customId = api.custom_id;
        if (api.sku_id !== undefined)
            b.skuId = api.sku_id;
        if (api.url !== undefined)
            b.url = api.url;
        if (api.disabled !== undefined)
            b.disabled = api.disabled;
        return b;
    }
}
exports.ButtonBuilder = ButtonBuilder;
/** Shortcut factory for a link button. */
function linkButton(url, label, emoji) {
    const b = new ButtonBuilder().setURL(url).setLabel(label);
    if (emoji)
        b.setEmoji(emoji);
    return b;
}
// ---------------------------------------------------------------------------
// Select option
// ---------------------------------------------------------------------------
class SelectOptionBuilder {
    constructor(label = '', value = '') {
        this.data = { label, value };
    }
    setLabel(label) {
        this.data.label = label;
        return this;
    }
    setValue(value) {
        this.data.value = value;
        return this;
    }
    setDescription(description) {
        this.data.description = description;
        return this;
    }
    setEmoji(emoji) {
        this.data.emoji = normalizeEmoji(emoji);
        return this;
    }
    setDefault(isDefault = true) {
        this.data.default = isDefault;
        return this;
    }
    toJSON() {
        return clean({ ...this.data });
    }
    static from(api) {
        const o = new SelectOptionBuilder(api.label, api.value);
        if (api.description !== undefined)
            o.data.description = api.description;
        if (api.emoji !== undefined)
            o.data.emoji = api.emoji;
        if (api.default !== undefined)
            o.data.default = api.default;
        return o;
    }
}
exports.SelectOptionBuilder = SelectOptionBuilder;
// ---------------------------------------------------------------------------
// Select menus (types 3,5,6,7,8)
// ---------------------------------------------------------------------------
class BaseSelectBuilder extends BaseBuilder {
    constructor() {
        super(...arguments);
        this.customId = '';
    }
    setCustomId(id) {
        this.customId = id;
        return this;
    }
    setPlaceholder(text) {
        this.placeholder = text;
        return this;
    }
    setMinValues(n) {
        this.minValues = n;
        return this;
    }
    setMaxValues(n) {
        this.maxValues = n;
        return this;
    }
    setDisabled(disabled = true) {
        this.disabled = disabled;
        return this;
    }
    baseJSON() {
        return {
            id: this._id,
            custom_id: this.customId,
            placeholder: this.placeholder,
            min_values: this.minValues,
            max_values: this.maxValues,
            disabled: this.disabled,
        };
    }
    applyBase(api) {
        this.setId(api.id).setCustomId(api.custom_id);
        if (api.placeholder !== undefined)
            this.placeholder = api.placeholder;
        if (api.min_values !== undefined)
            this.minValues = api.min_values;
        if (api.max_values !== undefined)
            this.maxValues = api.max_values;
        if (api.disabled !== undefined)
            this.disabled = api.disabled;
    }
}
class StringSelectBuilder extends BaseSelectBuilder {
    constructor() {
        super(...arguments);
        this.options = [];
    }
    addOptions(...opts) {
        for (const o of opts)
            this.options.push(o instanceof SelectOptionBuilder ? o.toJSON() : o);
        return this;
    }
    setOptions(opts) {
        this.options = [];
        return this.addOptions(...opts);
    }
    toJSON() {
        return clean({
            type: types_1.ComponentType.StringSelect,
            ...this.baseJSON(),
            options: this.options,
        });
    }
    static from(api) {
        const b = new StringSelectBuilder();
        b.applyBase(api);
        b.options = (api.options || []).map((o) => SelectOptionBuilder.from(o).toJSON());
        return b;
    }
}
exports.StringSelectBuilder = StringSelectBuilder;
class AutoSelectBuilder extends BaseSelectBuilder {
    addDefaultValues(...values) {
        this.defaultValues = [...(this.defaultValues || []), ...values];
        return this;
    }
    autoJSON(type) {
        return clean({ type, ...this.baseJSON(), default_values: this.defaultValues });
    }
    applyAuto(api) {
        this.applyBase(api);
        if (api.default_values !== undefined)
            this.defaultValues = api.default_values;
    }
}
class UserSelectBuilder extends AutoSelectBuilder {
    toJSON() {
        return this.autoJSON(types_1.ComponentType.UserSelect);
    }
    static from(api) {
        const b = new UserSelectBuilder();
        b.applyAuto(api);
        return b;
    }
}
exports.UserSelectBuilder = UserSelectBuilder;
class RoleSelectBuilder extends AutoSelectBuilder {
    toJSON() {
        return this.autoJSON(types_1.ComponentType.RoleSelect);
    }
    static from(api) {
        const b = new RoleSelectBuilder();
        b.applyAuto(api);
        return b;
    }
}
exports.RoleSelectBuilder = RoleSelectBuilder;
class MentionableSelectBuilder extends AutoSelectBuilder {
    toJSON() {
        return this.autoJSON(types_1.ComponentType.MentionableSelect);
    }
    static from(api) {
        const b = new MentionableSelectBuilder();
        b.applyAuto(api);
        return b;
    }
}
exports.MentionableSelectBuilder = MentionableSelectBuilder;
class ChannelSelectBuilder extends AutoSelectBuilder {
    setChannelTypes(...types) {
        this.channelTypes = types;
        return this;
    }
    toJSON() {
        return clean({ ...this.autoJSON(types_1.ComponentType.ChannelSelect), channel_types: this.channelTypes });
    }
    static from(api) {
        const b = new ChannelSelectBuilder();
        b.applyAuto(api);
        if (api.channel_types !== undefined)
            b.channelTypes = api.channel_types;
        return b;
    }
}
exports.ChannelSelectBuilder = ChannelSelectBuilder;
function selectBuilderFrom(api) {
    switch (api.type) {
        case types_1.ComponentType.StringSelect:
            return StringSelectBuilder.from(api);
        case types_1.ComponentType.UserSelect:
            return UserSelectBuilder.from(api);
        case types_1.ComponentType.RoleSelect:
            return RoleSelectBuilder.from(api);
        case types_1.ComponentType.MentionableSelect:
            return MentionableSelectBuilder.from(api);
        case types_1.ComponentType.ChannelSelect:
            return ChannelSelectBuilder.from(api);
    }
}
// ---------------------------------------------------------------------------
// Action Row (type 1)
// ---------------------------------------------------------------------------
class ActionRowBuilder extends BaseBuilder {
    constructor() {
        super(...arguments);
        this.buttons = [];
    }
    addButtons(...buttons) {
        if (this.select)
            throw new Error('an action row cannot mix a select menu with buttons');
        this.buttons.push(...buttons);
        return this;
    }
    setSelect(select) {
        if (this.buttons.length)
            throw new Error('an action row cannot mix a select menu with buttons');
        this.select = select;
        return this;
    }
    toJSON() {
        const components = this.select
            ? [this.select.toJSON()]
            : this.buttons.map((b) => b.toJSON());
        return clean({ type: types_1.ComponentType.ActionRow, id: this._id, components });
    }
    static from(api) {
        const row = new ActionRowBuilder().setId(api.id);
        const children = api.components || [];
        if (children.length && children[0].type !== types_1.ComponentType.Button) {
            row.select = selectBuilderFrom(children[0]);
        }
        else {
            row.buttons = children.map((b) => ButtonBuilder.from(b));
        }
        return row;
    }
}
exports.ActionRowBuilder = ActionRowBuilder;
// ---------------------------------------------------------------------------
// Text Display (type 10)
// ---------------------------------------------------------------------------
class TextDisplayBuilder extends BaseBuilder {
    constructor(content = '') {
        super();
        this.content = '';
        this.content = content;
    }
    setContent(content) {
        this.content = content;
        return this;
    }
    toJSON() {
        return clean({ type: types_1.ComponentType.TextDisplay, id: this._id, content: this.content });
    }
    static from(api) {
        return new TextDisplayBuilder(api.content).setId(api.id);
    }
}
exports.TextDisplayBuilder = TextDisplayBuilder;
// ---------------------------------------------------------------------------
// Thumbnail (type 11)
// ---------------------------------------------------------------------------
class ThumbnailBuilder extends BaseBuilder {
    constructor() {
        super(...arguments);
        this.media = { url: '' };
    }
    setURL(url) {
        this.media = { url };
        return this;
    }
    setMedia(media) {
        this.media = media instanceof UnfurledMediaBuilder ? media.toJSON() : { url: media.url };
        return this;
    }
    setDescription(description) {
        this.description = description;
        return this;
    }
    setSpoiler(spoiler = true) {
        this.spoiler = spoiler;
        return this;
    }
    toJSON() {
        return clean({
            type: types_1.ComponentType.Thumbnail,
            id: this._id,
            media: { url: this.media.url },
            description: this.description,
            spoiler: this.spoiler,
        });
    }
    static from(api) {
        const t = new ThumbnailBuilder().setId(api.id).setMedia(api.media);
        if (api.description !== undefined)
            t.description = api.description;
        if (api.spoiler !== undefined)
            t.spoiler = api.spoiler;
        return t;
    }
}
exports.ThumbnailBuilder = ThumbnailBuilder;
// ---------------------------------------------------------------------------
// Section (type 9)
// ---------------------------------------------------------------------------
class SectionBuilder extends BaseBuilder {
    constructor() {
        super(...arguments);
        this.texts = [];
    }
    addText(...texts) {
        for (const t of texts)
            this.texts.push(typeof t === 'string' ? new TextDisplayBuilder(t) : t);
        return this;
    }
    setThumbnailAccessory(thumb) {
        this.accessory = thumb;
        return this;
    }
    setButtonAccessory(button) {
        this.accessory = button;
        return this;
    }
    toJSON() {
        if (!this.accessory)
            throw new Error('section requires an accessory (thumbnail or button)');
        return clean({
            type: types_1.ComponentType.Section,
            id: this._id,
            components: this.texts.map((t) => t.toJSON()),
            accessory: this.accessory.toJSON(),
        });
    }
    static from(api) {
        const s = new SectionBuilder().setId(api.id);
        s.texts = (api.components || []).map((t) => TextDisplayBuilder.from(t));
        if (api.accessory?.type === types_1.ComponentType.Thumbnail)
            s.accessory = ThumbnailBuilder.from(api.accessory);
        else if (api.accessory?.type === types_1.ComponentType.Button)
            s.accessory = ButtonBuilder.from(api.accessory);
        return s;
    }
}
exports.SectionBuilder = SectionBuilder;
// ---------------------------------------------------------------------------
// Media Gallery (type 12)
// ---------------------------------------------------------------------------
class MediaGalleryBuilder extends BaseBuilder {
    constructor() {
        super(...arguments);
        this.items = [];
    }
    addItems(...items) {
        for (const it of items) {
            const media = it.media;
            const url = media ? media.url : it.url;
            this.items.push(clean({
                media: { url },
                description: it.description,
                spoiler: it.spoiler,
            }));
        }
        return this;
    }
    toJSON() {
        return clean({ type: types_1.ComponentType.MediaGallery, id: this._id, items: this.items });
    }
    static from(api) {
        const g = new MediaGalleryBuilder().setId(api.id);
        g.items = (api.items || []).map((it) => clean({ media: { url: it.media.url }, description: it.description, spoiler: it.spoiler }));
        return g;
    }
}
exports.MediaGalleryBuilder = MediaGalleryBuilder;
// ---------------------------------------------------------------------------
// File (type 13)
// ---------------------------------------------------------------------------
class FileBuilder extends BaseBuilder {
    constructor() {
        super(...arguments);
        this.file = { url: '' };
    }
    /** `url` must be `attachment://<filename>`. */
    setURL(url) {
        this.file = { url };
        return this;
    }
    setSpoiler(spoiler = true) {
        this.spoiler = spoiler;
        return this;
    }
    toJSON() {
        return clean({ type: types_1.ComponentType.File, id: this._id, file: { url: this.file.url }, spoiler: this.spoiler });
    }
    static from(api) {
        const f = new FileBuilder().setId(api.id).setURL(api.file.url);
        if (api.spoiler !== undefined)
            f.spoiler = api.spoiler;
        return f;
    }
}
exports.FileBuilder = FileBuilder;
// ---------------------------------------------------------------------------
// Separator (type 14)
// ---------------------------------------------------------------------------
class SeparatorBuilder extends BaseBuilder {
    setDivider(divider) {
        this.divider = divider;
        return this;
    }
    setSpacing(spacing) {
        this.spacing = spacing;
        return this;
    }
    toJSON() {
        return clean({ type: types_1.ComponentType.Separator, id: this._id, divider: this.divider, spacing: this.spacing });
    }
    static from(api) {
        const s = new SeparatorBuilder().setId(api.id);
        if (api.divider !== undefined)
            s.divider = api.divider;
        if (api.spacing !== undefined)
            s.spacing = api.spacing;
        return s;
    }
}
exports.SeparatorBuilder = SeparatorBuilder;
class ContainerBuilder extends BaseBuilder {
    constructor() {
        super(...arguments);
        this.children = [];
    }
    addComponents(...children) {
        this.children.push(...children);
        return this;
    }
    setAccentColor(color) {
        this.accentColor = color;
        return this;
    }
    setSpoiler(spoiler = true) {
        this.spoiler = spoiler;
        return this;
    }
    toJSON() {
        return clean({
            type: types_1.ComponentType.Container,
            id: this._id,
            components: this.children.map((c) => c.toJSON()),
            accent_color: this.accentColor,
            spoiler: this.spoiler,
        });
    }
    static from(api) {
        const c = new ContainerBuilder().setId(api.id);
        if (api.accent_color !== undefined)
            c.accentColor = api.accent_color;
        if (api.spoiler !== undefined)
            c.spoiler = api.spoiler;
        c.children = (api.components || []).map((child) => topLevelBuilderFrom(child));
        return c;
    }
}
exports.ContainerBuilder = ContainerBuilder;
/** Reconstruct the appropriate builder from any top-level / container API component. */
function topLevelBuilderFrom(api) {
    switch (api.type) {
        case types_1.ComponentType.ActionRow:
            return ActionRowBuilder.from(api);
        case types_1.ComponentType.TextDisplay:
            return TextDisplayBuilder.from(api);
        case types_1.ComponentType.Section:
            return SectionBuilder.from(api);
        case types_1.ComponentType.MediaGallery:
            return MediaGalleryBuilder.from(api);
        case types_1.ComponentType.Separator:
            return SeparatorBuilder.from(api);
        case types_1.ComponentType.File:
            return FileBuilder.from(api);
        case types_1.ComponentType.Container:
            return ContainerBuilder.from(api);
        default:
            throw new Error(`unsupported top-level component type: ${api.type}`);
    }
}
// ---------------------------------------------------------------------------
// Message (top-level container of the whole payload)
// ---------------------------------------------------------------------------
class MessageV2Builder {
    constructor() {
        this.components = [];
        this.flags = types_1.MessageFlags.IsComponentsV2;
    }
    addComponents(...components) {
        this.components.push(...components);
        return this;
    }
    setComponents(components) {
        this.components = [...components];
        return this;
    }
    /** Add extra message flags. IsComponentsV2 is always kept set. */
    addFlags(...flags) {
        for (const f of flags)
            this.flags |= f;
        return this;
    }
    /** Replace flags wholesale. IsComponentsV2 is force-enabled regardless. */
    setFlags(flags) {
        this.flags = flags | types_1.MessageFlags.IsComponentsV2;
        return this;
    }
    setSpoilerSuppressNotifications(on = true) {
        if (on)
            this.flags |= types_1.MessageFlags.SuppressNotifications;
        else
            this.flags &= ~types_1.MessageFlags.SuppressNotifications;
        return this;
    }
    /** EXPORT: the exact Discord API message payload `{ flags, components }`. */
    toJSON() {
        return {
            flags: this.flags | types_1.MessageFlags.IsComponentsV2,
            components: this.components.map((c) => c.toJSON()),
        };
    }
    /** Alias of `toJSON()` — pass directly to channel.send / interaction.reply. */
    toDiscordPayload() {
        return this.toJSON();
    }
    validate() {
        return (0, validators_1.validateMessage)(this.toJSON());
    }
    /** SERIALIZE to a portable, versioned JSON document (for draft storage). */
    serialize() {
        const payload = this.toJSON();
        return { version: 1, flags: payload.flags, components: payload.components };
    }
    toString() {
        return JSON.stringify(this.serialize());
    }
    // ----- import paths -----
    /** IMPORT from a raw Discord API payload (e.g. a fetched message). */
    static fromAPI(payload) {
        const b = new MessageV2Builder();
        if (typeof payload.flags === 'number')
            b.flags = payload.flags | types_1.MessageFlags.IsComponentsV2;
        b.components = (payload.components || []).map((c) => topLevelBuilderFrom(c));
        return b;
    }
    /** DESERIALIZE from a `serialize()` document or its JSON string. */
    static deserialize(doc) {
        const parsed = typeof doc === 'string' ? JSON.parse(doc) : doc;
        return MessageV2Builder.fromAPI({ flags: parsed.flags, components: parsed.components });
    }
}
exports.MessageV2Builder = MessageV2Builder;
//# sourceMappingURL=builders.js.map