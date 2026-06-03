"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageFlags = exports.SeparatorSpacing = exports.ButtonStyle = exports.ComponentType = void 0;
/** Numeric component type discriminators used by the Discord API. */
var ComponentType;
(function (ComponentType) {
    ComponentType[ComponentType["ActionRow"] = 1] = "ActionRow";
    ComponentType[ComponentType["Button"] = 2] = "Button";
    ComponentType[ComponentType["StringSelect"] = 3] = "StringSelect";
    /** Legacy text input — modal only, kept for completeness. */
    ComponentType[ComponentType["TextInput"] = 4] = "TextInput";
    ComponentType[ComponentType["UserSelect"] = 5] = "UserSelect";
    ComponentType[ComponentType["RoleSelect"] = 6] = "RoleSelect";
    ComponentType[ComponentType["MentionableSelect"] = 7] = "MentionableSelect";
    ComponentType[ComponentType["ChannelSelect"] = 8] = "ChannelSelect";
    ComponentType[ComponentType["Section"] = 9] = "Section";
    ComponentType[ComponentType["TextDisplay"] = 10] = "TextDisplay";
    ComponentType[ComponentType["Thumbnail"] = 11] = "Thumbnail";
    ComponentType[ComponentType["MediaGallery"] = 12] = "MediaGallery";
    ComponentType[ComponentType["File"] = 13] = "File";
    ComponentType[ComponentType["Separator"] = 14] = "Separator";
    ComponentType[ComponentType["Container"] = 17] = "Container";
    /** Modal-only container associating a label with a component. */
    ComponentType[ComponentType["Label"] = 18] = "Label";
    /** Modal-only file upload input. */
    ComponentType[ComponentType["FileUpload"] = 19] = "FileUpload";
})(ComponentType || (exports.ComponentType = ComponentType = {}));
/** Button visual styles. Each style dictates which fields are required. */
var ButtonStyle;
(function (ButtonStyle) {
    ButtonStyle[ButtonStyle["Primary"] = 1] = "Primary";
    ButtonStyle[ButtonStyle["Secondary"] = 2] = "Secondary";
    ButtonStyle[ButtonStyle["Success"] = 3] = "Success";
    ButtonStyle[ButtonStyle["Danger"] = 4] = "Danger";
    /** Link buttons: require `url`, must NOT have `custom_id`. */
    ButtonStyle[ButtonStyle["Link"] = 5] = "Link";
    /** Premium buttons: require `sku_id`, must NOT have label/url/emoji/custom_id. */
    ButtonStyle[ButtonStyle["Premium"] = 6] = "Premium";
})(ButtonStyle || (exports.ButtonStyle = ButtonStyle = {}));
/** Vertical padding size for a Separator. */
var SeparatorSpacing;
(function (SeparatorSpacing) {
    SeparatorSpacing[SeparatorSpacing["Small"] = 1] = "Small";
    SeparatorSpacing[SeparatorSpacing["Large"] = 2] = "Large";
})(SeparatorSpacing || (exports.SeparatorSpacing = SeparatorSpacing = {}));
/**
 * Message flags relevant to Components V2.
 * `IsComponentsV2` (1 << 15 === 32768) MUST be set to send display components.
 */
exports.MessageFlags = {
    /** 1 << 15 === 32768. Opt the message into Components V2. */
    IsComponentsV2: 1 << 15,
    /** 1 << 6 — suppress the link embeds normally generated from message content. */
    SuppressEmbeds: 1 << 2,
    /** 1 << 12 — suppress @mention notifications. */
    SuppressNotifications: 1 << 12,
};
//# sourceMappingURL=types.js.map