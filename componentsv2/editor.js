/**
 * Интерактивный конструктор Discord Components V2.
 *
 * Повторяет UX вашего конструктора /embed (панель + кнопки + модалки), но строит
 * сообщения Components V2 (Display Components) поверх библиотеки ./dist/src.
 * EmbedBuilder не используется нигде. Черновик хранится в JSON и автосохраняется
 * после каждой модалки — окно можно закрывать и открывать снова через команду.
 *
 * Подключение в index.js — минимальное:
 *
 *   const componentsV2Editor = require('./componentsv2/editor');
 *   componentsV2Editor.ensureStore();
 *   // ...в обработчике interactionCreate, в самом начале try:
 *   if (await componentsV2Editor.handleInteraction(interaction, client)) return;
 *
 * А в deploy-commands.js добавить команды:
 *   ...componentsV2Editor.commandData,
 */
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
} = require('discord.js');

const v2 = require('./dist/src');
const {
    ensureComponentsV2DraftStoreFile,
    getComponentsV2Draft,
    saveComponentsV2Draft,
    patchComponentsV2Draft,
    deleteComponentsV2Draft,
} = require('../storage/componentsV2DraftsStore');

const T = v2.ComponentType; // 1,2,3,5,6,7,8,9,10,11,12,13,14,17
const IS_V2 = v2.MessageFlags.IsComponentsV2; // 32768

// ---------------------------------------------------------------------------
// Идентификаторы
// ---------------------------------------------------------------------------
const COMMAND_NAMES = new Set(['componentsv2', 'компоненты', 'cv2']);
const PREFIX = 'cv2_';
const MODAL_PREFIX = 'cv2_modal:';

const BTN = {
    EDIT: `${PREFIX}edit`,
    UP: `${PREFIX}up`,
    DOWN: `${PREFIX}down`,
    DELETE: `${PREFIX}del`,
    ENTER: `${PREFIX}enter`,
    BACK: `${PREFIX}back`,
    TARGET: `${PREFIX}target`,
    PREVIEW: `${PREFIX}preview`,
    SEND: `${PREFIX}send`,
    RESET: `${PREFIX}reset`,
};
const SEL = {
    ADD: `${PREFIX}add`,
    PICK: `${PREFIX}pick`,
};

// Виды компонентов, которыми оперирует редактор
const KIND = {
    TEXT: 'text',
    SEP: 'sep',
    SECTION: 'section',
    GALLERY: 'gallery',
    FILE: 'file',
    ROWBTN: 'rowbtn',
    ROWSEL: 'rowsel',
    CONTAINER: 'container',
};

const STYLE_BY_NAME = { primary: 1, secondary: 2, success: 3, danger: 4, синяя: 1, серая: 2, зелёная: 3, зеленая: 3, красная: 4 };
const STYLE_NAME = { 1: 'primary', 2: 'secondary', 3: 'success', 4: 'danger', 5: 'link' };

// ---------------------------------------------------------------------------
// Команда (для deploy-commands.js)
// ---------------------------------------------------------------------------
const commandData = [
    new SlashCommandBuilder()
        .setName('componentsv2')
        .setDescription('Открыть конструктор Components V2 (Display Components) с автосохранением черновика')
        .addChannelOption((o) => o.setName('channel').setDescription('Канал, тред или forum для отправки (по умолчанию текущий)').setRequired(false))
        .addStringOption((o) => o.setName('message_id').setDescription('ID или ссылка на сообщение бота для редактирования').setRequired(false)),
    new SlashCommandBuilder()
        .setName('компоненты')
        .setDescription('Открыть конструктор Components V2 (Display Components)')
        .addChannelOption((o) => o.setName('channel').setDescription('Канал, тред или forum для отправки').setRequired(false))
        .addStringOption((o) => o.setName('message_id').setDescription('ID или ссылка на сообщение бота для редактирования').setRequired(false)),
].map((c) => c.toJSON());

// ---------------------------------------------------------------------------
// Мелкие helpers (изолированы от index.js)
// ---------------------------------------------------------------------------
function hasStaffRole(interaction) {
    return Boolean(interaction.member?.roles?.cache?.has(process.env.STAFF_ROLE_ID));
}
async function replyEphemeral(interaction, content) {
    const payload = { content, flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
        return;
    }
    await interaction.reply(payload).catch(() => {});
}
function trunc(value, max) {
    const s = String(value ?? '');
    return s.length <= max ? s : `${s.slice(0, Math.max(max - 1, 0))}…`;
}
function clean(s) {
    if (typeof s !== 'string') return '';
    return s.trim();
}
function parseBool(value, fallback) {
    const s = clean(value).toLowerCase();
    if (!s) return fallback;
    if (['yes', 'true', '1', 'on', 'да', 'y', 'д'].includes(s)) return true;
    if (['no', 'false', '0', 'off', 'нет', 'n', 'н'].includes(s)) return false;
    return fallback;
}
function isHttp(url) {
    return /^https?:\/\/\S+$/i.test(clean(url));
}
function isAttachment(url) {
    return /^attachment:\/\/\S+$/i.test(clean(url));
}
function parseHexColor(value) {
    const s = clean(value).replace(/^#/, '');
    if (!s) return null;
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return undefined; // undefined = ошибка формата
    return parseInt(s, 16);
}
function isStandardMessageChannel(channel) {
    return Boolean(channel?.isTextBased?.() && 'send' in channel);
}
function isForumChannel(channel) {
    return channel?.type === ChannelType.GuildForum;
}
function isThreadChannel(channel) {
    return typeof channel?.isThread === 'function' && channel.isThread();
}
function isTargetChannel(channel) {
    return isStandardMessageChannel(channel) || isForumChannel(channel);
}
// "id", "#mention", "<#id>", ссылка discord.com/channels/g/c[/m]
function parseDiscordTarget(value) {
    const s = clean(value);
    if (!s) return {};
    const link = s.match(/channels\/(\d+|@me)\/(\d+)(?:\/(\d+))?/);
    if (link) return { channelId: link[2], messageId: link[3] || null };
    const mention = s.match(/^<#(\d+)>$/);
    if (mention) return { channelId: mention[1], messageId: null };
    if (/^\d+$/.test(s)) return { channelId: s, messageId: s };
    return {};
}

// ---------------------------------------------------------------------------
// Доступ к "текущему уровню" дерева (корень либо внутри контейнера)
// ---------------------------------------------------------------------------
function currentList(draft) {
    if (draft.cursor === null || draft.cursor === undefined) return draft.components;
    const container = draft.components[draft.cursor];
    if (container && container.type === T.Container) return container.components;
    return draft.components;
}
function insideContainer(draft) {
    return draft.cursor !== null && draft.cursor !== undefined && draft.components[draft.cursor]?.type === T.Container;
}

// Дефолтные «пустые» компоненты для добавления
function makeDefault(kind) {
    switch (kind) {
        case KIND.TEXT: return { type: T.TextDisplay, content: '' };
        case KIND.SEP: return { type: T.Separator, divider: true, spacing: 1 };
        case KIND.SECTION: return { type: T.Section, components: [{ type: T.TextDisplay, content: '' }], accessory: { type: T.Thumbnail, media: { url: '' } } };
        case KIND.GALLERY: return { type: T.MediaGallery, items: [] };
        case KIND.FILE: return { type: T.File, file: { url: '' } };
        case KIND.ROWBTN: return { type: T.ActionRow, components: [] };
        case KIND.ROWSEL: return { type: T.ActionRow, components: [{ type: T.StringSelect, custom_id: 'select_1', options: [] }] };
        case KIND.CONTAINER: return { type: T.Container, components: [], accent_color: null };
        default: return null;
    }
}
function kindOf(component) {
    switch (component.type) {
        case T.TextDisplay: return KIND.TEXT;
        case T.Separator: return KIND.SEP;
        case T.Section: return KIND.SECTION;
        case T.MediaGallery: return KIND.GALLERY;
        case T.File: return KIND.FILE;
        case T.Container: return KIND.CONTAINER;
        case T.ActionRow:
            return component.components[0] && component.components[0].type !== T.Button ? KIND.ROWSEL : KIND.ROWBTN;
        default: return null;
    }
}
function typeTitle(component) {
    switch (component.type) {
        case T.TextDisplay: return 'Text Display';
        case T.Separator: return 'Separator';
        case T.Section: return 'Section';
        case T.MediaGallery: return 'Media Gallery';
        case T.File: return 'File';
        case T.Container: return 'Container';
        case T.ActionRow: return kindOf(component) === KIND.ROWSEL ? 'ActionRow · Select' : 'ActionRow · Buttons';
        default: return `type ${component.type}`;
    }
}
function summarize(component) {
    switch (component.type) {
        case T.TextDisplay: return component.content ? `"${trunc(component.content, 50)}"` : '(пусто)';
        case T.Separator: return `${component.spacing === 2 ? 'большой' : 'малый'}${component.divider === false ? ', без линии' : ''}`;
        case T.Section: {
            const acc = component.accessory?.type === T.Button ? 'кнопка' : 'thumbnail';
            return `${component.components.length} текст., аксессуар: ${acc}`;
        }
        case T.MediaGallery: return `${component.items.length} медиа`;
        case T.File: return component.file?.url || '(нет файла)';
        case T.Container: return `${component.components.length} внутри${component.accent_color != null ? ', с цветом' : ''}`;
        case T.ActionRow:
            return kindOf(component) === KIND.ROWSEL
                ? `select "${component.components[0]?.custom_id || ''}"`
                : `${component.components.length} кнопк.`;
        default: return '';
    }
}

// ---------------------------------------------------------------------------
// Рендер панели управления (сама панель — тоже Components V2, без EmbedBuilder)
// ---------------------------------------------------------------------------
function buildStatusText(draft, notice) {
    const list = currentList(draft);
    const validation = v2.validateMessage({ flags: draft.flags | IS_V2, components: draft.components });
    const lines = [];
    lines.push('## Конструктор Components V2');
    if (notice) lines.push(`> ${notice}`);
    lines.push('');
    lines.push(`Канал: ${draft.channelId ? `<#${draft.channelId}>` : 'не выбран'}`);
    lines.push(`Режим: ${draft.messageId ? `редактирование \`${draft.messageId}\`` : 'новое сообщение'}`);
    lines.push(`Уровень: ${insideContainer(draft) ? `внутри контейнера #${draft.cursor + 1}` : 'корень'}`);
    lines.push(`Валидация: ${validation.ok ? '✅ ок' : `❌ ${validation.errors.length} — ${trunc(validation.errors[0]?.message || '', 80)}`}`);
    lines.push('');
    if (!list.length) {
        lines.push('_Компонентов нет. Добавьте первый через меню «➕ Добавить»._');
    } else {
        lines.push('Компоненты этого уровня:');
        list.forEach((c, i) => {
            const mark = draft.selected === i ? '➤' : `${i + 1}.`;
            lines.push(`${mark} **${typeTitle(c)}** — ${summarize(c)}`);
        });
    }
    return trunc(lines.join('\n'), 3900);
}

function buildAddSelect(draft) {
    const inside = insideContainer(draft);
    const opts = [
        new StringSelectMenuOptionBuilder().setLabel('Text Display').setValue(KIND.TEXT).setDescription('Markdown-текст'),
        new StringSelectMenuOptionBuilder().setLabel('Separator').setValue(KIND.SEP).setDescription('Разделитель / отступ'),
        new StringSelectMenuOptionBuilder().setLabel('Section').setValue(KIND.SECTION).setDescription('Текст + аксессуар (thumbnail/кнопка)'),
        new StringSelectMenuOptionBuilder().setLabel('Media Gallery').setValue(KIND.GALLERY).setDescription('1–10 изображений'),
        new StringSelectMenuOptionBuilder().setLabel('File').setValue(KIND.FILE).setDescription('attachment:// файл'),
        new StringSelectMenuOptionBuilder().setLabel('Ряд кнопок').setValue(KIND.ROWBTN).setDescription('ActionRow: до 5 кнопок / Link'),
        new StringSelectMenuOptionBuilder().setLabel('Ряд: Select-меню').setValue(KIND.ROWSEL).setDescription('ActionRow: string select'),
    ];
    if (!inside) {
        opts.push(new StringSelectMenuOptionBuilder().setLabel('Container').setValue(KIND.CONTAINER).setDescription('Группа компонентов + цвет'));
    }
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(SEL.ADD).setPlaceholder('➕ Добавить компонент').addOptions(opts),
    );
}

function buildPickSelect(draft) {
    const list = currentList(draft);
    const opts = list.slice(0, 25).map((c, i) =>
        new StringSelectMenuOptionBuilder()
            .setLabel(trunc(`#${i + 1} ${typeTitle(c)}`, 100))
            .setValue(String(i))
            .setDescription(trunc(summarize(c) || '—', 100))
            .setDefault(draft.selected === i),
    );
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(SEL.PICK).setPlaceholder('✏️ Выбрать компонент').addOptions(opts),
    );
}

function buildControlRows(draft) {
    const list = currentList(draft);
    const hasSel = draft.selected !== null && draft.selected !== undefined && list[draft.selected];
    const selected = hasSel ? list[draft.selected] : null;
    const isContainer = selected?.type === T.Container;

    const editRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BTN.EDIT).setLabel('Изменить').setStyle(ButtonStyle.Primary).setDisabled(!hasSel),
        new ButtonBuilder().setCustomId(BTN.UP).setLabel('Вверх').setStyle(ButtonStyle.Secondary).setDisabled(!hasSel || draft.selected === 0),
        new ButtonBuilder().setCustomId(BTN.DOWN).setLabel('Вниз').setStyle(ButtonStyle.Secondary).setDisabled(!hasSel || draft.selected >= list.length - 1),
        new ButtonBuilder().setCustomId(BTN.DELETE).setLabel('Удалить').setStyle(ButtonStyle.Danger).setDisabled(!hasSel),
        insideContainer(draft)
            ? new ButtonBuilder().setCustomId(BTN.BACK).setLabel('⬅ Назад').setStyle(ButtonStyle.Secondary)
            : new ButtonBuilder().setCustomId(BTN.ENTER).setLabel('Войти ▸').setStyle(ButtonStyle.Secondary).setDisabled(!isContainer),
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BTN.TARGET).setLabel('Канал').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(BTN.PREVIEW).setLabel('Предпросмотр').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(BTN.SEND).setLabel('Отправить').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(BTN.RESET).setLabel('Сбросить').setStyle(ButtonStyle.Danger),
    );

    return [editRow, actionRow];
}

// Панель = ephemeral Components V2 сообщение
function buildPanelPayload(draft, notice) {
    const list = currentList(draft);
    const components = [{ type: T.TextDisplay, content: buildStatusText(draft, notice) }, buildAddSelect(draft).toJSON()];
    if (list.length) components.push(buildPickSelect(draft).toJSON());
    for (const row of buildControlRows(draft)) components.push(row.toJSON());
    return { flags: MessageFlags.Ephemeral | IS_V2, components };
}

// ---------------------------------------------------------------------------
// Модалки
// ---------------------------------------------------------------------------
function ti(id, label, { value = '', style = TextInputStyle.Short, required = false, placeholder = '', max } = {}) {
    const input = new TextInputBuilder().setCustomId(id).setLabel(trunc(label, 45)).setStyle(style).setRequired(required);
    if (value) input.setValue(trunc(value, max || (style === TextInputStyle.Paragraph ? 4000 : 1000)));
    if (placeholder) input.setPlaceholder(trunc(placeholder, 100));
    if (max) input.setMaxLength(max);
    return new ActionRowBuilder().addComponents(input);
}

function buildModal(kind, component, mode) {
    const modal = new ModalBuilder().setCustomId(`${MODAL_PREFIX}${kind}:${mode}`);
    const c = component || {};
    switch (kind) {
        case KIND.TEXT:
            modal.setTitle('Text Display').addComponents(
                ti('content', 'Текст (markdown)', { value: c.content, style: TextInputStyle.Paragraph, required: true, max: 4000 }),
            );
            break;
        case KIND.SEP:
            modal.setTitle('Separator').addComponents(
                ti('divider', 'Линия-разделитель (да/нет)', { value: c.divider === false ? 'нет' : 'да', placeholder: 'да' }),
                ti('spacing', 'Отступ (small/large)', { value: c.spacing === 2 ? 'large' : 'small', placeholder: 'small' }),
            );
            break;
        case KIND.SECTION: {
            const texts = (c.components || []).map((t) => t.content || '');
            const acc = c.accessory;
            let accStr = '';
            if (acc?.type === T.Thumbnail) accStr = `thumb: ${acc.media?.url || ''}`;
            else if (acc?.type === T.Button) accStr = acc.style === 5 ? `btn: ${acc.label} | ${acc.url}` : `btn: ${acc.label} | ${acc.custom_id} | ${STYLE_NAME[acc.style] || 'secondary'}`;
            modal.setTitle('Section').addComponents(
                ti('text1', 'Текст 1', { value: texts[0] || '', style: TextInputStyle.Paragraph, required: true, max: 2000 }),
                ti('text2', 'Текст 2 (необязательно)', { value: texts[1] || '', style: TextInputStyle.Paragraph, max: 2000 }),
                ti('text3', 'Текст 3 (необязательно)', { value: texts[2] || '', style: TextInputStyle.Paragraph, max: 2000 }),
                ti('accessory', 'Аксессуар', { value: accStr, required: true, placeholder: 'thumb: https://... либо btn: Текст | https://...' }),
            );
            break;
        }
        case KIND.GALLERY: {
            const lines = (c.items || []).map((it) => [it.media?.url || '', it.description || '', it.spoiler ? 'spoiler' : ''].filter(Boolean).join(' | '));
            modal.setTitle('Media Gallery').addComponents(
                ti('items', 'Медиа (по строке: url | описание | spoiler)', {
                    value: lines.join('\n'),
                    style: TextInputStyle.Paragraph,
                    required: true,
                    placeholder: 'https://site/1.png | подпись\nhttps://site/2.png | | spoiler',
                }),
            );
            break;
        }
        case KIND.FILE:
            modal.setTitle('File').addComponents(
                ti('url', 'attachment://<имя файла>', { value: c.file?.url || '', required: true, placeholder: 'attachment://manual.pdf' }),
                ti('spoiler', 'Спойлер (да/нет)', { value: c.spoiler ? 'да' : 'нет', placeholder: 'нет' }),
            );
            break;
        case KIND.ROWBTN: {
            const lines = (c.components || []).map((b) =>
                b.style === 5 ? `${b.label} | ${b.url}` : `${b.label} | ${b.custom_id} | ${STYLE_NAME[b.style] || 'secondary'}`,
            );
            modal.setTitle('Ряд кнопок (до 5)').addComponents(
                ti('buttons', 'По строке на кнопку', {
                    value: lines.join('\n'),
                    style: TextInputStyle.Paragraph,
                    required: true,
                    placeholder: 'Магазин | https://shop\nКупить | buy_id | success',
                }),
            );
            break;
        }
        case KIND.ROWSEL: {
            const sel = c.components?.[0] || {};
            const optLines = (sel.options || []).map((o) => [o.label, o.value, o.description || ''].filter(Boolean).join(' | '));
            modal.setTitle('Select-меню').addComponents(
                ti('custom_id', 'custom_id', { value: sel.custom_id || '', required: true, placeholder: 'menu_id' }),
                ti('placeholder', 'Placeholder', { value: sel.placeholder || '' }),
                ti('minmax', 'min,max выбора', { value: `${sel.min_values ?? 1},${sel.max_values ?? 1}`, placeholder: '1,1' }),
                ti('options', 'Опции (label | value | описание)', {
                    value: optLines.join('\n'),
                    style: TextInputStyle.Paragraph,
                    required: true,
                    placeholder: 'Набор 1 | l1 | -10%\nНабор 2 | l2 | -20%',
                }),
            );
            break;
        }
        case KIND.CONTAINER:
            modal.setTitle('Container').addComponents(
                ti('accent', 'Цвет акцента (#RRGGBB, пусто = нет)', { value: c.accent_color != null ? `#${c.accent_color.toString(16).padStart(6, '0')}` : '', placeholder: '#F8E16C' }),
                ti('spoiler', 'Спойлер (да/нет)', { value: c.spoiler ? 'да' : 'нет', placeholder: 'нет' }),
            );
            break;
        case 'target':
            modal.setTitle('Канал назначения').addComponents(
                ti('channel', 'Канал (ID / #упоминание / ссылка)', { value: c.channelId || '', required: true }),
                ti('message_id', 'ID/ссылка сообщения для редактирования', { value: c.messageId || '' }),
                ti('forum_post_name', 'Название forum-поста (если форум)', { value: c.forumPostName || '' }),
            );
            break;
        default:
            return null;
    }
    return modal;
}

// ---------------------------------------------------------------------------
// Парсинг модалок -> объект компонента (или { error })
// ---------------------------------------------------------------------------
function parseAccessory(raw) {
    const s = clean(raw);
    if (!s) return { error: 'Секции нужен аксессуар: `thumb: <url>` или `btn: <текст> | <url|customId> [| style]`.' };
    if (/^thumb\s*:/i.test(s)) {
        const url = clean(s.replace(/^thumb\s*:/i, ''));
        if (!isHttp(url)) return { error: 'Для thumbnail нужен http(s) URL.' };
        return { value: { type: T.Thumbnail, media: { url } } };
    }
    if (/^btn\s*:/i.test(s)) {
        const parts = clean(s.replace(/^btn\s*:/i, '')).split('|').map((x) => x.trim());
        const label = parts[0];
        if (!label) return { error: 'Для кнопки-аксессуара нужен текст.' };
        const second = parts[1] || '';
        if (isHttp(second)) return { value: { type: T.Button, style: 5, label, url: second } };
        if (!second) return { error: 'Укажите URL (для link) или customId кнопки.' };
        const style = STYLE_BY_NAME[(parts[2] || 'secondary').toLowerCase()] || 2;
        return { value: { type: T.Button, style, label, custom_id: second } };
    }
    return { error: 'Аксессуар должен начинаться с `thumb:` или `btn:`.' };
}

function parseButtonsBlock(raw) {
    const lines = clean(raw).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { error: 'Добавьте хотя бы одну кнопку.' };
    if (lines.length > 5) return { error: 'В одном ряду максимум 5 кнопок.' };
    const buttons = [];
    for (const line of lines) {
        const parts = line.split('|').map((x) => x.trim());
        const label = parts[0];
        if (!label) return { error: `Пустой текст кнопки в строке: "${line}"` };
        const second = parts[1] || '';
        if (isHttp(second)) buttons.push({ type: T.Button, style: 5, label, url: second });
        else if (second) buttons.push({ type: T.Button, style: STYLE_BY_NAME[(parts[2] || 'secondary').toLowerCase()] || 2, label, custom_id: second });
        else return { error: `Кнопке "${label}" нужен URL (link) или customId.` };
    }
    return { value: buttons };
}

function parseGalleryBlock(raw) {
    const lines = clean(raw).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { error: 'Добавьте хотя бы одно медиа.' };
    if (lines.length > 10) return { error: 'В галерее максимум 10 медиа.' };
    const items = [];
    for (const line of lines) {
        const parts = line.split('|').map((x) => x.trim());
        const url = parts[0];
        if (!isHttp(url) && !isAttachment(url)) return { error: `Некорректный URL медиа: "${url}" (нужен http(s):// или attachment://).` };
        const item = { media: { url } };
        if (parts[1]) item.description = parts[1];
        if (/^spoiler$/i.test(parts[2] || '')) item.spoiler = true;
        items.push(item);
    }
    return { value: items };
}

function parseSelectOptions(raw) {
    const lines = clean(raw).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { error: 'Добавьте хотя бы одну опцию.' };
    if (lines.length > 25) return { error: 'В select максимум 25 опций.' };
    const options = [];
    for (const line of lines) {
        const parts = line.split('|').map((x) => x.trim());
        const label = parts[0];
        const value = parts[1] || parts[0];
        if (!label) return { error: `Пустая опция в строке: "${line}"` };
        const opt = { label, value };
        if (parts[2]) opt.description = parts[2];
        options.push(opt);
    }
    return { value: options };
}

// Возвращает { component } или { error }
function buildComponentFromModal(kind, interaction, previous) {
    const f = (id) => {
        try { return interaction.fields.getTextInputValue(id); } catch { return ''; }
    };
    switch (kind) {
        case KIND.TEXT: {
            const content = clean(f('content'));
            if (!content) return { error: 'Текст не может быть пустым.' };
            return { component: { type: T.TextDisplay, content } };
        }
        case KIND.SEP:
            return { component: { type: T.Separator, divider: parseBool(f('divider'), true), spacing: /large|больш/i.test(f('spacing')) ? 2 : 1 } };
        case KIND.SECTION: {
            const texts = [f('text1'), f('text2'), f('text3')].map(clean).filter(Boolean);
            if (!texts.length) return { error: 'Нужен хотя бы один текст в секции.' };
            if (texts.length > 3) return { error: 'В секции максимум 3 текста.' };
            const acc = parseAccessory(f('accessory'));
            if (acc.error) return { error: acc.error };
            return { component: { type: T.Section, components: texts.map((content) => ({ type: T.TextDisplay, content })), accessory: acc.value } };
        }
        case KIND.GALLERY: {
            const items = parseGalleryBlock(f('items'));
            if (items.error) return { error: items.error };
            return { component: { type: T.MediaGallery, items: items.value } };
        }
        case KIND.FILE: {
            const url = clean(f('url'));
            if (!isAttachment(url)) return { error: 'File принимает только `attachment://<имя файла>`.' };
            const out = { type: T.File, file: { url } };
            if (parseBool(f('spoiler'), false)) out.spoiler = true;
            return { component: out };
        }
        case KIND.ROWBTN: {
            const btns = parseButtonsBlock(f('buttons'));
            if (btns.error) return { error: btns.error };
            return { component: { type: T.ActionRow, components: btns.value } };
        }
        case KIND.ROWSEL: {
            const customId = clean(f('custom_id'));
            if (!customId) return { error: 'Укажите custom_id select-меню.' };
            const opts = parseSelectOptions(f('options'));
            if (opts.error) return { error: opts.error };
            const [minRaw, maxRaw] = clean(f('minmax')).split(',').map((x) => x.trim());
            const sel = { type: T.StringSelect, custom_id: customId, options: opts.value };
            const ph = clean(f('placeholder'));
            if (ph) sel.placeholder = ph;
            const min = Number.parseInt(minRaw, 10);
            const max = Number.parseInt(maxRaw, 10);
            if (Number.isFinite(min)) sel.min_values = min;
            if (Number.isFinite(max)) sel.max_values = max;
            return { component: { type: T.ActionRow, components: [sel] } };
        }
        case KIND.CONTAINER: {
            const accent = parseHexColor(f('accent'));
            if (accent === undefined) return { error: 'Цвет нужен в формате `#RRGGBB` или пустым.' };
            const out = { type: T.Container, components: previous?.components || [], accent_color: accent };
            if (parseBool(f('spoiler'), false)) out.spoiler = true;
            return { component: out };
        }
        default:
            return { error: 'Неизвестный тип компонента.' };
    }
}

// ---------------------------------------------------------------------------
// Публичная точка входа
// ---------------------------------------------------------------------------
function isComponentsV2Interaction(interaction) {
    if (interaction.isChatInputCommand?.()) return COMMAND_NAMES.has(interaction.commandName);
    if (interaction.isModalSubmit?.()) return interaction.customId.startsWith(MODAL_PREFIX);
    if (interaction.isButton?.()) return interaction.customId.startsWith(PREFIX);
    if (interaction.isStringSelectMenu?.()) return interaction.customId.startsWith(PREFIX);
    return false;
}

async function handleInteraction(interaction, client) {
    if (!isComponentsV2Interaction(interaction)) return false;

    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для работы с конструктором Components V2.');
        return true;
    }

    try {
        if (interaction.isChatInputCommand?.()) await handleCommand(interaction, client);
        else if (interaction.isModalSubmit?.()) await handleModal(interaction);
        else if (interaction.isStringSelectMenu?.()) await handleSelect(interaction);
        else if (interaction.isButton?.()) await handleButton(interaction, client);
    } catch (error) {
        console.error('Ошибка конструктора Components V2:', error);
        await replyEphemeral(interaction, 'Произошла ошибка в конструкторе Components V2.');
    }
    return true;
}

async function handleCommand(interaction, client) {
    const selectedChannel = interaction.options.getChannel('channel');
    let targetChannel = selectedChannel || interaction.channel;
    let messageIdInput = interaction.options.getString('message_id');

    if (!isTargetChannel(targetChannel)) {
        await replyEphemeral(interaction, 'Нужен текстовый канал, тред или форум.');
        return;
    }

    const continueDraft = !selectedChannel && !messageIdInput;
    const existing = continueDraft ? getComponentsV2Draft(interaction.user.id) : null;
    if (existing) {
        await interaction.reply({ ...buildPanelPayload(existing, 'Продолжаю ваш сохранённый черновик.') });
        return;
    }

    let components = [];
    let messageId = null;
    let flags = IS_V2;

    if (messageIdInput) {
        const target = parseDiscordTarget(messageIdInput);
        if (!selectedChannel && target.channelId) {
            targetChannel = await client.channels.fetch(target.channelId).catch(() => targetChannel);
        }
        messageId = target.messageId || (messageIdInput.includes('/') ? messageIdInput.split('/').pop().trim() : messageIdInput.trim());
        try {
            targetChannel.messages.cache.delete(messageId);
            const message = await targetChannel.messages.fetch(messageId);
            if (message.author.id !== client.user.id) {
                await replyEphemeral(interaction, 'Я могу редактировать только свои сообщения.');
                return;
            }
            // Импорт существующих Components V2 из сообщения
            const raw = message.components?.map((c) => (typeof c.toJSON === 'function' ? c.toJSON() : c)) || [];
            const imported = v2.MessageV2Builder.fromAPI({ flags: message.flags?.bitfield || IS_V2, components: raw });
            components = imported.toJSON().components;
            flags = (message.flags?.bitfield || 0) | IS_V2;
        } catch (error) {
            console.error(error);
            await replyEphemeral(interaction, 'Не удалось найти сообщение с таким ID в указанном канале.');
            return;
        }
    }

    const now = new Date().toISOString();
    const draft = saveComponentsV2Draft({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: targetChannel.id,
        messageId,
        forumPostName: '',
        flags,
        components,
        cursor: null,
        selected: null,
        createdAt: now,
        updatedAt: now,
    });

    await interaction.reply({ ...buildPanelPayload(draft, 'Черновик создан. Добавляйте компоненты по одному — всё автосохраняется.') });
}

function getDraftOr(interaction) {
    const draft = getComponentsV2Draft(interaction.user.id);
    if (!draft) return null;
    if (draft.selected === undefined) draft.selected = null;
    if (draft.cursor === undefined) draft.cursor = null;
    return draft;
}

async function handleSelect(interaction) {
    const draft = getDraftOr(interaction);
    if (!draft) { await replyEphemeral(interaction, 'Черновик не найден. Откройте `/componentsv2`.'); return; }

    if (interaction.customId === SEL.ADD) {
        const kind = interaction.values[0];
        const def = makeDefault(kind);
        if (!def) { await replyEphemeral(interaction, 'Неизвестный тип компонента.'); return; }
        const list = currentList(draft);
        list.push(def);
        draft.selected = list.length - 1;
        saveComponentsV2Draft(draft);
        // Separator валиден сразу — просто перерисуем; остальные открываем в модалке
        if (kind === KIND.SEP) {
            await interaction.update(buildPanelPayload(draft, 'Добавлен Separator.'));
        } else {
            await interaction.showModal(buildModal(kind, def, 'edit'));
        }
        return;
    }

    if (interaction.customId === SEL.PICK) {
        draft.selected = Number.parseInt(interaction.values[0], 10);
        saveComponentsV2Draft(draft);
        await interaction.update(buildPanelPayload(draft, null));
        return;
    }
}

async function handleButton(interaction, client) {
    const draft = getDraftOr(interaction);
    if (!draft) { await replyEphemeral(interaction, 'Черновик не найден. Откройте `/componentsv2`.'); return; }
    const list = currentList(draft);
    const sel = draft.selected;
    const hasSel = sel !== null && sel !== undefined && list[sel];

    switch (interaction.customId) {
        case BTN.EDIT: {
            if (!hasSel) { await replyEphemeral(interaction, 'Сначала выберите компонент.'); return; }
            const kind = kindOf(list[sel]);
            await interaction.showModal(buildModal(kind, list[sel], 'edit'));
            return;
        }
        case BTN.UP:
        case BTN.DOWN: {
            if (!hasSel) return;
            const j = interaction.customId === BTN.UP ? sel - 1 : sel + 1;
            if (j < 0 || j >= list.length) { await interaction.update(buildPanelPayload(draft, null)); return; }
            [list[sel], list[j]] = [list[j], list[sel]];
            draft.selected = j;
            saveComponentsV2Draft(draft);
            await interaction.update(buildPanelPayload(draft, 'Порядок изменён.'));
            return;
        }
        case BTN.DELETE: {
            if (!hasSel) return;
            list.splice(sel, 1);
            draft.selected = list.length ? Math.min(sel, list.length - 1) : null;
            saveComponentsV2Draft(draft);
            await interaction.update(buildPanelPayload(draft, 'Компонент удалён.'));
            return;
        }
        case BTN.ENTER: {
            if (!hasSel || list[sel].type !== T.Container) { await replyEphemeral(interaction, 'Войти можно только в контейнер.'); return; }
            draft.cursor = sel; // sel — индекс на корневом уровне
            draft.selected = null;
            saveComponentsV2Draft(draft);
            await interaction.update(buildPanelPayload(draft, 'Вы внутри контейнера.'));
            return;
        }
        case BTN.BACK: {
            draft.selected = draft.cursor;
            draft.cursor = null;
            saveComponentsV2Draft(draft);
            await interaction.update(buildPanelPayload(draft, 'Вернулись на корень.'));
            return;
        }
        case BTN.TARGET:
            await interaction.showModal(buildModal('target', draft, 'edit'));
            return;
        case BTN.PREVIEW: {
            const validation = v2.validateMessage({ flags: draft.flags | IS_V2, components: draft.components });
            if (!validation.ok) {
                await interaction.reply({ content: `Предпросмотр недоступен:\n${validation.errors.slice(0, 8).map((e) => `• ${e.path}: ${e.message}`).join('\n')}`, flags: MessageFlags.Ephemeral });
                return;
            }
            await interaction.reply({ flags: MessageFlags.Ephemeral | IS_V2, components: draft.components });
            return;
        }
        case BTN.RESET:
            deleteComponentsV2Draft(interaction.user.id);
            await interaction.update({ content: 'Черновик Components V2 сброшен.', components: [], flags: MessageFlags.Ephemeral });
            return;
        case BTN.SEND:
            await sendDraft(interaction, draft, client);
            return;
        default:
            await replyEphemeral(interaction, 'Неизвестное действие конструктора.');
    }
}

async function handleModal(interaction) {
    const draft = getDraftOr(interaction);
    if (!draft) { await replyEphemeral(interaction, 'Черновик не найден. Откройте `/componentsv2`.'); return; }

    const [, kind] = interaction.customId.split(':'); // cv2_modal:<kind>:<mode>

    if (kind === 'target') {
        const target = parseDiscordTarget(interaction.fields.getTextInputValue('channel'));
        if (!target.channelId) { await replyEphemeral(interaction, 'Канал нужно указать как ID, #упоминание или ссылку.'); return; }
        const msgInput = clean(interaction.fields.getTextInputValue('message_id'));
        const msgTarget = parseDiscordTarget(msgInput);
        patchComponentsV2Draft(interaction.user.id, {
            channelId: msgTarget.channelId || target.channelId,
            messageId: msgInput ? (msgTarget.messageId || null) : (target.messageId || null),
            forumPostName: clean(interaction.fields.getTextInputValue('forum_post_name')),
        });
        await interaction.reply({ ...buildPanelPayload(getComponentsV2Draft(interaction.user.id), 'Канал назначения сохранён.') });
        return;
    }

    const list = currentList(draft);
    const sel = draft.selected;
    if (sel === null || sel === undefined || !list[sel]) { await replyEphemeral(interaction, 'Не выбран компонент для записи.'); return; }

    const result = buildComponentFromModal(kind, interaction, list[sel]);
    if (result.error) { await replyEphemeral(interaction, result.error); return; }

    list[sel] = result.component;
    saveComponentsV2Draft(draft);
    await interaction.reply({ ...buildPanelPayload(draft, 'Компонент сохранён.') });
}

async function sendDraft(interaction, draft, client) {
    const payload = { flags: draft.flags | IS_V2, components: draft.components };
    const validation = v2.validateMessage(payload);
    if (!validation.ok) {
        await interaction.update(buildPanelPayload(draft, `Не могу отправить:\n${validation.errors.slice(0, 6).map((e) => `• ${e.message}`).join('\n')}`));
        return;
    }

    const targetChannel = await client.channels.fetch(draft.channelId).catch(() => null);
    if (!isTargetChannel(targetChannel)) {
        await interaction.update(buildPanelPayload(draft, 'Канал назначения не найден. Нажмите «Канал» и укажите его заново.'));
        return;
    }

    try {
        if (draft.messageId) {
            if (isForumChannel(targetChannel)) {
                await interaction.update(buildPanelPayload(draft, 'Для форума укажите ссылку на сообщение из треда, а не ID форум-канала.'));
                return;
            }
            const message = await targetChannel.messages.fetch(draft.messageId);
            if (message.author.id !== client.user.id) {
                await interaction.update(buildPanelPayload(draft, 'Я могу редактировать только свои сообщения.'));
                return;
            }
            await message.edit(payload);
            deleteComponentsV2Draft(interaction.user.id);
            await interaction.update({ content: `Сообщение обновлено в <#${targetChannel.id}>. ID: \`${message.id}\``, components: [], flags: MessageFlags.Ephemeral });
            return;
        }

        if (isForumChannel(targetChannel)) {
            if (!draft.forumPostName) {
                await interaction.update(buildPanelPayload(draft, 'Для форума укажите название поста в кнопке «Канал».'));
                return;
            }
            const thread = await targetChannel.threads.create({ name: draft.forumPostName, message: payload });
            deleteComponentsV2Draft(interaction.user.id);
            await interaction.update({ content: `Пост создан на форуме: <#${thread.id}>`, components: [], flags: MessageFlags.Ephemeral });
            return;
        }

        const sent = await targetChannel.send(payload);
        deleteComponentsV2Draft(interaction.user.id);
        await interaction.update({ content: `Сообщение отправлено в <#${targetChannel.id}>. ID: \`${sent.id}\``, components: [], flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('Ошибка отправки Components V2:', error);
        await interaction.update(buildPanelPayload(draft, 'Не удалось отправить/обновить. Проверьте права бота, канал и ID сообщения.'));
    }
}

module.exports = {
    commandData,
    COMMAND_NAMES,
    ensureStore: ensureComponentsV2DraftStoreFile,
    isComponentsV2Interaction,
    handleInteraction,
};
