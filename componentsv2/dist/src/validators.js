"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateComponent = validateComponent;
exports.countComponents = countComponents;
exports.countTextChars = countTextChars;
exports.validateMessage = validateMessage;
/**
 * Validators for Components V2.
 *
 * All validators operate on the API JSON shape (the output of `builder.toJSON()`
 * or freshly imported Discord JSON), so they work for both locally-built and
 * imported messages. Each returns a {@link ValidationResult}; nothing throws,
 * which lets a UI surface every problem at once.
 */
const constants_1 = require("./constants");
const types_1 = require("./types");
class Ctx {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }
    err(path, message) {
        this.errors.push({ path, message });
    }
    warn(path, message) {
        this.warnings.push({ path, message });
    }
    result() {
        return { ok: this.errors.length === 0, errors: this.errors, warnings: this.warnings };
    }
}
function checkId(ctx, c, path) {
    if (c.id === undefined)
        return;
    if (!Number.isInteger(c.id) || c.id < 0 || c.id > constants_1.LIMITS.COMPONENT_ID_MAX) {
        ctx.err(`${path}.id`, `id must be an integer 0..${constants_1.LIMITS.COMPONENT_ID_MAX}`);
    }
}
function checkMedia(ctx, media, path, attachmentOnly = false) {
    if (!media || typeof media.url !== 'string' || media.url.length === 0) {
        ctx.err(`${path}.url`, 'media url is required');
        return;
    }
    if (attachmentOnly) {
        if (!media.url.startsWith(constants_1.FILE_URL_SCHEME)) {
            ctx.err(`${path}.url`, `File media must use the "${constants_1.FILE_URL_SCHEME}<filename>" scheme`);
        }
        return;
    }
    if (!constants_1.MEDIA_URL_SCHEMES.some((s) => media.url.startsWith(s))) {
        ctx.err(`${path}.url`, `media url must start with one of: ${constants_1.MEDIA_URL_SCHEMES.join(', ')}`);
    }
}
function checkCustomId(ctx, id, path) {
    if (typeof id !== 'string' || id.length < constants_1.LIMITS.CUSTOM_ID_MIN || id.length > constants_1.LIMITS.CUSTOM_ID_MAX) {
        ctx.err(`${path}.custom_id`, `custom_id must be ${constants_1.LIMITS.CUSTOM_ID_MIN}-${constants_1.LIMITS.CUSTOM_ID_MAX} chars`);
    }
}
function validateButton(ctx, b, path) {
    checkId(ctx, b, path);
    if (b.label !== undefined && b.label.length > constants_1.LIMITS.BUTTON_LABEL_MAX) {
        ctx.err(`${path}.label`, `label exceeds ${constants_1.LIMITS.BUTTON_LABEL_MAX} chars`);
    }
    switch (b.style) {
        case types_1.ButtonStyle.Primary:
        case types_1.ButtonStyle.Secondary:
        case types_1.ButtonStyle.Success:
        case types_1.ButtonStyle.Danger:
            checkCustomId(ctx, b.custom_id, path);
            if (b.url)
                ctx.err(`${path}.url`, 'non-link buttons cannot have a url');
            if (b.sku_id)
                ctx.err(`${path}.sku_id`, 'only premium buttons can have a sku_id');
            if (!b.label && !b.emoji)
                ctx.err(path, 'button needs a label or an emoji');
            break;
        case types_1.ButtonStyle.Link:
            if (!b.url || b.url.length === 0)
                ctx.err(`${path}.url`, 'link buttons require a url');
            else if (b.url.length > constants_1.LIMITS.BUTTON_URL_MAX)
                ctx.err(`${path}.url`, `url exceeds ${constants_1.LIMITS.BUTTON_URL_MAX} chars`);
            if (b.custom_id)
                ctx.err(`${path}.custom_id`, 'link buttons cannot have a custom_id');
            if (!b.label && !b.emoji)
                ctx.err(path, 'link button needs a label or an emoji');
            break;
        case types_1.ButtonStyle.Premium:
            if (!b.sku_id)
                ctx.err(`${path}.sku_id`, 'premium buttons require a sku_id');
            if (b.custom_id)
                ctx.err(`${path}.custom_id`, 'premium buttons cannot have a custom_id');
            if (b.url)
                ctx.err(`${path}.url`, 'premium buttons cannot have a url');
            if (b.label)
                ctx.err(`${path}.label`, 'premium buttons cannot have a label');
            if (b.emoji)
                ctx.err(`${path}.emoji`, 'premium buttons cannot have an emoji');
            break;
        default:
            ctx.err(`${path}.style`, `unknown button style: ${b.style}`);
    }
}
function validateSelect(ctx, s, path) {
    checkId(ctx, s, path);
    checkCustomId(ctx, s.custom_id, path);
    if (s.placeholder !== undefined && s.placeholder.length > constants_1.LIMITS.SELECT_PLACEHOLDER_MAX) {
        ctx.err(`${path}.placeholder`, `placeholder exceeds ${constants_1.LIMITS.SELECT_PLACEHOLDER_MAX} chars`);
    }
    const min = s.min_values;
    const max = s.max_values;
    if (min !== undefined && (min < constants_1.LIMITS.SELECT_MIN_VALUES_FLOOR || min > constants_1.LIMITS.SELECT_VALUES_MAX)) {
        ctx.err(`${path}.min_values`, `min_values must be ${constants_1.LIMITS.SELECT_MIN_VALUES_FLOOR}..${constants_1.LIMITS.SELECT_VALUES_MAX}`);
    }
    if (max !== undefined && (max < 1 || max > constants_1.LIMITS.SELECT_VALUES_MAX)) {
        ctx.err(`${path}.max_values`, `max_values must be 1..${constants_1.LIMITS.SELECT_VALUES_MAX}`);
    }
    if (min !== undefined && max !== undefined && min > max) {
        ctx.err(path, 'min_values cannot exceed max_values');
    }
    if (s.required !== undefined) {
        ctx.warn(`${path}.required`, 'required is modal-only and is ignored in messages');
    }
    if (s.type === types_1.ComponentType.StringSelect) {
        if (!Array.isArray(s.options) || s.options.length === 0) {
            ctx.err(`${path}.options`, 'string select needs at least 1 option');
        }
        else if (s.options.length > constants_1.LIMITS.SELECT_OPTIONS_MAX) {
            ctx.err(`${path}.options`, `string select allows at most ${constants_1.LIMITS.SELECT_OPTIONS_MAX} options`);
        }
        (s.options || []).forEach((opt, i) => {
            const op = `${path}.options[${i}]`;
            if (!opt.label || opt.label.length > constants_1.LIMITS.SELECT_OPTION_LABEL_MAX) {
                ctx.err(`${op}.label`, `option label is required and max ${constants_1.LIMITS.SELECT_OPTION_LABEL_MAX} chars`);
            }
            if (opt.value === undefined || opt.value.length > constants_1.LIMITS.SELECT_OPTION_VALUE_MAX) {
                ctx.err(`${op}.value`, `option value is required and max ${constants_1.LIMITS.SELECT_OPTION_VALUE_MAX} chars`);
            }
            if (opt.description !== undefined && opt.description.length > constants_1.LIMITS.SELECT_OPTION_DESC_MAX) {
                ctx.err(`${op}.description`, `option description max ${constants_1.LIMITS.SELECT_OPTION_DESC_MAX} chars`);
            }
        });
        if (max !== undefined && Array.isArray(s.options) && max > s.options.length) {
            ctx.err(`${path}.max_values`, 'max_values cannot exceed the number of options');
        }
    }
    else if (s.type === types_1.ComponentType.ChannelSelect) {
        if (s.channel_types && !Array.isArray(s.channel_types)) {
            ctx.err(`${path}.channel_types`, 'channel_types must be an array of channel type integers');
        }
    }
}
function validateTextDisplay(ctx, t, path) {
    checkId(ctx, t, path);
    if (typeof t.content !== 'string' || t.content.length === 0) {
        ctx.err(`${path}.content`, 'text display content is required');
    }
}
function validateThumbnail(ctx, t, path) {
    checkId(ctx, t, path);
    checkMedia(ctx, t.media, `${path}.media`);
    if (t.description != null && t.description.length > constants_1.LIMITS.MEDIA_DESCRIPTION_MAX) {
        ctx.err(`${path}.description`, `description max ${constants_1.LIMITS.MEDIA_DESCRIPTION_MAX} chars`);
    }
}
function validateSection(ctx, s, path) {
    checkId(ctx, s, path);
    const texts = s.components || [];
    if (texts.length < constants_1.LIMITS.SECTION_MIN_TEXT || texts.length > constants_1.LIMITS.SECTION_MAX_TEXT) {
        ctx.err(`${path}.components`, `section needs ${constants_1.LIMITS.SECTION_MIN_TEXT}-${constants_1.LIMITS.SECTION_MAX_TEXT} text displays`);
    }
    texts.forEach((t, i) => {
        if (t.type !== types_1.ComponentType.TextDisplay) {
            ctx.err(`${path}.components[${i}]`, 'section children must be Text Display components');
        }
        else {
            validateTextDisplay(ctx, t, `${path}.components[${i}]`);
        }
    });
    if (!s.accessory) {
        ctx.err(`${path}.accessory`, 'section requires an accessory');
    }
    else if (s.accessory.type === types_1.ComponentType.Thumbnail) {
        validateThumbnail(ctx, s.accessory, `${path}.accessory`);
    }
    else if (s.accessory.type === types_1.ComponentType.Button) {
        validateButton(ctx, s.accessory, `${path}.accessory`);
    }
    else {
        ctx.err(`${path}.accessory`, 'accessory must be a Thumbnail or a Button');
    }
}
function validateMediaGallery(ctx, g, path) {
    checkId(ctx, g, path);
    const items = g.items || [];
    if (items.length < constants_1.LIMITS.MEDIA_GALLERY_MIN || items.length > constants_1.LIMITS.MEDIA_GALLERY_MAX) {
        ctx.err(`${path}.items`, `media gallery needs ${constants_1.LIMITS.MEDIA_GALLERY_MIN}-${constants_1.LIMITS.MEDIA_GALLERY_MAX} items`);
    }
    items.forEach((it, i) => {
        checkMedia(ctx, it.media, `${path}.items[${i}].media`);
        if (it.description != null && it.description.length > constants_1.LIMITS.MEDIA_DESCRIPTION_MAX) {
            ctx.err(`${path}.items[${i}].description`, `description max ${constants_1.LIMITS.MEDIA_DESCRIPTION_MAX} chars`);
        }
    });
}
function validateFile(ctx, f, path) {
    checkId(ctx, f, path);
    checkMedia(ctx, f.file, `${path}.file`, /* attachmentOnly */ true);
}
function validateSeparator(ctx, s, path) {
    checkId(ctx, s, path);
    if (s.spacing !== undefined && s.spacing !== 1 && s.spacing !== 2) {
        ctx.err(`${path}.spacing`, 'spacing must be 1 (small) or 2 (large)');
    }
}
function validateActionRow(ctx, row, path) {
    checkId(ctx, row, path);
    const children = row.components || [];
    if (children.length === 0) {
        ctx.err(`${path}.components`, 'action row cannot be empty');
        return;
    }
    const hasSelect = children.some((c) => c.type !== types_1.ComponentType.Button);
    if (hasSelect) {
        if (children.length !== 1) {
            ctx.err(`${path}.components`, 'an action row with a select menu must contain exactly that one select');
        }
        const sel = children[0];
        validateSelect(ctx, sel, `${path}.components[0]`);
    }
    else {
        if (children.length > constants_1.LIMITS.ACTION_ROW_MAX_BUTTONS) {
            ctx.err(`${path}.components`, `action row allows at most ${constants_1.LIMITS.ACTION_ROW_MAX_BUTTONS} buttons`);
        }
        children.forEach((b, i) => validateButton(ctx, b, `${path}.components[${i}]`));
    }
}
function validateContainer(ctx, c, path) {
    checkId(ctx, c, path);
    if (c.accent_color != null && (c.accent_color < constants_1.LIMITS.ACCENT_COLOR_MIN || c.accent_color > constants_1.LIMITS.ACCENT_COLOR_MAX)) {
        ctx.err(`${path}.accent_color`, 'accent_color must be 0x000000..0xFFFFFF');
    }
    const children = c.components || [];
    if (children.length === 0)
        ctx.err(`${path}.components`, 'container cannot be empty');
    children.forEach((child, i) => {
        const cp = `${path}.components[${i}]`;
        switch (child.type) {
            case types_1.ComponentType.ActionRow:
                validateActionRow(ctx, child, cp);
                break;
            case types_1.ComponentType.TextDisplay:
                validateTextDisplay(ctx, child, cp);
                break;
            case types_1.ComponentType.Section:
                validateSection(ctx, child, cp);
                break;
            case types_1.ComponentType.MediaGallery:
                validateMediaGallery(ctx, child, cp);
                break;
            case types_1.ComponentType.Separator:
                validateSeparator(ctx, child, cp);
                break;
            case types_1.ComponentType.File:
                validateFile(ctx, child, cp);
                break;
            default:
                ctx.err(cp, `containers cannot hold component type ${child.type}`);
        }
    });
}
/** Validate a single component subtree (any depth). */
function validateComponent(component, path = 'component') {
    const ctx = new Ctx();
    dispatch(ctx, component, path, /* topLevel */ false);
    return ctx.result();
}
function dispatch(ctx, component, path, topLevel) {
    switch (component.type) {
        case types_1.ComponentType.ActionRow:
            validateActionRow(ctx, component, path);
            break;
        case types_1.ComponentType.TextDisplay:
            validateTextDisplay(ctx, component, path);
            break;
        case types_1.ComponentType.Section:
            validateSection(ctx, component, path);
            break;
        case types_1.ComponentType.MediaGallery:
            validateMediaGallery(ctx, component, path);
            break;
        case types_1.ComponentType.Separator:
            validateSeparator(ctx, component, path);
            break;
        case types_1.ComponentType.File:
            validateFile(ctx, component, path);
            break;
        case types_1.ComponentType.Container:
            validateContainer(ctx, component, path);
            break;
        default:
            if (topLevel) {
                ctx.err(path, `component type ${component.type} is not allowed at the top level`);
            }
            else if (component.type === types_1.ComponentType.Thumbnail) {
                validateThumbnail(ctx, component, path);
            }
            else if (component.type === types_1.ComponentType.Button) {
                validateButton(ctx, component, path);
            }
            else {
                validateSelect(ctx, component, path);
            }
    }
}
/** Recursively count every component node (nested components included). */
function countComponents(components) {
    let n = 0;
    for (const c of components) {
        n += 1;
        if (c.type === types_1.ComponentType.ActionRow)
            n += c.components.length;
        else if (c.type === types_1.ComponentType.Container)
            n += countComponents(c.components);
        else if (c.type === types_1.ComponentType.Section) {
            n += c.components.length;
            if (c.accessory)
                n += 1;
        }
    }
    return n;
}
/** Sum characters across every Text Display in the tree. */
function countTextChars(components) {
    let total = 0;
    for (const c of components) {
        if (c.type === types_1.ComponentType.TextDisplay)
            total += c.content?.length ?? 0;
        else if (c.type === types_1.ComponentType.Container)
            total += countTextChars(c.components);
        else if (c.type === types_1.ComponentType.Section)
            total += countTextChars(c.components);
    }
    return total;
}
/**
 * Validate a complete Components V2 message payload: the IsComponentsV2 flag,
 * forbidden coexisting fields, the 40-component cap, the 4000-char cap, and the
 * full component tree.
 */
function validateMessage(payload) {
    const ctx = new Ctx();
    if ((payload.flags & types_1.MessageFlags.IsComponentsV2) === 0) {
        ctx.err('flags', `IsComponentsV2 (${types_1.MessageFlags.IsComponentsV2}) flag must be set`);
    }
    const forbidden = payload;
    for (const key of ['content', 'embeds', 'poll', 'stickers', 'sticker_ids']) {
        if (forbidden[key] != null) {
            ctx.err(key, `Components V2 messages cannot include "${key}"`);
        }
    }
    const components = payload.components || [];
    if (components.length === 0) {
        ctx.err('components', 'a Components V2 message needs at least one component');
    }
    if (components.length > constants_1.LIMITS.MESSAGE_MAX_TOP_LEVEL) {
        ctx.err('components', `at most ${constants_1.LIMITS.MESSAGE_MAX_TOP_LEVEL} top-level components`);
    }
    const total = countComponents(components);
    if (total > constants_1.LIMITS.MESSAGE_MAX_TOTAL_COMPONENTS) {
        ctx.err('components', `message has ${total} components; max is ${constants_1.LIMITS.MESSAGE_MAX_TOTAL_COMPONENTS} (nested included)`);
    }
    const chars = countTextChars(components);
    if (chars > constants_1.LIMITS.MESSAGE_MAX_TEXT_CHARS) {
        ctx.err('components', `text content is ${chars} chars; max is ${constants_1.LIMITS.MESSAGE_MAX_TEXT_CHARS}`);
    }
    components.forEach((c, i) => dispatch(ctx, c, `components[${i}]`, /* topLevel */ true));
    return ctx.result();
}
//# sourceMappingURL=validators.js.map