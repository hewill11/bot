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
import {
  ButtonStyle,
  ComponentType,
  MessageFlags,
  SeparatorSpacing,
  type APIActionRowChild,
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIChannelSelectComponent,
  type APIContainerChild,
  type APIContainerComponent,
  type APIFileComponent,
  type APIMediaGalleryComponent,
  type APIMediaGalleryItem,
  type APIMentionableSelectComponent,
  type APIMessageComponentsV2Payload,
  type APIPartialEmoji,
  type APIRoleSelectComponent,
  type APISectionAccessory,
  type APISectionComponent,
  type APISelectDefaultValue,
  type APISelectMenuComponent,
  type APISelectOption,
  type APISeparatorComponent,
  type APITextDisplayComponent,
  type APIThumbnailComponent,
  type APITopLevelComponent,
  type APIUnfurledMediaItem,
  type APIUserSelectComponent,
  type SelectDefaultValueType,
  type SerializedDocumentV2,
} from './types';
import { validateMessage, type ValidationResult } from './validators';

/** Remove keys whose value is `undefined` (keeps `null`, which Discord treats as meaningful). */
function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}

function normalizeEmoji(emoji: string | APIPartialEmoji | undefined): APIPartialEmoji | undefined {
  if (emoji === undefined) return undefined;
  if (typeof emoji === 'string') {
    // "name:id" / "a:name:id" custom, or a raw unicode glyph
    const m = emoji.match(/^(a?):?([\w-]+):(\d+)$/);
    if (m) return clean({ animated: m[1] === 'a' || undefined, name: m[2], id: m[3] });
    return { name: emoji };
  }
  return emoji;
}

/** Base for builders that carry an optional numeric `id`. */
abstract class BaseBuilder {
  protected _id?: number;
  /** Set the optional component id. */
  setId(id: number | undefined): this {
    this._id = id;
    return this;
  }
  abstract toJSON(): unknown;
}

// ---------------------------------------------------------------------------
// Unfurled media
// ---------------------------------------------------------------------------

export class UnfurledMediaBuilder {
  private data: APIUnfurledMediaItem;
  constructor(url = '') {
    this.data = { url };
  }
  setURL(url: string): this {
    this.data.url = url;
    return this;
  }
  toJSON(): APIUnfurledMediaItem {
    return { url: this.data.url };
  }
  static from(api: APIUnfurledMediaItem | string): UnfurledMediaBuilder {
    return new UnfurledMediaBuilder(typeof api === 'string' ? api : api.url);
  }
}

// ---------------------------------------------------------------------------
// Button (type 2)
// ---------------------------------------------------------------------------

export class ButtonBuilder extends BaseBuilder {
  private style: ButtonStyle = ButtonStyle.Secondary;
  private label?: string;
  private emoji?: APIPartialEmoji;
  private customId?: string;
  private skuId?: string;
  private url?: string;
  private disabled?: boolean;

  setStyle(style: ButtonStyle): this {
    this.style = style;
    return this;
  }
  setLabel(label: string): this {
    this.label = label;
    return this;
  }
  setEmoji(emoji: string | APIPartialEmoji): this {
    this.emoji = normalizeEmoji(emoji);
    return this;
  }
  setCustomId(id: string): this {
    this.customId = id;
    this.style = this.style === ButtonStyle.Link || this.style === ButtonStyle.Premium ? ButtonStyle.Secondary : this.style;
    return this;
  }
  /** Convenience: build a link button in one call. */
  setURL(url: string): this {
    this.url = url;
    this.style = ButtonStyle.Link;
    return this;
  }
  setSKUId(skuId: string): this {
    this.skuId = skuId;
    this.style = ButtonStyle.Premium;
    return this;
  }
  setDisabled(disabled = true): this {
    this.disabled = disabled;
    return this;
  }

  toJSON(): APIButtonComponent {
    return clean({
      type: ComponentType.Button,
      id: this._id,
      style: this.style,
      label: this.label,
      emoji: this.emoji,
      custom_id: this.customId,
      sku_id: this.skuId,
      url: this.url,
      disabled: this.disabled,
    }) as APIButtonComponent;
  }

  static from(api: APIButtonComponent): ButtonBuilder {
    const b = new ButtonBuilder().setId(api.id).setStyle(api.style);
    if (api.label !== undefined) b.setLabel(api.label);
    if (api.emoji !== undefined) b.emoji = api.emoji;
    if (api.custom_id !== undefined) b.customId = api.custom_id;
    if (api.sku_id !== undefined) b.skuId = api.sku_id;
    if (api.url !== undefined) b.url = api.url;
    if (api.disabled !== undefined) b.disabled = api.disabled;
    return b;
  }
}

/** Shortcut factory for a link button. */
export function linkButton(url: string, label: string, emoji?: string | APIPartialEmoji): ButtonBuilder {
  const b = new ButtonBuilder().setURL(url).setLabel(label);
  if (emoji) b.setEmoji(emoji);
  return b;
}

// ---------------------------------------------------------------------------
// Select option
// ---------------------------------------------------------------------------

export class SelectOptionBuilder {
  private data: APISelectOption;
  constructor(label = '', value = '') {
    this.data = { label, value };
  }
  setLabel(label: string): this {
    this.data.label = label;
    return this;
  }
  setValue(value: string): this {
    this.data.value = value;
    return this;
  }
  setDescription(description: string): this {
    this.data.description = description;
    return this;
  }
  setEmoji(emoji: string | APIPartialEmoji): this {
    this.data.emoji = normalizeEmoji(emoji);
    return this;
  }
  setDefault(isDefault = true): this {
    this.data.default = isDefault;
    return this;
  }
  toJSON(): APISelectOption {
    return clean({ ...this.data }) as APISelectOption;
  }
  static from(api: APISelectOption): SelectOptionBuilder {
    const o = new SelectOptionBuilder(api.label, api.value);
    if (api.description !== undefined) o.data.description = api.description;
    if (api.emoji !== undefined) o.data.emoji = api.emoji;
    if (api.default !== undefined) o.data.default = api.default;
    return o;
  }
}

// ---------------------------------------------------------------------------
// Select menus (types 3,5,6,7,8)
// ---------------------------------------------------------------------------

abstract class BaseSelectBuilder extends BaseBuilder {
  protected customId = '';
  protected placeholder?: string;
  protected minValues?: number;
  protected maxValues?: number;
  protected disabled?: boolean;

  setCustomId(id: string): this {
    this.customId = id;
    return this;
  }
  setPlaceholder(text: string): this {
    this.placeholder = text;
    return this;
  }
  setMinValues(n: number): this {
    this.minValues = n;
    return this;
  }
  setMaxValues(n: number): this {
    this.maxValues = n;
    return this;
  }
  setDisabled(disabled = true): this {
    this.disabled = disabled;
    return this;
  }
  protected baseJSON() {
    return {
      id: this._id,
      custom_id: this.customId,
      placeholder: this.placeholder,
      min_values: this.minValues,
      max_values: this.maxValues,
      disabled: this.disabled,
    };
  }
  protected applyBase(api: APISelectMenuComponent) {
    this.setId(api.id).setCustomId(api.custom_id);
    if (api.placeholder !== undefined) this.placeholder = api.placeholder;
    if (api.min_values !== undefined) this.minValues = api.min_values;
    if (api.max_values !== undefined) this.maxValues = api.max_values;
    if (api.disabled !== undefined) this.disabled = api.disabled;
  }
}

export class StringSelectBuilder extends BaseSelectBuilder {
  private options: APISelectOption[] = [];
  addOptions(...opts: (SelectOptionBuilder | APISelectOption)[]): this {
    for (const o of opts) this.options.push(o instanceof SelectOptionBuilder ? o.toJSON() : o);
    return this;
  }
  setOptions(opts: (SelectOptionBuilder | APISelectOption)[]): this {
    this.options = [];
    return this.addOptions(...opts);
  }
  toJSON(): APIStringSelectComponentJSON {
    return clean({
      type: ComponentType.StringSelect,
      ...this.baseJSON(),
      options: this.options,
    }) as APIStringSelectComponentJSON;
  }
  static from(api: import('./types').APIStringSelectComponent): StringSelectBuilder {
    const b = new StringSelectBuilder();
    b.applyBase(api);
    b.options = (api.options || []).map((o) => SelectOptionBuilder.from(o).toJSON());
    return b;
  }
}
type APIStringSelectComponentJSON = import('./types').APIStringSelectComponent;

abstract class AutoSelectBuilder extends BaseSelectBuilder {
  protected defaultValues?: APISelectDefaultValue[];
  addDefaultValues(...values: APISelectDefaultValue[]): this {
    this.defaultValues = [...(this.defaultValues || []), ...values];
    return this;
  }
  protected autoJSON(type: ComponentType) {
    return clean({ type, ...this.baseJSON(), default_values: this.defaultValues });
  }
  protected applyAuto(api: APIUserSelectComponent | APIRoleSelectComponent | APIMentionableSelectComponent | APIChannelSelectComponent) {
    this.applyBase(api);
    if (api.default_values !== undefined) this.defaultValues = api.default_values;
  }
}

export class UserSelectBuilder extends AutoSelectBuilder {
  toJSON(): APIUserSelectComponent {
    return this.autoJSON(ComponentType.UserSelect) as APIUserSelectComponent;
  }
  static from(api: APIUserSelectComponent): UserSelectBuilder {
    const b = new UserSelectBuilder();
    b.applyAuto(api);
    return b;
  }
}

export class RoleSelectBuilder extends AutoSelectBuilder {
  toJSON(): APIRoleSelectComponent {
    return this.autoJSON(ComponentType.RoleSelect) as APIRoleSelectComponent;
  }
  static from(api: APIRoleSelectComponent): RoleSelectBuilder {
    const b = new RoleSelectBuilder();
    b.applyAuto(api);
    return b;
  }
}

export class MentionableSelectBuilder extends AutoSelectBuilder {
  toJSON(): APIMentionableSelectComponent {
    return this.autoJSON(ComponentType.MentionableSelect) as APIMentionableSelectComponent;
  }
  static from(api: APIMentionableSelectComponent): MentionableSelectBuilder {
    const b = new MentionableSelectBuilder();
    b.applyAuto(api);
    return b;
  }
}

export class ChannelSelectBuilder extends AutoSelectBuilder {
  private channelTypes?: number[];
  setChannelTypes(...types: number[]): this {
    this.channelTypes = types;
    return this;
  }
  toJSON(): APIChannelSelectComponent {
    return clean({ ...this.autoJSON(ComponentType.ChannelSelect), channel_types: this.channelTypes }) as APIChannelSelectComponent;
  }
  static from(api: APIChannelSelectComponent): ChannelSelectBuilder {
    const b = new ChannelSelectBuilder();
    b.applyAuto(api);
    if (api.channel_types !== undefined) b.channelTypes = api.channel_types;
    return b;
  }
}

export type AnySelectBuilder =
  | StringSelectBuilder
  | UserSelectBuilder
  | RoleSelectBuilder
  | MentionableSelectBuilder
  | ChannelSelectBuilder;

export function selectBuilderFrom(api: APISelectMenuComponent): AnySelectBuilder {
  switch (api.type) {
    case ComponentType.StringSelect:
      return StringSelectBuilder.from(api);
    case ComponentType.UserSelect:
      return UserSelectBuilder.from(api);
    case ComponentType.RoleSelect:
      return RoleSelectBuilder.from(api);
    case ComponentType.MentionableSelect:
      return MentionableSelectBuilder.from(api);
    case ComponentType.ChannelSelect:
      return ChannelSelectBuilder.from(api);
  }
}

// ---------------------------------------------------------------------------
// Action Row (type 1)
// ---------------------------------------------------------------------------

export class ActionRowBuilder extends BaseBuilder {
  private buttons: ButtonBuilder[] = [];
  private select?: AnySelectBuilder;

  addButtons(...buttons: ButtonBuilder[]): this {
    if (this.select) throw new Error('an action row cannot mix a select menu with buttons');
    this.buttons.push(...buttons);
    return this;
  }
  setSelect(select: AnySelectBuilder): this {
    if (this.buttons.length) throw new Error('an action row cannot mix a select menu with buttons');
    this.select = select;
    return this;
  }
  toJSON(): APIActionRowComponent {
    const components: APIActionRowChild[] = this.select
      ? [this.select.toJSON() as APIActionRowChild]
      : this.buttons.map((b) => b.toJSON());
    return clean({ type: ComponentType.ActionRow, id: this._id, components }) as APIActionRowComponent;
  }
  static from(api: APIActionRowComponent): ActionRowBuilder {
    const row = new ActionRowBuilder().setId(api.id);
    const children = api.components || [];
    if (children.length && children[0].type !== ComponentType.Button) {
      row.select = selectBuilderFrom(children[0] as APISelectMenuComponent);
    } else {
      row.buttons = (children as APIButtonComponent[]).map((b) => ButtonBuilder.from(b));
    }
    return row;
  }
}

// ---------------------------------------------------------------------------
// Text Display (type 10)
// ---------------------------------------------------------------------------

export class TextDisplayBuilder extends BaseBuilder {
  private content = '';
  constructor(content = '') {
    super();
    this.content = content;
  }
  setContent(content: string): this {
    this.content = content;
    return this;
  }
  toJSON(): APITextDisplayComponent {
    return clean({ type: ComponentType.TextDisplay, id: this._id, content: this.content }) as APITextDisplayComponent;
  }
  static from(api: APITextDisplayComponent): TextDisplayBuilder {
    return new TextDisplayBuilder(api.content).setId(api.id);
  }
}

// ---------------------------------------------------------------------------
// Thumbnail (type 11)
// ---------------------------------------------------------------------------

export class ThumbnailBuilder extends BaseBuilder {
  private media: APIUnfurledMediaItem = { url: '' };
  private description?: string | null;
  private spoiler?: boolean;

  setURL(url: string): this {
    this.media = { url };
    return this;
  }
  setMedia(media: APIUnfurledMediaItem | UnfurledMediaBuilder): this {
    this.media = media instanceof UnfurledMediaBuilder ? media.toJSON() : { url: media.url };
    return this;
  }
  setDescription(description: string | null): this {
    this.description = description;
    return this;
  }
  setSpoiler(spoiler = true): this {
    this.spoiler = spoiler;
    return this;
  }
  toJSON(): APIThumbnailComponent {
    return clean({
      type: ComponentType.Thumbnail,
      id: this._id,
      media: { url: this.media.url },
      description: this.description,
      spoiler: this.spoiler,
    }) as APIThumbnailComponent;
  }
  static from(api: APIThumbnailComponent): ThumbnailBuilder {
    const t = new ThumbnailBuilder().setId(api.id).setMedia(api.media);
    if (api.description !== undefined) t.description = api.description;
    if (api.spoiler !== undefined) t.spoiler = api.spoiler;
    return t;
  }
}

// ---------------------------------------------------------------------------
// Section (type 9)
// ---------------------------------------------------------------------------

export class SectionBuilder extends BaseBuilder {
  private texts: TextDisplayBuilder[] = [];
  private accessory?: ThumbnailBuilder | ButtonBuilder;

  addText(...texts: (TextDisplayBuilder | string)[]): this {
    for (const t of texts) this.texts.push(typeof t === 'string' ? new TextDisplayBuilder(t) : t);
    return this;
  }
  setThumbnailAccessory(thumb: ThumbnailBuilder): this {
    this.accessory = thumb;
    return this;
  }
  setButtonAccessory(button: ButtonBuilder): this {
    this.accessory = button;
    return this;
  }
  toJSON(): APISectionComponent {
    if (!this.accessory) throw new Error('section requires an accessory (thumbnail or button)');
    return clean({
      type: ComponentType.Section,
      id: this._id,
      components: this.texts.map((t) => t.toJSON()),
      accessory: this.accessory.toJSON() as APISectionAccessory,
    }) as APISectionComponent;
  }
  static from(api: APISectionComponent): SectionBuilder {
    const s = new SectionBuilder().setId(api.id);
    s.texts = (api.components || []).map((t) => TextDisplayBuilder.from(t));
    if (api.accessory?.type === ComponentType.Thumbnail) s.accessory = ThumbnailBuilder.from(api.accessory);
    else if (api.accessory?.type === ComponentType.Button) s.accessory = ButtonBuilder.from(api.accessory);
    return s;
  }
}

// ---------------------------------------------------------------------------
// Media Gallery (type 12)
// ---------------------------------------------------------------------------

export class MediaGalleryBuilder extends BaseBuilder {
  private items: APIMediaGalleryItem[] = [];
  addItems(...items: (APIMediaGalleryItem | { url: string; description?: string | null; spoiler?: boolean })[]): this {
    for (const it of items) {
      const media = (it as APIMediaGalleryItem).media;
      const url = media ? media.url : (it as { url: string }).url;
      this.items.push(
        clean({
          media: { url },
          description: it.description,
          spoiler: it.spoiler,
        }) as APIMediaGalleryItem,
      );
    }
    return this;
  }
  toJSON(): APIMediaGalleryComponent {
    return clean({ type: ComponentType.MediaGallery, id: this._id, items: this.items }) as APIMediaGalleryComponent;
  }
  static from(api: APIMediaGalleryComponent): MediaGalleryBuilder {
    const g = new MediaGalleryBuilder().setId(api.id);
    g.items = (api.items || []).map((it) => clean({ media: { url: it.media.url }, description: it.description, spoiler: it.spoiler }) as APIMediaGalleryItem);
    return g;
  }
}

// ---------------------------------------------------------------------------
// File (type 13)
// ---------------------------------------------------------------------------

export class FileBuilder extends BaseBuilder {
  private file: APIUnfurledMediaItem = { url: '' };
  private spoiler?: boolean;
  /** `url` must be `attachment://<filename>`. */
  setURL(url: string): this {
    this.file = { url };
    return this;
  }
  setSpoiler(spoiler = true): this {
    this.spoiler = spoiler;
    return this;
  }
  toJSON(): APIFileComponent {
    return clean({ type: ComponentType.File, id: this._id, file: { url: this.file.url }, spoiler: this.spoiler }) as APIFileComponent;
  }
  static from(api: APIFileComponent): FileBuilder {
    const f = new FileBuilder().setId(api.id).setURL(api.file.url);
    if (api.spoiler !== undefined) f.spoiler = api.spoiler;
    return f;
  }
}

// ---------------------------------------------------------------------------
// Separator (type 14)
// ---------------------------------------------------------------------------

export class SeparatorBuilder extends BaseBuilder {
  private divider?: boolean;
  private spacing?: SeparatorSpacing;
  setDivider(divider: boolean): this {
    this.divider = divider;
    return this;
  }
  setSpacing(spacing: SeparatorSpacing): this {
    this.spacing = spacing;
    return this;
  }
  toJSON(): APISeparatorComponent {
    return clean({ type: ComponentType.Separator, id: this._id, divider: this.divider, spacing: this.spacing }) as APISeparatorComponent;
  }
  static from(api: APISeparatorComponent): SeparatorBuilder {
    const s = new SeparatorBuilder().setId(api.id);
    if (api.divider !== undefined) s.divider = api.divider;
    if (api.spacing !== undefined) s.spacing = api.spacing;
    return s;
  }
}

// ---------------------------------------------------------------------------
// Container (type 17)
// ---------------------------------------------------------------------------

export type ContainerChildBuilder =
  | ActionRowBuilder
  | TextDisplayBuilder
  | SectionBuilder
  | MediaGalleryBuilder
  | SeparatorBuilder
  | FileBuilder;

export class ContainerBuilder extends BaseBuilder {
  private children: ContainerChildBuilder[] = [];
  private accentColor?: number | null;
  private spoiler?: boolean;

  addComponents(...children: ContainerChildBuilder[]): this {
    this.children.push(...children);
    return this;
  }
  setAccentColor(color: number | null): this {
    this.accentColor = color;
    return this;
  }
  setSpoiler(spoiler = true): this {
    this.spoiler = spoiler;
    return this;
  }
  toJSON(): APIContainerComponent {
    return clean({
      type: ComponentType.Container,
      id: this._id,
      components: this.children.map((c) => c.toJSON() as APIContainerChild),
      accent_color: this.accentColor,
      spoiler: this.spoiler,
    }) as APIContainerComponent;
  }
  static from(api: APIContainerComponent): ContainerBuilder {
    const c = new ContainerBuilder().setId(api.id);
    if (api.accent_color !== undefined) c.accentColor = api.accent_color;
    if (api.spoiler !== undefined) c.spoiler = api.spoiler;
    c.children = (api.components || []).map((child) => topLevelBuilderFrom(child) as ContainerChildBuilder);
    return c;
  }
}

// ---------------------------------------------------------------------------
// Generic dispatch from API JSON -> builder
// ---------------------------------------------------------------------------

export type TopLevelBuilder =
  | ActionRowBuilder
  | TextDisplayBuilder
  | SectionBuilder
  | MediaGalleryBuilder
  | SeparatorBuilder
  | FileBuilder
  | ContainerBuilder;

/** Reconstruct the appropriate builder from any top-level / container API component. */
export function topLevelBuilderFrom(api: APITopLevelComponent | APIContainerChild): TopLevelBuilder {
  switch (api.type) {
    case ComponentType.ActionRow:
      return ActionRowBuilder.from(api);
    case ComponentType.TextDisplay:
      return TextDisplayBuilder.from(api);
    case ComponentType.Section:
      return SectionBuilder.from(api);
    case ComponentType.MediaGallery:
      return MediaGalleryBuilder.from(api);
    case ComponentType.Separator:
      return SeparatorBuilder.from(api);
    case ComponentType.File:
      return FileBuilder.from(api);
    case ComponentType.Container:
      return ContainerBuilder.from(api);
    default:
      throw new Error(`unsupported top-level component type: ${(api as { type: number }).type}`);
  }
}

// ---------------------------------------------------------------------------
// Message (top-level container of the whole payload)
// ---------------------------------------------------------------------------

export class MessageV2Builder {
  private components: TopLevelBuilder[] = [];
  private flags: number = MessageFlags.IsComponentsV2;

  addComponents(...components: TopLevelBuilder[]): this {
    this.components.push(...components);
    return this;
  }
  setComponents(components: TopLevelBuilder[]): this {
    this.components = [...components];
    return this;
  }
  /** Add extra message flags. IsComponentsV2 is always kept set. */
  addFlags(...flags: number[]): this {
    for (const f of flags) this.flags |= f;
    return this;
  }
  /** Replace flags wholesale. IsComponentsV2 is force-enabled regardless. */
  setFlags(flags: number): this {
    this.flags = flags | MessageFlags.IsComponentsV2;
    return this;
  }
  setSpoilerSuppressNotifications(on = true): this {
    if (on) this.flags |= MessageFlags.SuppressNotifications;
    else this.flags &= ~MessageFlags.SuppressNotifications;
    return this;
  }

  /** EXPORT: the exact Discord API message payload `{ flags, components }`. */
  toJSON(): APIMessageComponentsV2Payload {
    return {
      flags: this.flags | MessageFlags.IsComponentsV2,
      components: this.components.map((c) => c.toJSON() as APITopLevelComponent),
    };
  }

  /** Alias of `toJSON()` — pass directly to channel.send / interaction.reply. */
  toDiscordPayload(): APIMessageComponentsV2Payload {
    return this.toJSON();
  }

  validate(): ValidationResult {
    return validateMessage(this.toJSON());
  }

  /** SERIALIZE to a portable, versioned JSON document (for draft storage). */
  serialize(): SerializedDocumentV2 {
    const payload = this.toJSON();
    return { version: 1, flags: payload.flags, components: payload.components };
  }

  toString(): string {
    return JSON.stringify(this.serialize());
  }

  // ----- import paths -----

  /** IMPORT from a raw Discord API payload (e.g. a fetched message). */
  static fromAPI(payload: Partial<APIMessageComponentsV2Payload>): MessageV2Builder {
    const b = new MessageV2Builder();
    if (typeof payload.flags === 'number') b.flags = payload.flags | MessageFlags.IsComponentsV2;
    b.components = (payload.components || []).map((c) => topLevelBuilderFrom(c));
    return b;
  }

  /** DESERIALIZE from a `serialize()` document or its JSON string. */
  static deserialize(doc: SerializedDocumentV2 | string): MessageV2Builder {
    const parsed: SerializedDocumentV2 = typeof doc === 'string' ? JSON.parse(doc) : doc;
    return MessageV2Builder.fromAPI({ flags: parsed.flags, components: parsed.components });
  }
}
