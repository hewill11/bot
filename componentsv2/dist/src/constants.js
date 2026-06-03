"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_URL_SCHEME = exports.MEDIA_URL_SCHEMES = exports.LIMITS = void 0;
/**
 * Hard limits enforced by Discord for Components V2 messages.
 * Sources: Discord component reference + message resource docs.
 */
exports.LIMITS = {
    /** Max total components in a message, counting nested components. */
    MESSAGE_MAX_TOTAL_COMPONENTS: 40,
    /** Max top-level components in a message. */
    MESSAGE_MAX_TOP_LEVEL: 40,
    /** Combined character budget across all Text Display components. */
    MESSAGE_MAX_TEXT_CHARS: 4000,
    /** Buttons per Action Row. */
    ACTION_ROW_MAX_BUTTONS: 5,
    BUTTON_LABEL_MAX: 80,
    BUTTON_URL_MAX: 512,
    /** custom_id length applies to buttons and selects. */
    CUSTOM_ID_MIN: 1,
    CUSTOM_ID_MAX: 100,
    SELECT_PLACEHOLDER_MAX: 150,
    SELECT_OPTIONS_MAX: 25,
    SELECT_OPTION_LABEL_MAX: 100,
    SELECT_OPTION_VALUE_MAX: 100,
    SELECT_OPTION_DESC_MAX: 100,
    SELECT_MIN_VALUES_FLOOR: 0,
    SELECT_VALUES_MAX: 25,
    SECTION_MIN_TEXT: 1,
    SECTION_MAX_TEXT: 3,
    MEDIA_GALLERY_MIN: 1,
    MEDIA_GALLERY_MAX: 10,
    MEDIA_DESCRIPTION_MAX: 1024,
    ACCENT_COLOR_MIN: 0x000000,
    ACCENT_COLOR_MAX: 0xffffff,
    /** Max numeric component id (signed 32-bit). */
    COMPONENT_ID_MAX: 2 ** 31 - 1,
};
/** Schemes accepted by a generic unfurled media url. */
exports.MEDIA_URL_SCHEMES = ['https://', 'attachment://'];
/** The File component only accepts attachment references. */
exports.FILE_URL_SCHEME = 'attachment://';
//# sourceMappingURL=constants.js.map