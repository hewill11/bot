/**
 * Validators for Components V2.
 *
 * All validators operate on the API JSON shape (the output of `builder.toJSON()`
 * or freshly imported Discord JSON), so they work for both locally-built and
 * imported messages. Each returns a {@link ValidationResult}; nothing throws,
 * which lets a UI surface every problem at once.
 */
import { LIMITS, MEDIA_URL_SCHEMES, FILE_URL_SCHEME } from './constants';
import {
  ComponentType,
  ButtonStyle,
  MessageFlags,
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIComponentV2,
  type APIContainerComponent,
  type APIFileComponent,
  type APIMediaGalleryComponent,
  type APIMessageComponentsV2Payload,
  type APISectionComponent,
  type APISelectMenuComponent,
  type APISeparatorComponent,
  type APITextDisplayComponent,
  type APIThumbnailComponent,
  type APIUnfurledMediaItem,
} from './types';

export interface ValidationIssue {
  /** Dot/bracket path to the offending node, e.g. `components[0].accessory`. */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  /** Non-fatal advisories (e.g. fields Discord ignores in messages). */
  warnings: ValidationIssue[];
}

class Ctx {
  errors: ValidationIssue[] = [];
  warnings: ValidationIssue[] = [];
  err(path: string, message: string) {
    this.errors.push({ path, message });
  }
  warn(path: string, message: string) {
    this.warnings.push({ path, message });
  }
  result(): ValidationResult {
    return { ok: this.errors.length === 0, errors: this.errors, warnings: this.warnings };
  }
}

function checkId(ctx: Ctx, c: { id?: number }, path: string) {
  if (c.id === undefined) return;
  if (!Number.isInteger(c.id) || c.id < 0 || c.id > LIMITS.COMPONENT_ID_MAX) {
    ctx.err(`${path}.id`, `id must be an integer 0..${LIMITS.COMPONENT_ID_MAX}`);
  }
}

function checkMedia(ctx: Ctx, media: APIUnfurledMediaItem | undefined, path: string, attachmentOnly = false) {
  if (!media || typeof media.url !== 'string' || media.url.length === 0) {
    ctx.err(`${path}.url`, 'media url is required');
    return;
  }
  if (attachmentOnly) {
    if (!media.url.startsWith(FILE_URL_SCHEME)) {
      ctx.err(`${path}.url`, `File media must use the "${FILE_URL_SCHEME}<filename>" scheme`);
    }
    return;
  }
  if (!MEDIA_URL_SCHEMES.some((s) => media.url.startsWith(s))) {
    ctx.err(`${path}.url`, `media url must start with one of: ${MEDIA_URL_SCHEMES.join(', ')}`);
  }
}

function checkCustomId(ctx: Ctx, id: string | undefined, path: string) {
  if (typeof id !== 'string' || id.length < LIMITS.CUSTOM_ID_MIN || id.length > LIMITS.CUSTOM_ID_MAX) {
    ctx.err(`${path}.custom_id`, `custom_id must be ${LIMITS.CUSTOM_ID_MIN}-${LIMITS.CUSTOM_ID_MAX} chars`);
  }
}

function validateButton(ctx: Ctx, b: APIButtonComponent, path: string) {
  checkId(ctx, b, path);
  if (b.label !== undefined && b.label.length > LIMITS.BUTTON_LABEL_MAX) {
    ctx.err(`${path}.label`, `label exceeds ${LIMITS.BUTTON_LABEL_MAX} chars`);
  }
  switch (b.style) {
    case ButtonStyle.Primary:
    case ButtonStyle.Secondary:
    case ButtonStyle.Success:
    case ButtonStyle.Danger:
      checkCustomId(ctx, b.custom_id, path);
      if (b.url) ctx.err(`${path}.url`, 'non-link buttons cannot have a url');
      if (b.sku_id) ctx.err(`${path}.sku_id`, 'only premium buttons can have a sku_id');
      if (!b.label && !b.emoji) ctx.err(path, 'button needs a label or an emoji');
      break;
    case ButtonStyle.Link:
      if (!b.url || b.url.length === 0) ctx.err(`${path}.url`, 'link buttons require a url');
      else if (b.url.length > LIMITS.BUTTON_URL_MAX) ctx.err(`${path}.url`, `url exceeds ${LIMITS.BUTTON_URL_MAX} chars`);
      if (b.custom_id) ctx.err(`${path}.custom_id`, 'link buttons cannot have a custom_id');
      if (!b.label && !b.emoji) ctx.err(path, 'link button needs a label or an emoji');
      break;
    case ButtonStyle.Premium:
      if (!b.sku_id) ctx.err(`${path}.sku_id`, 'premium buttons require a sku_id');
      if (b.custom_id) ctx.err(`${path}.custom_id`, 'premium buttons cannot have a custom_id');
      if (b.url) ctx.err(`${path}.url`, 'premium buttons cannot have a url');
      if (b.label) ctx.err(`${path}.label`, 'premium buttons cannot have a label');
      if (b.emoji) ctx.err(`${path}.emoji`, 'premium buttons cannot have an emoji');
      break;
    default:
      ctx.err(`${path}.style`, `unknown button style: ${(b as APIButtonComponent).style}`);
  }
}

function validateSelect(ctx: Ctx, s: APISelectMenuComponent, path: string) {
  checkId(ctx, s, path);
  checkCustomId(ctx, s.custom_id, path);
  if (s.placeholder !== undefined && s.placeholder.length > LIMITS.SELECT_PLACEHOLDER_MAX) {
    ctx.err(`${path}.placeholder`, `placeholder exceeds ${LIMITS.SELECT_PLACEHOLDER_MAX} chars`);
  }
  const min = s.min_values;
  const max = s.max_values;
  if (min !== undefined && (min < LIMITS.SELECT_MIN_VALUES_FLOOR || min > LIMITS.SELECT_VALUES_MAX)) {
    ctx.err(`${path}.min_values`, `min_values must be ${LIMITS.SELECT_MIN_VALUES_FLOOR}..${LIMITS.SELECT_VALUES_MAX}`);
  }
  if (max !== undefined && (max < 1 || max > LIMITS.SELECT_VALUES_MAX)) {
    ctx.err(`${path}.max_values`, `max_values must be 1..${LIMITS.SELECT_VALUES_MAX}`);
  }
  if (min !== undefined && max !== undefined && min > max) {
    ctx.err(path, 'min_values cannot exceed max_values');
  }
  if (s.required !== undefined) {
    ctx.warn(`${path}.required`, 'required is modal-only and is ignored in messages');
  }

  if (s.type === ComponentType.StringSelect) {
    if (!Array.isArray(s.options) || s.options.length === 0) {
      ctx.err(`${path}.options`, 'string select needs at least 1 option');
    } else if (s.options.length > LIMITS.SELECT_OPTIONS_MAX) {
      ctx.err(`${path}.options`, `string select allows at most ${LIMITS.SELECT_OPTIONS_MAX} options`);
    }
    (s.options || []).forEach((opt, i) => {
      const op = `${path}.options[${i}]`;
      if (!opt.label || opt.label.length > LIMITS.SELECT_OPTION_LABEL_MAX) {
        ctx.err(`${op}.label`, `option label is required and max ${LIMITS.SELECT_OPTION_LABEL_MAX} chars`);
      }
      if (opt.value === undefined || opt.value.length > LIMITS.SELECT_OPTION_VALUE_MAX) {
        ctx.err(`${op}.value`, `option value is required and max ${LIMITS.SELECT_OPTION_VALUE_MAX} chars`);
      }
      if (opt.description !== undefined && opt.description.length > LIMITS.SELECT_OPTION_DESC_MAX) {
        ctx.err(`${op}.description`, `option description max ${LIMITS.SELECT_OPTION_DESC_MAX} chars`);
      }
    });
    if (max !== undefined && Array.isArray(s.options) && max > s.options.length) {
      ctx.err(`${path}.max_values`, 'max_values cannot exceed the number of options');
    }
  } else if (s.type === ComponentType.ChannelSelect) {
    if (s.channel_types && !Array.isArray(s.channel_types)) {
      ctx.err(`${path}.channel_types`, 'channel_types must be an array of channel type integers');
    }
  }
}

function validateTextDisplay(ctx: Ctx, t: APITextDisplayComponent, path: string) {
  checkId(ctx, t, path);
  if (typeof t.content !== 'string' || t.content.length === 0) {
    ctx.err(`${path}.content`, 'text display content is required');
  }
}

function validateThumbnail(ctx: Ctx, t: APIThumbnailComponent, path: string) {
  checkId(ctx, t, path);
  checkMedia(ctx, t.media, `${path}.media`);
  if (t.description != null && t.description.length > LIMITS.MEDIA_DESCRIPTION_MAX) {
    ctx.err(`${path}.description`, `description max ${LIMITS.MEDIA_DESCRIPTION_MAX} chars`);
  }
}

function validateSection(ctx: Ctx, s: APISectionComponent, path: string) {
  checkId(ctx, s, path);
  const texts = s.components || [];
  if (texts.length < LIMITS.SECTION_MIN_TEXT || texts.length > LIMITS.SECTION_MAX_TEXT) {
    ctx.err(`${path}.components`, `section needs ${LIMITS.SECTION_MIN_TEXT}-${LIMITS.SECTION_MAX_TEXT} text displays`);
  }
  texts.forEach((t, i) => {
    if (t.type !== ComponentType.TextDisplay) {
      ctx.err(`${path}.components[${i}]`, 'section children must be Text Display components');
    } else {
      validateTextDisplay(ctx, t, `${path}.components[${i}]`);
    }
  });
  if (!s.accessory) {
    ctx.err(`${path}.accessory`, 'section requires an accessory');
  } else if (s.accessory.type === ComponentType.Thumbnail) {
    validateThumbnail(ctx, s.accessory, `${path}.accessory`);
  } else if (s.accessory.type === ComponentType.Button) {
    validateButton(ctx, s.accessory, `${path}.accessory`);
  } else {
    ctx.err(`${path}.accessory`, 'accessory must be a Thumbnail or a Button');
  }
}

function validateMediaGallery(ctx: Ctx, g: APIMediaGalleryComponent, path: string) {
  checkId(ctx, g, path);
  const items = g.items || [];
  if (items.length < LIMITS.MEDIA_GALLERY_MIN || items.length > LIMITS.MEDIA_GALLERY_MAX) {
    ctx.err(`${path}.items`, `media gallery needs ${LIMITS.MEDIA_GALLERY_MIN}-${LIMITS.MEDIA_GALLERY_MAX} items`);
  }
  items.forEach((it, i) => {
    checkMedia(ctx, it.media, `${path}.items[${i}].media`);
    if (it.description != null && it.description.length > LIMITS.MEDIA_DESCRIPTION_MAX) {
      ctx.err(`${path}.items[${i}].description`, `description max ${LIMITS.MEDIA_DESCRIPTION_MAX} chars`);
    }
  });
}

function validateFile(ctx: Ctx, f: APIFileComponent, path: string) {
  checkId(ctx, f, path);
  checkMedia(ctx, f.file, `${path}.file`, /* attachmentOnly */ true);
}

function validateSeparator(ctx: Ctx, s: APISeparatorComponent, path: string) {
  checkId(ctx, s, path);
  if (s.spacing !== undefined && s.spacing !== 1 && s.spacing !== 2) {
    ctx.err(`${path}.spacing`, 'spacing must be 1 (small) or 2 (large)');
  }
}

function validateActionRow(ctx: Ctx, row: APIActionRowComponent, path: string) {
  checkId(ctx, row, path);
  const children = row.components || [];
  if (children.length === 0) {
    ctx.err(`${path}.components`, 'action row cannot be empty');
    return;
  }
  const hasSelect = children.some((c) => c.type !== ComponentType.Button);
  if (hasSelect) {
    if (children.length !== 1) {
      ctx.err(`${path}.components`, 'an action row with a select menu must contain exactly that one select');
    }
    const sel = children[0] as APISelectMenuComponent;
    validateSelect(ctx, sel, `${path}.components[0]`);
  } else {
    if (children.length > LIMITS.ACTION_ROW_MAX_BUTTONS) {
      ctx.err(`${path}.components`, `action row allows at most ${LIMITS.ACTION_ROW_MAX_BUTTONS} buttons`);
    }
    children.forEach((b, i) => validateButton(ctx, b as APIButtonComponent, `${path}.components[${i}]`));
  }
}

function validateContainer(ctx: Ctx, c: APIContainerComponent, path: string) {
  checkId(ctx, c, path);
  if (c.accent_color != null && (c.accent_color < LIMITS.ACCENT_COLOR_MIN || c.accent_color > LIMITS.ACCENT_COLOR_MAX)) {
    ctx.err(`${path}.accent_color`, 'accent_color must be 0x000000..0xFFFFFF');
  }
  const children = c.components || [];
  if (children.length === 0) ctx.err(`${path}.components`, 'container cannot be empty');
  children.forEach((child, i) => {
    const cp = `${path}.components[${i}]`;
    switch (child.type) {
      case ComponentType.ActionRow:
        validateActionRow(ctx, child, cp);
        break;
      case ComponentType.TextDisplay:
        validateTextDisplay(ctx, child, cp);
        break;
      case ComponentType.Section:
        validateSection(ctx, child, cp);
        break;
      case ComponentType.MediaGallery:
        validateMediaGallery(ctx, child, cp);
        break;
      case ComponentType.Separator:
        validateSeparator(ctx, child, cp);
        break;
      case ComponentType.File:
        validateFile(ctx, child, cp);
        break;
      default:
        ctx.err(cp, `containers cannot hold component type ${(child as APIComponentV2).type}`);
    }
  });
}

/** Validate a single component subtree (any depth). */
export function validateComponent(component: APIComponentV2, path = 'component'): ValidationResult {
  const ctx = new Ctx();
  dispatch(ctx, component, path, /* topLevel */ false);
  return ctx.result();
}

function dispatch(ctx: Ctx, component: APIComponentV2, path: string, topLevel: boolean) {
  switch (component.type) {
    case ComponentType.ActionRow:
      validateActionRow(ctx, component, path);
      break;
    case ComponentType.TextDisplay:
      validateTextDisplay(ctx, component, path);
      break;
    case ComponentType.Section:
      validateSection(ctx, component, path);
      break;
    case ComponentType.MediaGallery:
      validateMediaGallery(ctx, component, path);
      break;
    case ComponentType.Separator:
      validateSeparator(ctx, component, path);
      break;
    case ComponentType.File:
      validateFile(ctx, component, path);
      break;
    case ComponentType.Container:
      validateContainer(ctx, component, path);
      break;
    default:
      if (topLevel) {
        ctx.err(path, `component type ${component.type} is not allowed at the top level`);
      } else if (component.type === ComponentType.Thumbnail) {
        validateThumbnail(ctx, component, path);
      } else if (component.type === ComponentType.Button) {
        validateButton(ctx, component, path);
      } else {
        validateSelect(ctx, component as APISelectMenuComponent, path);
      }
  }
}

/** Recursively count every component node (nested components included). */
export function countComponents(components: APIComponentV2[]): number {
  let n = 0;
  for (const c of components) {
    n += 1;
    if (c.type === ComponentType.ActionRow) n += c.components.length;
    else if (c.type === ComponentType.Container) n += countComponents(c.components);
    else if (c.type === ComponentType.Section) {
      n += c.components.length;
      if (c.accessory) n += 1;
    }
  }
  return n;
}

/** Sum characters across every Text Display in the tree. */
export function countTextChars(components: APIComponentV2[]): number {
  let total = 0;
  for (const c of components) {
    if (c.type === ComponentType.TextDisplay) total += c.content?.length ?? 0;
    else if (c.type === ComponentType.Container) total += countTextChars(c.components);
    else if (c.type === ComponentType.Section) total += countTextChars(c.components);
  }
  return total;
}

/**
 * Validate a complete Components V2 message payload: the IsComponentsV2 flag,
 * forbidden coexisting fields, the 40-component cap, the 4000-char cap, and the
 * full component tree.
 */
export function validateMessage(payload: APIMessageComponentsV2Payload): ValidationResult {
  const ctx = new Ctx();

  if ((payload.flags & MessageFlags.IsComponentsV2) === 0) {
    ctx.err('flags', `IsComponentsV2 (${MessageFlags.IsComponentsV2}) flag must be set`);
  }
  const forbidden = payload as unknown as Record<string, unknown>;
  for (const key of ['content', 'embeds', 'poll', 'stickers', 'sticker_ids']) {
    if (forbidden[key] != null) {
      ctx.err(key, `Components V2 messages cannot include "${key}"`);
    }
  }

  const components = payload.components || [];
  if (components.length === 0) {
    ctx.err('components', 'a Components V2 message needs at least one component');
  }
  if (components.length > LIMITS.MESSAGE_MAX_TOP_LEVEL) {
    ctx.err('components', `at most ${LIMITS.MESSAGE_MAX_TOP_LEVEL} top-level components`);
  }

  const total = countComponents(components as APIComponentV2[]);
  if (total > LIMITS.MESSAGE_MAX_TOTAL_COMPONENTS) {
    ctx.err('components', `message has ${total} components; max is ${LIMITS.MESSAGE_MAX_TOTAL_COMPONENTS} (nested included)`);
  }
  const chars = countTextChars(components as APIComponentV2[]);
  if (chars > LIMITS.MESSAGE_MAX_TEXT_CHARS) {
    ctx.err('components', `text content is ${chars} chars; max is ${LIMITS.MESSAGE_MAX_TEXT_CHARS}`);
  }

  components.forEach((c, i) => dispatch(ctx, c as APIComponentV2, `components[${i}]`, /* topLevel */ true));

  return ctx.result();
}
