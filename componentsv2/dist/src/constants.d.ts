/**
 * Hard limits enforced by Discord for Components V2 messages.
 * Sources: Discord component reference + message resource docs.
 */
export declare const LIMITS: {
    /** Max total components in a message, counting nested components. */
    readonly MESSAGE_MAX_TOTAL_COMPONENTS: 40;
    /** Max top-level components in a message. */
    readonly MESSAGE_MAX_TOP_LEVEL: 40;
    /** Combined character budget across all Text Display components. */
    readonly MESSAGE_MAX_TEXT_CHARS: 4000;
    /** Buttons per Action Row. */
    readonly ACTION_ROW_MAX_BUTTONS: 5;
    readonly BUTTON_LABEL_MAX: 80;
    readonly BUTTON_URL_MAX: 512;
    /** custom_id length applies to buttons and selects. */
    readonly CUSTOM_ID_MIN: 1;
    readonly CUSTOM_ID_MAX: 100;
    readonly SELECT_PLACEHOLDER_MAX: 150;
    readonly SELECT_OPTIONS_MAX: 25;
    readonly SELECT_OPTION_LABEL_MAX: 100;
    readonly SELECT_OPTION_VALUE_MAX: 100;
    readonly SELECT_OPTION_DESC_MAX: 100;
    readonly SELECT_MIN_VALUES_FLOOR: 0;
    readonly SELECT_VALUES_MAX: 25;
    readonly SECTION_MIN_TEXT: 1;
    readonly SECTION_MAX_TEXT: 3;
    readonly MEDIA_GALLERY_MIN: 1;
    readonly MEDIA_GALLERY_MAX: 10;
    readonly MEDIA_DESCRIPTION_MAX: 1024;
    readonly ACCENT_COLOR_MIN: 0;
    readonly ACCENT_COLOR_MAX: 16777215;
    /** Max numeric component id (signed 32-bit). */
    readonly COMPONENT_ID_MAX: number;
};
/** Schemes accepted by a generic unfurled media url. */
export declare const MEDIA_URL_SCHEMES: readonly ["https://", "attachment://"];
/** The File component only accepts attachment references. */
export declare const FILE_URL_SCHEME = "attachment://";
//# sourceMappingURL=constants.d.ts.map