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
import { ButtonStyle, ComponentType, SeparatorSpacing, type APIActionRowComponent, type APIButtonComponent, type APIChannelSelectComponent, type APIContainerChild, type APIContainerComponent, type APIFileComponent, type APIMediaGalleryComponent, type APIMediaGalleryItem, type APIMentionableSelectComponent, type APIMessageComponentsV2Payload, type APIPartialEmoji, type APIRoleSelectComponent, type APISectionComponent, type APISelectDefaultValue, type APISelectMenuComponent, type APISelectOption, type APISeparatorComponent, type APITextDisplayComponent, type APIThumbnailComponent, type APITopLevelComponent, type APIUnfurledMediaItem, type APIUserSelectComponent, type SerializedDocumentV2 } from './types';
import { type ValidationResult } from './validators';
/** Base for builders that carry an optional numeric `id`. */
declare abstract class BaseBuilder {
    protected _id?: number;
    /** Set the optional component id. */
    setId(id: number | undefined): this;
    abstract toJSON(): unknown;
}
export declare class UnfurledMediaBuilder {
    private data;
    constructor(url?: string);
    setURL(url: string): this;
    toJSON(): APIUnfurledMediaItem;
    static from(api: APIUnfurledMediaItem | string): UnfurledMediaBuilder;
}
export declare class ButtonBuilder extends BaseBuilder {
    private style;
    private label?;
    private emoji?;
    private customId?;
    private skuId?;
    private url?;
    private disabled?;
    setStyle(style: ButtonStyle): this;
    setLabel(label: string): this;
    setEmoji(emoji: string | APIPartialEmoji): this;
    setCustomId(id: string): this;
    /** Convenience: build a link button in one call. */
    setURL(url: string): this;
    setSKUId(skuId: string): this;
    setDisabled(disabled?: boolean): this;
    toJSON(): APIButtonComponent;
    static from(api: APIButtonComponent): ButtonBuilder;
}
/** Shortcut factory for a link button. */
export declare function linkButton(url: string, label: string, emoji?: string | APIPartialEmoji): ButtonBuilder;
export declare class SelectOptionBuilder {
    private data;
    constructor(label?: string, value?: string);
    setLabel(label: string): this;
    setValue(value: string): this;
    setDescription(description: string): this;
    setEmoji(emoji: string | APIPartialEmoji): this;
    setDefault(isDefault?: boolean): this;
    toJSON(): APISelectOption;
    static from(api: APISelectOption): SelectOptionBuilder;
}
declare abstract class BaseSelectBuilder extends BaseBuilder {
    protected customId: string;
    protected placeholder?: string;
    protected minValues?: number;
    protected maxValues?: number;
    protected disabled?: boolean;
    setCustomId(id: string): this;
    setPlaceholder(text: string): this;
    setMinValues(n: number): this;
    setMaxValues(n: number): this;
    setDisabled(disabled?: boolean): this;
    protected baseJSON(): {
        id: number | undefined;
        custom_id: string;
        placeholder: string | undefined;
        min_values: number | undefined;
        max_values: number | undefined;
        disabled: boolean | undefined;
    };
    protected applyBase(api: APISelectMenuComponent): void;
}
export declare class StringSelectBuilder extends BaseSelectBuilder {
    private options;
    addOptions(...opts: (SelectOptionBuilder | APISelectOption)[]): this;
    setOptions(opts: (SelectOptionBuilder | APISelectOption)[]): this;
    toJSON(): APIStringSelectComponentJSON;
    static from(api: import('./types').APIStringSelectComponent): StringSelectBuilder;
}
type APIStringSelectComponentJSON = import('./types').APIStringSelectComponent;
declare abstract class AutoSelectBuilder extends BaseSelectBuilder {
    protected defaultValues?: APISelectDefaultValue[];
    addDefaultValues(...values: APISelectDefaultValue[]): this;
    protected autoJSON(type: ComponentType): {
        default_values: APISelectDefaultValue[] | undefined;
        id: number | undefined;
        custom_id: string;
        placeholder: string | undefined;
        min_values: number | undefined;
        max_values: number | undefined;
        disabled: boolean | undefined;
        type: ComponentType;
    };
    protected applyAuto(api: APIUserSelectComponent | APIRoleSelectComponent | APIMentionableSelectComponent | APIChannelSelectComponent): void;
}
export declare class UserSelectBuilder extends AutoSelectBuilder {
    toJSON(): APIUserSelectComponent;
    static from(api: APIUserSelectComponent): UserSelectBuilder;
}
export declare class RoleSelectBuilder extends AutoSelectBuilder {
    toJSON(): APIRoleSelectComponent;
    static from(api: APIRoleSelectComponent): RoleSelectBuilder;
}
export declare class MentionableSelectBuilder extends AutoSelectBuilder {
    toJSON(): APIMentionableSelectComponent;
    static from(api: APIMentionableSelectComponent): MentionableSelectBuilder;
}
export declare class ChannelSelectBuilder extends AutoSelectBuilder {
    private channelTypes?;
    setChannelTypes(...types: number[]): this;
    toJSON(): APIChannelSelectComponent;
    static from(api: APIChannelSelectComponent): ChannelSelectBuilder;
}
export type AnySelectBuilder = StringSelectBuilder | UserSelectBuilder | RoleSelectBuilder | MentionableSelectBuilder | ChannelSelectBuilder;
export declare function selectBuilderFrom(api: APISelectMenuComponent): AnySelectBuilder;
export declare class ActionRowBuilder extends BaseBuilder {
    private buttons;
    private select?;
    addButtons(...buttons: ButtonBuilder[]): this;
    setSelect(select: AnySelectBuilder): this;
    toJSON(): APIActionRowComponent;
    static from(api: APIActionRowComponent): ActionRowBuilder;
}
export declare class TextDisplayBuilder extends BaseBuilder {
    private content;
    constructor(content?: string);
    setContent(content: string): this;
    toJSON(): APITextDisplayComponent;
    static from(api: APITextDisplayComponent): TextDisplayBuilder;
}
export declare class ThumbnailBuilder extends BaseBuilder {
    private media;
    private description?;
    private spoiler?;
    setURL(url: string): this;
    setMedia(media: APIUnfurledMediaItem | UnfurledMediaBuilder): this;
    setDescription(description: string | null): this;
    setSpoiler(spoiler?: boolean): this;
    toJSON(): APIThumbnailComponent;
    static from(api: APIThumbnailComponent): ThumbnailBuilder;
}
export declare class SectionBuilder extends BaseBuilder {
    private texts;
    private accessory?;
    addText(...texts: (TextDisplayBuilder | string)[]): this;
    setThumbnailAccessory(thumb: ThumbnailBuilder): this;
    setButtonAccessory(button: ButtonBuilder): this;
    toJSON(): APISectionComponent;
    static from(api: APISectionComponent): SectionBuilder;
}
export declare class MediaGalleryBuilder extends BaseBuilder {
    private items;
    addItems(...items: (APIMediaGalleryItem | {
        url: string;
        description?: string | null;
        spoiler?: boolean;
    })[]): this;
    toJSON(): APIMediaGalleryComponent;
    static from(api: APIMediaGalleryComponent): MediaGalleryBuilder;
}
export declare class FileBuilder extends BaseBuilder {
    private file;
    private spoiler?;
    /** `url` must be `attachment://<filename>`. */
    setURL(url: string): this;
    setSpoiler(spoiler?: boolean): this;
    toJSON(): APIFileComponent;
    static from(api: APIFileComponent): FileBuilder;
}
export declare class SeparatorBuilder extends BaseBuilder {
    private divider?;
    private spacing?;
    setDivider(divider: boolean): this;
    setSpacing(spacing: SeparatorSpacing): this;
    toJSON(): APISeparatorComponent;
    static from(api: APISeparatorComponent): SeparatorBuilder;
}
export type ContainerChildBuilder = ActionRowBuilder | TextDisplayBuilder | SectionBuilder | MediaGalleryBuilder | SeparatorBuilder | FileBuilder;
export declare class ContainerBuilder extends BaseBuilder {
    private children;
    private accentColor?;
    private spoiler?;
    addComponents(...children: ContainerChildBuilder[]): this;
    setAccentColor(color: number | null): this;
    setSpoiler(spoiler?: boolean): this;
    toJSON(): APIContainerComponent;
    static from(api: APIContainerComponent): ContainerBuilder;
}
export type TopLevelBuilder = ActionRowBuilder | TextDisplayBuilder | SectionBuilder | MediaGalleryBuilder | SeparatorBuilder | FileBuilder | ContainerBuilder;
/** Reconstruct the appropriate builder from any top-level / container API component. */
export declare function topLevelBuilderFrom(api: APITopLevelComponent | APIContainerChild): TopLevelBuilder;
export declare class MessageV2Builder {
    private components;
    private flags;
    addComponents(...components: TopLevelBuilder[]): this;
    setComponents(components: TopLevelBuilder[]): this;
    /** Add extra message flags. IsComponentsV2 is always kept set. */
    addFlags(...flags: number[]): this;
    /** Replace flags wholesale. IsComponentsV2 is force-enabled regardless. */
    setFlags(flags: number): this;
    setSpoilerSuppressNotifications(on?: boolean): this;
    /** EXPORT: the exact Discord API message payload `{ flags, components }`. */
    toJSON(): APIMessageComponentsV2Payload;
    /** Alias of `toJSON()` — pass directly to channel.send / interaction.reply. */
    toDiscordPayload(): APIMessageComponentsV2Payload;
    validate(): ValidationResult;
    /** SERIALIZE to a portable, versioned JSON document (for draft storage). */
    serialize(): SerializedDocumentV2;
    toString(): string;
    /** IMPORT from a raw Discord API payload (e.g. a fetched message). */
    static fromAPI(payload: Partial<APIMessageComponentsV2Payload>): MessageV2Builder;
    /** DESERIALIZE from a `serialize()` document or its JSON string. */
    static deserialize(doc: SerializedDocumentV2 | string): MessageV2Builder;
}
export {};
//# sourceMappingURL=builders.d.ts.map