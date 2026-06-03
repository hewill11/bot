/**
 * Discord Components V2 (Display Components) — type model.
 *
 * Every interface here mirrors the EXACT shape Discord's API expects/returns
 * (snake_case, numeric `type` discriminators). The builder classes in
 * `builders.ts` produce these objects via `.toJSON()`, and reconstruct them via
 * the static `.from()` methods.
 *
 * Reference: https://docs.discord.com/developers/components/reference
 */
/** Numeric component type discriminators used by the Discord API. */
export declare enum ComponentType {
    ActionRow = 1,
    Button = 2,
    StringSelect = 3,
    /** Legacy text input — modal only, kept for completeness. */
    TextInput = 4,
    UserSelect = 5,
    RoleSelect = 6,
    MentionableSelect = 7,
    ChannelSelect = 8,
    Section = 9,
    TextDisplay = 10,
    Thumbnail = 11,
    MediaGallery = 12,
    File = 13,
    Separator = 14,
    Container = 17,
    /** Modal-only container associating a label with a component. */
    Label = 18,
    /** Modal-only file upload input. */
    FileUpload = 19
}
/** Button visual styles. Each style dictates which fields are required. */
export declare enum ButtonStyle {
    Primary = 1,
    Secondary = 2,
    Success = 3,
    Danger = 4,
    /** Link buttons: require `url`, must NOT have `custom_id`. */
    Link = 5,
    /** Premium buttons: require `sku_id`, must NOT have label/url/emoji/custom_id. */
    Premium = 6
}
/** Vertical padding size for a Separator. */
export declare enum SeparatorSpacing {
    Small = 1,
    Large = 2
}
/** Entity type referenced by an auto-populated select default value. */
export type SelectDefaultValueType = 'user' | 'role' | 'channel';
/**
 * Message flags relevant to Components V2.
 * `IsComponentsV2` (1 << 15 === 32768) MUST be set to send display components.
 */
export declare const MessageFlags: {
    /** 1 << 15 === 32768. Opt the message into Components V2. */
    readonly IsComponentsV2: number;
    /** 1 << 6 — suppress the link embeds normally generated from message content. */
    readonly SuppressEmbeds: number;
    /** 1 << 12 — suppress @mention notifications. */
    readonly SuppressNotifications: number;
};
/** Partial emoji object used by buttons and select options. */
export interface APIPartialEmoji {
    /** Custom emoji snowflake id, or null/omitted for a unicode emoji. */
    id?: string | null;
    /** Unicode character (e.g. "🔥") or custom emoji name. */
    name?: string | null;
    /** Whether the custom emoji is animated. */
    animated?: boolean;
}
/**
 * Unfurled media item. When SENDING you only need `url`, which may be either an
 * `https://` URL or an `attachment://<filename>` reference. The remaining fields
 * are populated by Discord on the RESPONSE and are read-only.
 */
export interface APIUnfurledMediaItem {
    /** `https://...` or `attachment://<filename>`. */
    url: string;
    proxy_url?: string;
    height?: number | null;
    width?: number | null;
    content_type?: string;
    loading_state?: number;
    attachment_id?: string;
}
/** Base shared by every component. `id` is an optional 32-bit identifier. */
export interface APIBaseComponent {
    type: ComponentType;
    /** Optional caller-defined numeric identifier (1..2^31-1). Auto-assigned by Discord if omitted. */
    id?: number;
}
export interface APIButtonComponent extends APIBaseComponent {
    type: ComponentType.Button;
    style: ButtonStyle;
    /** Max 80 chars. Not allowed on premium buttons. */
    label?: string;
    emoji?: APIPartialEmoji;
    /** 1-100 chars. Required for styles 1-4; forbidden on link/premium. */
    custom_id?: string;
    /** Required for premium (style 6) buttons. */
    sku_id?: string;
    /** Max 512 chars. Required for link (style 5) buttons. */
    url?: string;
    disabled?: boolean;
}
export interface APISelectOption {
    /** User-facing label; max 100 chars. */
    label: string;
    /** Developer value; max 100 chars. */
    value: string;
    /** Max 100 chars. */
    description?: string;
    emoji?: APIPartialEmoji;
    /** Pre-select this option. */
    default?: boolean;
}
export interface APISelectDefaultValue {
    /** Snowflake of a user, role, or channel. */
    id: string;
    type: SelectDefaultValueType;
}
export interface APIStringSelectComponent extends APIBaseComponent {
    type: ComponentType.StringSelect;
    /** 1-100 chars. */
    custom_id: string;
    /** Max 25 options. */
    options: APISelectOption[];
    /** Max 150 chars. */
    placeholder?: string;
    /** 0..25 (see required note). */
    min_values?: number;
    /** 1..25. */
    max_values?: number;
    /** Modal-only. Ignored in messages. */
    required?: boolean;
    /** Message-only. */
    disabled?: boolean;
}
/** Shared shape for the four auto-populated selects (user/role/mentionable/channel). */
export interface APIAutoPopulatedSelectBase extends APIBaseComponent {
    custom_id: string;
    placeholder?: string;
    default_values?: APISelectDefaultValue[];
    min_values?: number;
    max_values?: number;
    required?: boolean;
    disabled?: boolean;
}
export interface APIUserSelectComponent extends APIAutoPopulatedSelectBase {
    type: ComponentType.UserSelect;
}
export interface APIRoleSelectComponent extends APIAutoPopulatedSelectBase {
    type: ComponentType.RoleSelect;
}
export interface APIMentionableSelectComponent extends APIAutoPopulatedSelectBase {
    type: ComponentType.MentionableSelect;
}
export interface APIChannelSelectComponent extends APIAutoPopulatedSelectBase {
    type: ComponentType.ChannelSelect;
    /** Restrict selectable channels to these channel types. */
    channel_types?: number[];
}
export type APISelectMenuComponent = APIStringSelectComponent | APIUserSelectComponent | APIRoleSelectComponent | APIMentionableSelectComponent | APIChannelSelectComponent;
export type APIActionRowChild = APIButtonComponent | APISelectMenuComponent;
export interface APIActionRowComponent extends APIBaseComponent {
    type: ComponentType.ActionRow;
    /** Up to 5 buttons OR exactly one select menu. */
    components: APIActionRowChild[];
}
export interface APITextDisplayComponent extends APIBaseComponent {
    type: ComponentType.TextDisplay;
    /** Markdown text. Counts toward the 4000-char message budget. */
    content: string;
}
export interface APIThumbnailComponent extends APIBaseComponent {
    type: ComponentType.Thumbnail;
    media: APIUnfurledMediaItem;
    /** Alt text; max 1024 chars. */
    description?: string | null;
    spoiler?: boolean;
}
export type APISectionAccessory = APIThumbnailComponent | APIButtonComponent;
export interface APISectionComponent extends APIBaseComponent {
    type: ComponentType.Section;
    /** 1-3 Text Display components. */
    components: APITextDisplayComponent[];
    /** A Thumbnail or a Button. */
    accessory: APISectionAccessory;
}
export interface APIMediaGalleryItem {
    media: APIUnfurledMediaItem;
    /** Alt text; max 1024 chars. */
    description?: string | null;
    spoiler?: boolean;
}
export interface APIMediaGalleryComponent extends APIBaseComponent {
    type: ComponentType.MediaGallery;
    /** 1-10 items. */
    items: APIMediaGalleryItem[];
}
export interface APIFileComponent extends APIBaseComponent {
    type: ComponentType.File;
    /** Only `attachment://<filename>` is supported here. */
    file: APIUnfurledMediaItem;
    spoiler?: boolean;
    /** Response-only. */
    name?: string;
    /** Response-only. */
    size?: number;
}
export interface APISeparatorComponent extends APIBaseComponent {
    type: ComponentType.Separator;
    /** Show a visual divider line. Defaults to true. */
    divider?: boolean;
    /** Padding size. Defaults to Small (1). */
    spacing?: SeparatorSpacing;
}
export type APIContainerChild = APIActionRowComponent | APITextDisplayComponent | APISectionComponent | APIMediaGalleryComponent | APISeparatorComponent | APIFileComponent;
export interface APIContainerComponent extends APIBaseComponent {
    type: ComponentType.Container;
    components: APIContainerChild[];
    /** RGB int 0x000000..0xFFFFFF, or null. */
    accent_color?: number | null;
    spoiler?: boolean;
}
/** Any component allowed at the top level of a Components V2 message. */
export type APITopLevelComponent = APIActionRowComponent | APITextDisplayComponent | APISectionComponent | APIMediaGalleryComponent | APISeparatorComponent | APIFileComponent | APIContainerComponent;
/** Union of every component this library models. */
export type APIComponentV2 = APITopLevelComponent | APIThumbnailComponent | APIButtonComponent | APISelectMenuComponent;
/** The message payload Discord expects for a Components V2 message. */
export interface APIMessageComponentsV2Payload {
    /** Must include MessageFlags.IsComponentsV2 (32768). */
    flags: number;
    components: APITopLevelComponent[];
}
/**
 * Portable serialization document produced by `MessageV2Builder.serialize()`.
 * It is plain JSON and round-trips through `deserialize()`.
 */
export interface SerializedDocumentV2 {
    /** Schema version of this document format. */
    version: 1;
    flags: number;
    components: APITopLevelComponent[];
}
//# sourceMappingURL=types.d.ts.map