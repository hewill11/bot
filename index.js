require('dotenv').config();

const express = require('express');
const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
} = require('discord.js');
const {
    ensureStoreFile,
    getApplication,
    saveApplication,
    patchApplication,
} = require('./storage/applicationsStore');
const {
    ensureCourtStoreFile,
    getCourt,
    saveCourt,
    patchCourt,
} = require('./storage/courtsStore');
const {
    ensureEmbedDraftStoreFile,
    getEmbedDraft,
    saveEmbedDraft,
    patchEmbedDraft,
    deleteEmbedDraft,
} = require('./storage/embedDraftsStore');

const PORT = Number(process.env.PORT) || 10000;
const APPLICATION_MODAL_ID = 'minecraft_application_modal';
const COURT_MODAL_ID = 'minecraft_court_modal';
const EMBED_MODAL_PREFIX = 'create_embed_modal';
const EMBED_BUILDER_BUTTON_PREFIX = 'embed_builder_';
const EMBED_BUILDER_MODAL_PREFIX = 'embed_builder_modal';
const EMBED_BUILDER_EDIT_BASIC_BUTTON_ID = `${EMBED_BUILDER_BUTTON_PREFIX}basic`;
const EMBED_BUILDER_EDIT_MEDIA_BUTTON_ID = `${EMBED_BUILDER_BUTTON_PREFIX}media`;
const EMBED_BUILDER_EDIT_APPEARANCE_BUTTON_ID = `${EMBED_BUILDER_BUTTON_PREFIX}appearance`;
const EMBED_BUILDER_EDIT_META_BUTTON_ID = `${EMBED_BUILDER_BUTTON_PREFIX}meta`;
const EMBED_BUILDER_EDIT_TARGET_BUTTON_ID = `${EMBED_BUILDER_BUTTON_PREFIX}target`;
const EMBED_BUILDER_PREVIEW_BUTTON_ID = `${EMBED_BUILDER_BUTTON_PREFIX}preview`;
const EMBED_BUILDER_SEND_BUTTON_ID = `${EMBED_BUILDER_BUTTON_PREFIX}send`;
const EMBED_BUILDER_RESET_BUTTON_ID = `${EMBED_BUILDER_BUTTON_PREFIX}reset`;
const OPEN_APPLICATION_BUTTON_ID = 'open_application_modal';
const OPEN_COURT_BUTTON_ID = 'open_court_modal';
const APPROVE_APPLICATION_PREFIX = 'approve_application_';
const REJECT_APPLICATION_PREFIX = 'reject_application_';
const APPROVE_COURT_PREFIX = 'approve_court_';
const REJECT_COURT_PREFIX = 'reject_court_';
const APPLICATION_COMMAND_NAMES = new Set(['анкета', 'заявка']);
const EMBED_COMMAND_NAME = 'embed';
const DEFAULT_COURT_PANEL_CHANNEL_ID = '1492315531922112604';
const DEFAULT_COURT_REVIEW_CHANNEL_ID = '1492316013264375968';
const APPLICATION_RESUBMISSION_LIMIT = 3;
const APPLICATION_RESUBMISSION_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const REQUIRED_ENV_VARS = [
    'TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'PANEL_CHANNEL_ID',
    'APPLICATION_CHANNEL_ID',
    'APPROVED_ROLE_ID',
    'STAFF_ROLE_ID',
];

validateEnvironment();
ensureStoreFile();
ensureCourtStoreFile();
ensureEmbedDraftStoreFile();

const app = express();
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

app.get('/', (req, res) => {
    res.send('Bot is running');
});

app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP server started on port ${PORT}`);
});

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Бот запущен как ${readyClient.user.tag}`);

    try {
        await ensureApplicationPanel();
    } catch (error) {
        console.error('Не удалось проверить или отправить панель заявок:', error);
    }

    try {
        await ensureCourtPanel();
    } catch (error) {
        console.error('Не удалось проверить или отправить панель судов:', error);
    }

    try {
        await synchronizeClosedModerationMessages();
    } catch (error) {
        console.error('Не удалось синхронизировать уже обработанные модераторские сообщения:', error);
    }
});

client.on('error', (error) => {
    console.error('Discord client error:', error);
});

client.on('warn', (warning) => {
    console.warn('Discord client warning:', warning);
});

client.on('shardError', (error) => {
    console.error('Discord shard error:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            if (APPLICATION_COMMAND_NAMES.has(interaction.commandName)) {
                await handleApplicationOpen(interaction);
                return;
            }

            if (interaction.commandName === EMBED_COMMAND_NAME) {
                await handleEmbedCommand(interaction);
            }
            return;
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith(EMBED_BUILDER_BUTTON_PREFIX)) {
                await handleEmbedBuilderButton(interaction);
                return;
            }

            if (interaction.customId === OPEN_APPLICATION_BUTTON_ID) {
                await handleApplicationOpen(interaction);
                return;
            }

            if (interaction.customId === OPEN_COURT_BUTTON_ID) {
                await handleCourtOpen(interaction);
                return;
            }

            if (interaction.customId.startsWith(APPROVE_APPLICATION_PREFIX)) {
                await handleApprove(interaction);
                return;
            }

            if (interaction.customId.startsWith(REJECT_APPLICATION_PREFIX)) {
                await handleReject(interaction);
                return;
            }

            if (interaction.customId.startsWith(APPROVE_COURT_PREFIX)) {
                await handleCourtApprove(interaction);
                return;
            }

            if (interaction.customId.startsWith(REJECT_COURT_PREFIX)) {
                await handleCourtReject(interaction);
                return;
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === APPLICATION_MODAL_ID) {
                await handleApplicationSubmit(interaction);
                return;
            }

            if (interaction.customId === COURT_MODAL_ID) {
                await handleCourtSubmit(interaction);
                return;
            }

            if (interaction.customId.startsWith(`${EMBED_BUILDER_MODAL_PREFIX}:`)) {
                await handleEmbedBuilderModalSubmit(interaction);
                return;
            }

            if (interaction.customId.startsWith(`${EMBED_MODAL_PREFIX}:`)) {
                await handleEmbedSubmit(interaction);
            }
        }
    } catch (error) {
        console.error('Ошибка при обработке interaction:', error);
        await replyEphemeral(interaction, 'Произошла ошибка при обработке действия.');
    }
});

client.login(process.env.TOKEN).catch((error) => {
    console.error('client.login error:', error);
});

function validateEnvironment() {
    const missingVariables = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

    if (missingVariables.length === 0) {
        return;
    }

    throw new Error(`Не заданы обязательные переменные окружения: ${missingVariables.join(', ')}`);
}

function buildApplicationModal() {
    const modal = new ModalBuilder()
        .setCustomId(APPLICATION_MODAL_ID)
        .setTitle('Анкета на сервер');

    const nicknameInput = new TextInputBuilder()
        .setCustomId('nickname')
        .setLabel('Твой ник в Minecraft')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32)
        .setPlaceholder('Например: Steve');

    const ageInput = new TextInputBuilder()
        .setCustomId('age')
        .setLabel('Сколько тебе лет?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3)
        .setPlaceholder('Например: 18');

    const aboutInput = new TextInputBuilder()
        .setCustomId('about')
        .setLabel('Расскажи немного о себе')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setPlaceholder('Как ты обычно играешь, что тебе нравится на серверах и чего ждешь от проекта.');

    const extraInput = new TextInputBuilder()
        .setCustomId('extra')
        .setLabel('Что-нибудь хочешь добавить от себя?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('Любая дополнительная информация, которую считаешь важной.');

    modal.addComponents(
        new ActionRowBuilder().addComponents(nicknameInput),
        new ActionRowBuilder().addComponents(ageInput),
        new ActionRowBuilder().addComponents(aboutInput),
        new ActionRowBuilder().addComponents(extraInput),
    );

    return modal;
}

function buildCourtModal() {
    const modal = new ModalBuilder()
        .setCustomId(COURT_MODAL_ID)
        .setTitle('Подача иска в суд');

    const plaintiffInput = new TextInputBuilder()
        .setCustomId('plaintiff_nickname')
        .setLabel('Ваш ник в Minecraft')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32)
        .setPlaceholder('Например: Steve');

    const defendantInput = new TextInputBuilder()
        .setCustomId('defendant_nickname')
        .setLabel('Ник обвиняемого')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32)
        .setPlaceholder('Например: Griefer123');

    const reasonInput = new TextInputBuilder()
        .setCustomId('court_reason')
        .setLabel('Причина обращения')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setPlaceholder('Опишите, что произошло, в чем обвинение и какие у вас есть доказательства.');

    const scheduleInput = new TextInputBuilder()
        .setCustomId('court_schedule')
        .setLabel('Желаемая дата и время суда')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100)
        .setPlaceholder('Например: 14.04 в 19:00 по МСК');

    modal.addComponents(
        new ActionRowBuilder().addComponents(plaintiffInput),
        new ActionRowBuilder().addComponents(defendantInput),
        new ActionRowBuilder().addComponents(reasonInput),
        new ActionRowBuilder().addComponents(scheduleInput),
    );

    return modal;
}

function buildCreateEmbedModal(channelId, messageId = null, existingData = {}) {
    const safeMessageId = messageId ? messageId : 'none';
    const customId = `${EMBED_MODAL_PREFIX}:${channelId}:${safeMessageId}:${Date.now()}`;

    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(messageId ? 'Редактирование embed' : 'Создание embed');

    const titleInput = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel('Заголовок')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256)
        .setPlaceholder('Например: Новости проекта');

    if (existingData.title) titleInput.setValue(existingData.title);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('embed_description')
        .setLabel('Описание')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(4000)
        .setPlaceholder('Основной текст embed.');

    if (existingData.description) descriptionInput.setValue(existingData.description);

    const appearanceInput = new TextInputBuilder()
        .setCustomId('embed_appearance')
        .setLabel('Внешний вид')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('color=#5865F2\nurl=https://ex.com\ntimestamp=yes');

    if (existingData.appearance) appearanceInput.setValue(existingData.appearance);

    const mediaInput = new TextInputBuilder()
        .setCustomId('embed_media')
        .setLabel('Картинки')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('image=https://ex.com/i.png\nthumbnail=https://ex.com/t.png');

    if (existingData.media) mediaInput.setValue(existingData.media);

    const metaInput = new TextInputBuilder()
        .setCustomId('embed_meta')
        .setLabel('Автор и footer')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('author=EVOSMP\nfooter=Админка\nauthorIcon=https://ex.com/a.png');

    if (existingData.meta) metaInput.setValue(existingData.meta);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(appearanceInput),
        new ActionRowBuilder().addComponents(mediaInput),
        new ActionRowBuilder().addComponents(metaInput),
    );

    return modal;
}

function buildEmbedBuilderBasicModal(draft) {
    const modal = new ModalBuilder()
        .setCustomId(`${EMBED_BUILDER_MODAL_PREFIX}:basic`)
        .setTitle('Embed: текст');

    const titleInput = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel('Заголовок')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256)
        .setPlaceholder('Например: Новости проекта');

    setTextInputValue(titleInput, draft.title);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('embed_description')
        .setLabel('Описание')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(4000)
        .setPlaceholder('Основной текст embed.');

    setTextInputValue(descriptionInput, draft.description);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
    );

    return modal;
}

function buildEmbedBuilderMediaModal(draft) {
    const modal = new ModalBuilder()
        .setCustomId(`${EMBED_BUILDER_MODAL_PREFIX}:media`)
        .setTitle('Embed: картинки');

    const imageInput = new TextInputBuilder()
        .setCustomId('embed_image_url')
        .setLabel('Image URL')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('https://example.com/image.png');

    setTextInputValue(imageInput, draft.imageUrl);

    const thumbnailInput = new TextInputBuilder()
        .setCustomId('embed_thumbnail_url')
        .setLabel('Thumbnail URL')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('https://example.com/thumbnail.png');

    setTextInputValue(thumbnailInput, draft.thumbnailUrl);

    modal.addComponents(
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(thumbnailInput),
    );

    return modal;
}

function buildEmbedBuilderAppearanceModal(draft) {
    const modal = new ModalBuilder()
        .setCustomId(`${EMBED_BUILDER_MODAL_PREFIX}:appearance`)
        .setTitle('Embed: внешний вид');

    const colorInput = new TextInputBuilder()
        .setCustomId('embed_color')
        .setLabel('Цвет')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7)
        .setPlaceholder('#5865F2');

    setTextInputValue(colorInput, draft.color);

    const urlInput = new TextInputBuilder()
        .setCustomId('embed_url')
        .setLabel('Ссылка заголовка')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('https://example.com');

    setTextInputValue(urlInput, draft.url);

    const timestampInput = new TextInputBuilder()
        .setCustomId('embed_timestamp')
        .setLabel('Timestamp')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10)
        .setPlaceholder('yes / no');

    if (draft.timestamp) {
        timestampInput.setValue('yes');
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(urlInput),
        new ActionRowBuilder().addComponents(timestampInput),
    );

    return modal;
}

function buildEmbedBuilderMetaModal(draft) {
    const modal = new ModalBuilder()
        .setCustomId(`${EMBED_BUILDER_MODAL_PREFIX}:meta`)
        .setTitle('Embed: автор и footer');

    const authorInput = new TextInputBuilder()
        .setCustomId('embed_author')
        .setLabel('Автор')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256)
        .setPlaceholder('EVOSMP');

    setTextInputValue(authorInput, draft.author);

    const authorIconInput = new TextInputBuilder()
        .setCustomId('embed_author_icon_url')
        .setLabel('Иконка автора URL')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('https://example.com/author.png');

    setTextInputValue(authorIconInput, draft.authorIconUrl);

    const footerInput = new TextInputBuilder()
        .setCustomId('embed_footer')
        .setLabel('Footer')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2048)
        .setPlaceholder('Администрация сервера');

    setTextInputValue(footerInput, draft.footer);

    const footerIconInput = new TextInputBuilder()
        .setCustomId('embed_footer_icon_url')
        .setLabel('Иконка footer URL')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setPlaceholder('https://example.com/footer.png');

    setTextInputValue(footerIconInput, draft.footerIconUrl);

    modal.addComponents(
        new ActionRowBuilder().addComponents(authorInput),
        new ActionRowBuilder().addComponents(authorIconInput),
        new ActionRowBuilder().addComponents(footerInput),
        new ActionRowBuilder().addComponents(footerIconInput),
    );

    return modal;
}

function buildEmbedBuilderTargetModal(draft) {
    const modal = new ModalBuilder()
        .setCustomId(`${EMBED_BUILDER_MODAL_PREFIX}:target`)
        .setTitle('Embed: канал');

    const channelInput = new TextInputBuilder()
        .setCustomId('embed_channel')
        .setLabel('Канал ID, #упоминание или ссылка')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200)
        .setPlaceholder('123456789012345678 или ссылка на сообщение');

    setTextInputValue(channelInput, draft.channelId);

    const messageInput = new TextInputBuilder()
        .setCustomId('embed_message_id')
        .setLabel('ID/ссылка сообщения для редактирования')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200)
        .setPlaceholder('Оставьте пустым, чтобы отправить новое сообщение');

    setTextInputValue(messageInput, draft.messageId);

    modal.addComponents(
        new ActionRowBuilder().addComponents(channelInput),
        new ActionRowBuilder().addComponents(messageInput),
    );

    return modal;
}

function buildApplicationEmbed(userId, formData) {
    return new EmbedBuilder()
        .setTitle('Новая заявка на Minecraft сервер')
        .setColor(0x5865F2)
        .addFields(
            {
                name: 'Пользователь Discord',
                value: `<@${userId}>`,
            },
            {
                name: 'Ник в Minecraft',
                value: formData.nickname,
            },
            {
                name: 'Возраст',
                value: formData.age,
            },
            {
                name: 'О себе',
                value: formData.about,
            },
            {
                name: 'Дополнительно',
                value: formData.extra,
            },
            {
                name: 'Статус',
                value: 'На рассмотрении',
            },
        )
        .setTimestamp();
}

function buildModerationButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${APPROVE_APPLICATION_PREFIX}${userId}`)
            .setLabel('Одобрить')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${REJECT_APPLICATION_PREFIX}${userId}`)
            .setLabel('Отклонить')
            .setStyle(ButtonStyle.Danger),
    );
}

function buildApplicationPanelEmbed() {
    const panelColor = parseEmbedColor(process.env.PANEL_COLOR || null) ?? 0x8B3D67;
    const panelImageUrl = validateHttpUrl(process.env.PANEL_IMAGE_URL || null);
    const panelThumbnailUrl = validateHttpUrl(process.env.PANEL_THUMBNAIL_URL || null);
    const shopChannelMention = process.env.SHOP_CHANNEL_ID ? `<#${process.env.SHOP_CHANNEL_ID}>` : null;
    const descriptionParts = [
        'Наш сервер является приватным, и мы внимательно отбираем игроков, чтобы сохранить дружелюбную и спокойную атмосферу.',
        '',
        '**⚠️ Важные моменты**',
        '> 1. Если анкету отклонят, повторно подать ее можно через 12 часов.',
        '> 2. Максимум доступно 3 повторные подачи после первого отказа.',
        '> 3. Не пишите администрации по статусу заявки до решения.',
        '> 4. Развернутые ответы повышают шанс одобрения.',
    ];

    if (shopChannelMention) {
        descriptionParts.push(
            '',
            '**💸 Купить проходку**',
            `> Если не хотите ждать рассмотрения заявки, переходите в ${shopChannelMention}.`,
        );
    }

    descriptionParts.push(
        '',
        '**Надеемся, ваша заявка станет началом долгого и интересного приключения на сервере.**',
    );

    const embed = new EmbedBuilder()
        .setTitle('🎮 Подать заявку на сервер')
        .setDescription(descriptionParts.join('\n'))
        .setColor(panelColor)
        .setFooter({
            text: process.env.PANEL_FOOTER_TEXT || 'EVOSMP | Начать играть',
        });

    if (panelImageUrl) {
        embed.setImage(panelImageUrl);
    }

    if (panelThumbnailUrl) {
        embed.setThumbnail(panelThumbnailUrl);
    }

    return embed;
}

function buildApplicationPanelComponents() {
    const buttons = [
        new ButtonBuilder()
            .setCustomId(OPEN_APPLICATION_BUTTON_ID)
            .setLabel('Подать заявку')
            .setStyle(ButtonStyle.Primary),
    ];
    const secondaryUrl = validateHttpUrl(process.env.PANEL_SECONDARY_URL || null);

    if (secondaryUrl) {
        buttons.push(
            new ButtonBuilder()
                .setLabel(process.env.PANEL_SECONDARY_LABEL || 'Купить проходку')
                .setStyle(ButtonStyle.Link)
                .setURL(secondaryUrl),
        );
    }

    return [
        new ActionRowBuilder().addComponents(...buttons),
    ];
}

function buildCourtEmbed(userId, caseId, formData) {
    return new EmbedBuilder()
        .setTitle('Новая заявка в суд')
        .setColor(0xF1C40F)
        .addFields(
            {
                name: 'Истец (Discord)',
                value: `<@${userId}>`,
            },
            {
                name: 'Ваш ник в Minecraft',
                value: formData.plaintiffNickname,
            },
            {
                name: 'Ник обвиняемого',
                value: formData.defendantNickname,
            },
            {
                name: 'Причина',
                value: formData.reason,
            },
            {
                name: 'Желаемая дата и время суда',
                value: formData.schedule,
            },
            {
                name: 'Номер дела',
                value: `#${caseId}`,
            },
            {
                name: 'Статус',
                value: 'На рассмотрении',
            },
        )
        .setTimestamp();
}

function buildCourtModerationButtons(caseId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${APPROVE_COURT_PREFIX}${caseId}`)
            .setLabel('Принять')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${REJECT_COURT_PREFIX}${caseId}`)
            .setLabel('Отклонить')
            .setStyle(ButtonStyle.Danger),
    );
}

function buildCourtPanelEmbed() {
    const descriptionParts = [
        'Если на сервере случился конфликт, спор или нарушение, и вы хотите решения судьи, соберите доказательства и подайте обращение в суд.',
        '',
        '**Что указать в заявке**',
        '> 1. Ваш ник в Minecraft.',
        '> 2. Ник обвиняемого.',
        '> 3. Подробную причину обращения и суть обвинения.',
        '> 4. Желаемую дату и время проведения суда.',
        '',
        '**Важно**',
        '> Чем подробнее описание и чем лучше доказательства, тем быстрее администрации будет принять решение.',
    ];

    return new EmbedBuilder()
        .setTitle('⚖️ Подать обращение в суд')
        .setDescription(descriptionParts.join('\n'))
        .setColor(0xF1C40F)
        .setFooter({
            text: 'EVOSMP | Судебная система',
        });
}

function buildCourtPanelComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(OPEN_COURT_BUTTON_ID)
                .setLabel('Подать в суд')
                .setStyle(ButtonStyle.Primary),
        ),
    ];
}

async function ensureApplicationPanel() {
    const panelChannel = await client.channels.fetch(process.env.PANEL_CHANNEL_ID);

    if (!panelChannel || !panelChannel.isTextBased() || !('messages' in panelChannel)) {
        throw new Error('PANEL_CHANNEL_ID не указывает на текстовый канал.');
    }

    const panelPayload = {
        embeds: [buildApplicationPanelEmbed()],
        components: buildApplicationPanelComponents(),
    };

    const recentMessages = await panelChannel.messages.fetch({ limit: 100 });
    const existingPanel = recentMessages.find((message) =>
        message.author.id === client.user.id &&
        message.components.some((row) =>
            row.components.some((component) => component.customId === OPEN_APPLICATION_BUTTON_ID),
        ),
    );

    if (existingPanel) {
        await existingPanel.edit(panelPayload).catch(() => {});
        return;
    }

    await panelChannel.send({
        ...panelPayload,
    });
}

async function ensureCourtPanel() {
    const panelChannel = await client.channels.fetch(getCourtPanelChannelId());

    if (!panelChannel || !panelChannel.isTextBased() || !('messages' in panelChannel)) {
        throw new Error('COURT_PANEL_CHANNEL_ID не указывает на текстовый канал.');
    }

    const panelPayload = {
        embeds: [buildCourtPanelEmbed()],
        components: buildCourtPanelComponents(),
    };

    const recentMessages = await panelChannel.messages.fetch({ limit: 100 });
    const existingPanel = recentMessages.find((message) =>
        message.author.id === client.user.id &&
        message.components.some((row) =>
            row.components.some((component) => component.customId === OPEN_COURT_BUTTON_ID),
        ),
    );

    if (existingPanel) {
        await existingPanel.edit(panelPayload).catch(() => {});
        return;
    }

    await panelChannel.send(panelPayload);
}

async function handleApplicationOpen(interaction) {
    const blockReason = await getSubmissionBlockReason(interaction);

    if (blockReason) {
        await replyEphemeral(interaction, blockReason);
        return;
    }

    await interaction.showModal(buildApplicationModal());
}

async function handleCourtOpen(interaction) {
    await interaction.showModal(buildCourtModal());
}

async function handleEmbedCommand(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для создания или редактирования embed.');
        return;
    }

    const selectedChannel = interaction.options.getChannel('channel');
    let targetChannel = selectedChannel || interaction.channel;
    let messageId = interaction.options.getString('message_id');

    if (!targetChannel || !targetChannel.isTextBased() || !('send' in targetChannel)) {
        await replyEphemeral(interaction, 'Нужен текстовый канал, куда бот сможет отправить embed.');
        return;
    }

    const shouldContinueDraft = !selectedChannel && !messageId;
    const existingDraft = shouldContinueDraft ? getEmbedDraft(interaction.user.id) : null;

    if (existingDraft) {
        await interaction.reply({
            ...buildEmbedBuilderPanelPayload(
                existingDraft,
                'Продолжаю ваш сохраненный черновик. Его можно закрывать и открывать снова через `/embed`.',
            ),
            ephemeral: true,
        });
        return;
    }

    let draftData = createEmptyEmbedDraftData();

    if (messageId) {
        const messageTarget = parseDiscordMessageTarget(messageId, 'message');

        if (!selectedChannel && messageTarget.channelId) {
            targetChannel = await client.channels.fetch(messageTarget.channelId).catch(() => targetChannel);
        }

        if (messageTarget.messageId) {
            messageId = messageTarget.messageId;
        } else if (messageId.includes('/')) {
            messageId = messageId.split('/').pop().trim();
        } else {
            messageId = messageId.trim();
        }

        try {
            // ВАЖНО: Удаляем сообщение из локального кеша бота перед запросом!
            // Это заставит бота честно сходить на серверы Discord и взять самую новую версию.
            targetChannel.messages.cache.delete(messageId);

            // Запрашиваем актуальное сообщение
            const message = await targetChannel.messages.fetch(messageId);

            if (message.author.id !== client.user.id) {
                await replyEphemeral(interaction, 'Я могу редактировать только те сообщения, которые отправлял сам.');
                return;
            }

            if (message.embeds.length > 0) {
                draftData = createEmbedDraftDataFromEmbed(message.embeds[0]);
            } else {
                await replyEphemeral(interaction, 'В этом сообщении нет embed для редактирования.');
                return;
            }
        } catch (error) {
            console.error(error);
            await replyEphemeral(interaction, 'Не удалось найти сообщение с таким ID в указанном канале.');
            return;
        }
    }

    const now = new Date().toISOString();
    const draft = saveEmbedDraft({
        ...draftData,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: targetChannel.id,
        messageId: messageId || null,
        createdAt: now,
        updatedAt: now,
    });

    await interaction.reply({
        ...buildEmbedBuilderPanelPayload(
            draft,
            'Черновик создан. Заполняйте его по частям, окно можно закрывать: данные сохраняются после каждой модалки.',
        ),
        ephemeral: true,
    });
}

async function handleApplicationSubmit(interaction) {
    const blockReason = await getSubmissionBlockReason(interaction);

    if (blockReason) {
        await replyEphemeral(interaction, blockReason);
        return;
    }

    const age = interaction.fields.getTextInputValue('age').trim();

    if (!/^\d{1,3}$/.test(age)) {
        await replyEphemeral(interaction, 'Возраст нужно указать числом.');
        return;
    }

    const formData = {
        nickname: interaction.fields.getTextInputValue('nickname').trim(),
        age,
        about: interaction.fields.getTextInputValue('about').trim(),
        extra: interaction.fields.getTextInputValue('extra').trim() || 'Ничего не добавил',
    };

    const applicationChannel = await client.channels.fetch(process.env.APPLICATION_CHANNEL_ID);

    if (!applicationChannel || !applicationChannel.isTextBased() || !('send' in applicationChannel)) {
        await replyEphemeral(interaction, 'Не найден текстовый канал для отправки заявок. Проверь настройки бота.');
        return;
    }

    const applicationMessage = await applicationChannel.send({
        embeds: [buildApplicationEmbed(interaction.user.id, formData)],
        components: [buildModerationButtons(interaction.user.id)],
    });

    const now = new Date().toISOString();
    const existingApplication = getApplication(interaction.user.id);
    const isResubmission = existingApplication?.status === 'rejected';
    const submissionCount = isResubmission
        ? getApplicationSubmissionCount(existingApplication) + 1
        : 1;
    const resubmissionCount = isResubmission
        ? getApplicationResubmissionCount(existingApplication) + 1
        : 0;

    saveApplication({
        ...existingApplication,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        applicationChannelId: applicationChannel.id,
        applicationMessageId: applicationMessage.id,
        status: 'pending',
        submittedAt: now,
        updatedAt: now,
        nickname: formData.nickname,
        age: formData.age,
        about: formData.about,
        extra: formData.extra,
        submissionCount,
        resubmissionCount,
        reviewedAt: null,
        rejectedAt: null,
        nextSubmissionAt: null,
        moderatorId: null,
        moderatorTag: null,
    });

    await interaction.reply({
        content: isResubmission
            ? `Ваша повторная анкета отправлена администрации. Если ее снова отклонят, после этой попытки останется повторных подач: ${Math.max(APPLICATION_RESUBMISSION_LIMIT - resubmissionCount, 0)}.`
            : 'Ваша заявка отправлена администрации. Если ее отклонят, повторно подать анкету можно будет через 12 часов.',
        ephemeral: true,
    });
}

async function handleApprove(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для одобрения заявок.');
        return;
    }

    const userId = interaction.customId.slice(APPROVE_APPLICATION_PREFIX.length);
    const application = ensureApplicationRecordFromMessage(interaction, userId);
    const moderationBlockMessage = getModerationBlockMessage(application.status);

    if (moderationBlockMessage) {
        await syncApplicationMessageIfNeeded(interaction, application);
        await replyEphemeral(interaction, moderationBlockMessage);
        return;
    }

    await interaction.deferUpdate();

    patchApplication(userId, {
        status: 'approving',
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    const member = await interaction.guild.members.fetch(userId).catch(() => null);

    if (!member) {
        patchApplication(userId, {
            status: 'pending',
            updatedAt: new Date().toISOString(),
        });
        await replyEphemeral(
            interaction,
            'Не удалось найти пользователя на сервере. Заявка оставлена в статусе "На рассмотрении".',
        );
        return;
    }

    try {
        await member.roles.add(process.env.APPROVED_ROLE_ID);
    } catch (error) {
        patchApplication(userId, {
            status: 'pending',
            updatedAt: new Date().toISOString(),
        });
        console.error('Не удалось выдать роль одобрения:', error);
        await replyEphemeral(interaction, 'Не удалось выдать роль пользователю. Проверь права бота и позицию ролей.');
        return;
    }

    try {
        await member.send('Ваша заявка была одобрена.');
    } catch (error) {
        console.log('Не удалось отправить сообщение пользователю в личные сообщения.');
    }

    const updatedApplication = patchApplication(userId, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rejectedAt: null,
        nextSubmissionAt: null,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    await updateStatusMessage(
        interaction.message,
        0x57F287,
        buildApplicationApprovedStatusText(updatedApplication),
    );
    await replyEphemeral(interaction, 'Заявка одобрена.');
}

async function handleReject(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для отклонения заявок.');
        return;
    }

    const userId = interaction.customId.slice(REJECT_APPLICATION_PREFIX.length);
    const application = ensureApplicationRecordFromMessage(interaction, userId);
    const moderationBlockMessage = getModerationBlockMessage(application.status);

    if (moderationBlockMessage) {
        await syncApplicationMessageIfNeeded(interaction, application);
        await replyEphemeral(interaction, moderationBlockMessage);
        return;
    }

    await interaction.deferUpdate();

    patchApplication(userId, {
        status: 'rejecting',
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    const rejectedAt = new Date();
    const nextSubmissionAt = new Date(rejectedAt.getTime() + APPLICATION_RESUBMISSION_COOLDOWN_MS).toISOString();
    const updatedApplication = patchApplication(userId, {
        status: 'rejected',
        reviewedAt: rejectedAt.toISOString(),
        updatedAt: rejectedAt.toISOString(),
        rejectedAt: rejectedAt.toISOString(),
        nextSubmissionAt,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    try {
        await showPanelForUser(userId);
    } catch (error) {
        console.error('Не удалось вернуть пользователю доступ к панели заявок:', error);
    }

    const user = await client.users.fetch(userId).catch(() => null);

    if (user) {
        try {
            await user.send(buildApplicationRejectedDirectMessage(updatedApplication));
        } catch (error) {
            console.log('Не удалось отправить сообщение пользователю в личные сообщения.');
        }
    }

    await updateStatusMessage(
        interaction.message,
        0xED4245,
        buildApplicationRejectedStatusText(updatedApplication),
    );
    await replyEphemeral(interaction, 'Заявка отклонена. Пользователь сможет подать повторную анкету через 12 часов.');
}

async function handleCourtSubmit(interaction) {
    const formData = {
        plaintiffNickname: interaction.fields.getTextInputValue('plaintiff_nickname').trim(),
        defendantNickname: interaction.fields.getTextInputValue('defendant_nickname').trim(),
        reason: interaction.fields.getTextInputValue('court_reason').trim(),
        schedule: interaction.fields.getTextInputValue('court_schedule').trim(),
    };

    const reviewChannel = await client.channels.fetch(getCourtReviewChannelId()).catch(() => null);

    if (!reviewChannel || !reviewChannel.isTextBased() || !('send' in reviewChannel)) {
        await replyEphemeral(interaction, 'Не найден текстовый канал для отправки судебных заявок. Проверь настройки бота.');
        return;
    }

    const caseId = createCourtCaseId();
    const reviewMessage = await reviewChannel.send({
        embeds: [buildCourtEmbed(interaction.user.id, caseId, formData)],
        components: [buildCourtModerationButtons(caseId)],
    });

    const now = new Date().toISOString();
    saveCourt({
        caseId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        reviewChannelId: reviewChannel.id,
        reviewMessageId: reviewMessage.id,
        status: 'pending',
        submittedAt: now,
        updatedAt: now,
        plaintiffNickname: formData.plaintiffNickname,
        defendantNickname: formData.defendantNickname,
        reason: formData.reason,
        schedule: formData.schedule,
    });

    await interaction.reply({
        content: 'Ваше обращение в суд отправлено администрации. Если потребуется, с вами свяжутся для уточнения деталей.',
        ephemeral: true,
    });
}

async function handleCourtApprove(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для принятия судебных заявок.');
        return;
    }

    const caseId = interaction.customId.slice(APPROVE_COURT_PREFIX.length);
    const court = ensureCourtRecordFromMessage(interaction, caseId);
    const moderationBlockMessage = getCourtModerationBlockMessage(court.status);

    if (moderationBlockMessage) {
        await syncCourtMessageIfNeeded(interaction, court);
        await replyEphemeral(interaction, moderationBlockMessage);
        return;
    }

    await interaction.deferUpdate();

    patchCourt(caseId, {
        status: 'approving',
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    const updatedCourt = patchCourt(caseId, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    const user = updatedCourt?.userId
        ? await client.users.fetch(updatedCourt.userId).catch(() => null)
        : null;

    if (user) {
        try {
            await user.send(
                `Ваше обращение в суд принято администратором <@${interaction.user.id}>. Ожидайте дальнейшей информации по делу #${updatedCourt.caseId}.`,
            );
        } catch (error) {
            console.log('Не удалось отправить сообщение пользователю в личные сообщения.');
        }
    }

    await updateStatusMessage(
        interaction.message,
        0x57F287,
        buildCourtApprovedStatusText(updatedCourt),
    );
    await replyEphemeral(interaction, 'Судебная заявка принята.');
}

async function handleCourtReject(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для отклонения судебных заявок.');
        return;
    }

    const caseId = interaction.customId.slice(REJECT_COURT_PREFIX.length);
    const court = ensureCourtRecordFromMessage(interaction, caseId);
    const moderationBlockMessage = getCourtModerationBlockMessage(court.status);

    if (moderationBlockMessage) {
        await syncCourtMessageIfNeeded(interaction, court);
        await replyEphemeral(interaction, moderationBlockMessage);
        return;
    }

    await interaction.deferUpdate();

    patchCourt(caseId, {
        status: 'rejecting',
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    const updatedCourt = patchCourt(caseId, {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    const user = updatedCourt?.userId
        ? await client.users.fetch(updatedCourt.userId).catch(() => null)
        : null;

    if (user) {
        try {
            await user.send(
                `Ваше обращение в суд было отклонено администратором <@${interaction.user.id}>. При необходимости вы можете подать новую заявку позже.`,
            );
        } catch (error) {
            console.log('Не удалось отправить сообщение пользователю в личные сообщения.');
        }
    }

    await updateStatusMessage(
        interaction.message,
        0xED4245,
        buildCourtRejectedStatusText(updatedCourt),
    );
    await replyEphemeral(interaction, 'Судебная заявка отклонена.');
}

async function handleEmbedBuilderButton(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для работы с embed.');
        return;
    }

    const draft = getEmbedDraft(interaction.user.id);

    if (!draft) {
        await replyEphemeral(interaction, 'Черновик не найден. Используйте `/embed`, чтобы создать новый.');
        return;
    }

    switch (interaction.customId) {
        case EMBED_BUILDER_EDIT_BASIC_BUTTON_ID:
            await interaction.showModal(buildEmbedBuilderBasicModal(draft));
            return;
        case EMBED_BUILDER_EDIT_MEDIA_BUTTON_ID:
            await interaction.showModal(buildEmbedBuilderMediaModal(draft));
            return;
        case EMBED_BUILDER_EDIT_APPEARANCE_BUTTON_ID:
            await interaction.showModal(buildEmbedBuilderAppearanceModal(draft));
            return;
        case EMBED_BUILDER_EDIT_META_BUTTON_ID:
            await interaction.showModal(buildEmbedBuilderMetaModal(draft));
            return;
        case EMBED_BUILDER_EDIT_TARGET_BUTTON_ID:
            await interaction.showModal(buildEmbedBuilderTargetModal(draft));
            return;
        case EMBED_BUILDER_PREVIEW_BUTTON_ID:
            await interaction.update(buildEmbedBuilderPanelPayload(draft, 'Предпросмотр обновлен.', true));
            return;
        case EMBED_BUILDER_SEND_BUTTON_ID:
            await sendEmbedDraft(interaction, draft);
            return;
        case EMBED_BUILDER_RESET_BUTTON_ID:
            deleteEmbedDraft(interaction.user.id);
            await interaction.update({
                content: 'Черновик embed сброшен.',
                embeds: [],
                components: [],
            });
            return;
        default:
            await replyEphemeral(interaction, 'Неизвестное действие конструктора embed.');
    }
}

async function handleEmbedBuilderModalSubmit(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для работы с embed.');
        return;
    }

    const draft = getEmbedDraft(interaction.user.id);

    if (!draft) {
        await replyEphemeral(interaction, 'Черновик не найден. Используйте `/embed`, чтобы создать новый.');
        return;
    }

    const section = interaction.customId.split(':')[1];
    const updates = parseEmbedBuilderModalUpdates(interaction, draft, section);

    if (updates.error) {
        await replyEphemeral(interaction, updates.error);
        return;
    }

    const updatedDraft = patchEmbedDraft(interaction.user.id, updates.values);

    await interaction.reply({
        ...buildEmbedBuilderPanelPayload(updatedDraft, 'Черновик сохранен.', true),
        ephemeral: true,
    });
}

async function sendEmbedDraft(interaction, draft) {
    const built = buildEmbedFromDraft(draft);

    if (built.errors.length) {
        await interaction.update(buildEmbedBuilderPanelPayload(
            draft,
            `Не могу отправить embed:\n${built.errors.map((error) => `• ${error}`).join('\n')}`,
            true,
        ));
        return;
    }

    const targetChannel = await client.channels.fetch(draft.channelId).catch(() => null);

    if (!targetChannel || !targetChannel.isTextBased() || !('send' in targetChannel)) {
        await interaction.update(buildEmbedBuilderPanelPayload(
            draft,
            'Не удалось найти канал назначения. Нажмите `Канал` и укажите канал заново.',
            true,
        ));
        return;
    }

    try {
        if (draft.messageId) {
            const messageToEdit = await targetChannel.messages.fetch(draft.messageId);

            if (messageToEdit.author.id !== client.user.id) {
                await interaction.update(buildEmbedBuilderPanelPayload(
                    draft,
                    'Я могу редактировать только те сообщения, которые отправлял сам.',
                    true,
                ));
                return;
            }

            await messageToEdit.edit({ embeds: [built.embed] });
            deleteEmbedDraft(interaction.user.id);
            await interaction.update({
                content: `Embed успешно обновлен в канале <#${targetChannel.id}>. ID сообщения: \`${messageToEdit.id}\``,
                embeds: [],
                components: [],
            });
            return;
        }

        const sentMessage = await targetChannel.send({ embeds: [built.embed] });
        deleteEmbedDraft(interaction.user.id);
        await interaction.update({
            content: `Embed отправлен в канал <#${targetChannel.id}>. ID сообщения: \`${sentMessage.id}\``,
            embeds: [],
            components: [],
        });
    } catch (error) {
        console.error('Ошибка при отправке/редактировании embed из конструктора:', error);
        await interaction.update(buildEmbedBuilderPanelPayload(
            draft,
            'Не удалось отправить или обновить embed. Проверьте права бота, канал и ID сообщения.',
            true,
        ));
    }
}

async function handleEmbedSubmit(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для работы с embed.');
        return;
    }

    const parts = interaction.customId.split(':');
    const channelId = parts[1];
    const messageId = parts[2] === 'none' ? null : parts[2];

    const targetChannel = await client.channels.fetch(channelId).catch(() => null);

    if (!targetChannel || !targetChannel.isTextBased() || !('send' in targetChannel)) {
        await replyEphemeral(interaction, 'Не удалось найти текстовый канал для отправки/редактирования embed.');
        return;
    }

    const description = normalizeOptionalText(interaction.fields.getTextInputValue('embed_description'));
    const title = normalizeOptionalText(interaction.fields.getTextInputValue('embed_title'));
    const appearanceInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_appearance'));
    const mediaInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_media'));
    const metaInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_meta'));

    if (!title && !description && !appearanceInput && !mediaInput && !metaInput) {
        await replyEphemeral(interaction, 'Нужно заполнить хотя бы одно поле (например, вставить картинку), чтобы embed не был абсолютно пустым.');
        return;
    }

    const appearance = parseKeyValueBlock(appearanceInput);
    const media = parseKeyValueBlock(mediaInput);
    const meta = parseKeyValueBlock(metaInput);

    if (appearance.errors.length || media.errors.length || meta.errors.length) {
        await replyEphemeral(interaction, [...appearance.errors, ...media.errors, ...meta.errors].join('\n'));
        return;
    }

    const color = parseEmbedColor(appearance.values.color || null);

    if (appearance.values.color && color === null) {
        await replyEphemeral(interaction, 'Цвет нужно указать в формате `#RRGGBB` или `RRGGBB`.');
        return;
    }

    const imageUrl = validateHttpUrl(media.values.image || null);
    const thumbnailUrl = validateHttpUrl(media.values.thumbnail || null);
    const embedUrl = validateHttpUrl(appearance.values.url || null);
    const authorIconUrl = validateHttpUrl(meta.values.authoricon || null);
    const footerIconUrl = validateHttpUrl(meta.values.footericon || null);

    if ((media.values.image && !imageUrl) ||
        (media.values.thumbnail && !thumbnailUrl) ||
        (appearance.values.url && !embedUrl) ||
        (meta.values.authoricon && !authorIconUrl) ||
        (meta.values.footericon && !footerIconUrl)) {
        await replyEphemeral(interaction, 'Все ссылки должны быть полными URL в формате `http://` или `https://`.');
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(color ?? 0x5865F2)
        .setTimestamp();

    if (title) {
        embed.setTitle(title);
    }

    if (description) {
        embed.setDescription(description);
    }

    if (embedUrl) {
        embed.setURL(embedUrl);
    }

    if (imageUrl) {
        embed.setImage(imageUrl);
    }

    if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
    }

    if (meta.values.author) {
        const authorOptions = { name: meta.values.author };

        if (authorIconUrl) {
            authorOptions.iconURL = authorIconUrl;
        }

        embed.setAuthor(authorOptions);
    }

    if (meta.values.footer) {
        const footerOptions = { text: meta.values.footer };

        if (footerIconUrl) {
            footerOptions.iconURL = footerIconUrl;
        }

        embed.setFooter(footerOptions);
    }

    if (!shouldUseTimestamp(appearance.values.timestamp)) {
        embed.setTimestamp(null);
    }

    if (messageId) {
        try {
            const messageToEdit = await targetChannel.messages.fetch(messageId);
            await messageToEdit.edit({ embeds: [embed] });
            await interaction.reply({
                content: `Embed успешно обновлён! ID сообщения: \`${messageId}\``,
                ephemeral: true,
            });
        } catch (error) {
            console.error('Ошибка при редактировании сообщения:', error);
            await replyEphemeral(interaction, 'Не удалось обновить сообщение. Возможно, оно было удалено.');
        }
    } else {
        const sentMessage = await targetChannel.send({ embeds: [embed] });
        await interaction.reply({
            content: `Embed отправлен в канал <#${targetChannel.id}>. ID: \`${sentMessage.id}\` (сохрани ID, если захочешь отредактировать его позже)`,
            ephemeral: true,
        });
    }
}

function deconstructEmbed(embed) {
    if (!embed) return {};

    // Используем raw-данные объекта, чтобы обойти любые возможные ошибки геттеров discord.js
    const data = embed.data || embed;

    const appearance = [];
    if (data.color !== null && data.color !== undefined) {
        appearance.push(`color=#${data.color.toString(16).padStart(6, '0')}`);
    }
    if (data.url) appearance.push(`url=${data.url}`);
    if (data.timestamp) appearance.push(`timestamp=yes`);

    const media = [];
    if (data.image?.url) media.push(`image=${data.image.url}`);
    if (data.thumbnail?.url) media.push(`thumbnail=${data.thumbnail.url}`);

    const meta = [];
    if (data.author?.name) meta.push(`author=${data.author.name}`);

    // В raw-данных иконка может называться icon_url или iconURL в зависимости от версии
    const authorIcon = data.author?.icon_url || data.author?.iconURL;
    if (authorIcon) meta.push(`authorIcon=${authorIcon}`);

    if (data.footer?.text) meta.push(`footer=${data.footer.text}`);

    const footerIcon = data.footer?.icon_url || data.footer?.iconURL;
    if (footerIcon) meta.push(`footerIcon=${footerIcon}`);

    return {
        title: data.title || '',
        description: data.description || '',
        appearance: appearance.join('\n'),
        media: media.join('\n'),
        meta: meta.join('\n'),
    };
}

function createEmptyEmbedDraftData() {
    return {
        title: '',
        description: '',
        color: '',
        url: '',
        timestamp: false,
        imageUrl: '',
        thumbnailUrl: '',
        author: '',
        authorIconUrl: '',
        footer: '',
        footerIconUrl: '',
    };
}

function createEmbedDraftDataFromEmbed(embed) {
    if (!embed) {
        return createEmptyEmbedDraftData();
    }

    const data = embed.data || embed;
    const authorIcon = data.author?.icon_url || data.author?.iconURL || '';
    const footerIcon = data.footer?.icon_url || data.footer?.iconURL || '';

    return {
        title: data.title || '',
        description: data.description || '',
        color: data.color !== null && data.color !== undefined
            ? `#${data.color.toString(16).padStart(6, '0')}`
            : '',
        url: data.url || '',
        timestamp: Boolean(data.timestamp),
        imageUrl: data.image?.url || '',
        thumbnailUrl: data.thumbnail?.url || '',
        author: data.author?.name || '',
        authorIconUrl: authorIcon,
        footer: data.footer?.text || '',
        footerIconUrl: footerIcon,
    };
}

function buildEmbedBuilderPanelPayload(draft, notice = null, includePreview = false) {
    const built = buildEmbedFromDraft(draft);
    const statusLines = [
        'Черновик сохраняется после каждой модалки. Можно закрыть окно, сходить за ссылкой и открыть `/embed` снова.',
        '',
        `Канал: ${draft.channelId ? `<#${draft.channelId}>` : 'не выбран'}`,
        `Режим: ${draft.messageId ? `редактирование сообщения \`${draft.messageId}\`` : 'новое сообщение'}`,
        `Обновлен: ${draft.updatedAt ? formatDiscordTimestamp(draft.updatedAt, 'R') : 'только что'}`,
    ];

    const filledParts = [
        draft.title ? 'заголовок' : null,
        draft.description ? 'описание' : null,
        draft.color ? 'цвет' : null,
        draft.url ? 'ссылка заголовка' : null,
        draft.imageUrl ? 'image' : null,
        draft.thumbnailUrl ? 'thumbnail' : null,
        draft.author ? 'автор' : null,
        draft.footer ? 'footer' : null,
        draft.timestamp ? 'timestamp' : null,
    ].filter(Boolean);

    const panelEmbed = new EmbedBuilder()
        .setTitle('Конструктор embed')
        .setDescription(statusLines.join('\n'))
        .setColor(0x5865F2)
        .addFields(
            {
                name: 'Заполнено',
                value: filledParts.length ? filledParts.join(', ') : 'Пока ничего не заполнено.',
            },
            {
                name: 'Картинки',
                value: [
                    `Image: ${draft.imageUrl ? truncateText(draft.imageUrl, 140) : 'не задано'}`,
                    `Thumbnail: ${draft.thumbnailUrl ? truncateText(draft.thumbnailUrl, 140) : 'не задано'}`,
                ].join('\n'),
            },
        );

    const payload = {
        embeds: [panelEmbed],
        components: buildEmbedBuilderComponents(),
    };

    if (notice) {
        payload.content = truncateText(notice, 1900);
    }

    if (includePreview) {
        if (built.errors.length) {
            panelEmbed.addFields({
                name: 'Что нужно поправить',
                value: truncateText(built.errors.map((error) => `• ${error}`).join('\n'), 1024),
            });
        } else {
            payload.embeds.push(built.embed);
        }
    }

    return payload;
}

function buildEmbedBuilderComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(EMBED_BUILDER_EDIT_BASIC_BUTTON_ID)
                .setLabel('Текст')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(EMBED_BUILDER_EDIT_MEDIA_BUTTON_ID)
                .setLabel('Image/Thumbnail')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(EMBED_BUILDER_EDIT_APPEARANCE_BUTTON_ID)
                .setLabel('Вид')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(EMBED_BUILDER_EDIT_META_BUTTON_ID)
                .setLabel('Автор/Footer')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(EMBED_BUILDER_EDIT_TARGET_BUTTON_ID)
                .setLabel('Канал')
                .setStyle(ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(EMBED_BUILDER_PREVIEW_BUTTON_ID)
                .setLabel('Предпросмотр')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(EMBED_BUILDER_SEND_BUTTON_ID)
                .setLabel('Отправить')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(EMBED_BUILDER_RESET_BUTTON_ID)
                .setLabel('Сбросить')
                .setStyle(ButtonStyle.Danger),
        ),
    ];
}

function parseEmbedBuilderModalUpdates(interaction, draft, section) {
    switch (section) {
        case 'basic':
            return {
                values: {
                    title: normalizeOptionalText(interaction.fields.getTextInputValue('embed_title')) || '',
                    description: normalizeOptionalText(interaction.fields.getTextInputValue('embed_description')) || '',
                },
            };
        case 'media':
            return parseEmbedBuilderMediaUpdates(interaction);
        case 'appearance':
            return parseEmbedBuilderAppearanceUpdates(interaction);
        case 'meta':
            return parseEmbedBuilderMetaUpdates(interaction);
        case 'target':
            return parseEmbedBuilderTargetUpdates(interaction, draft);
        default:
            return {
                error: 'Неизвестный раздел конструктора embed.',
            };
    }
}

function parseEmbedBuilderMediaUpdates(interaction) {
    const imageInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_image_url'));
    const thumbnailInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_thumbnail_url'));
    const imageUrl = validateOptionalUrlInput(imageInput, 'Image URL');
    const thumbnailUrl = validateOptionalUrlInput(thumbnailInput, 'Thumbnail URL');

    if (imageUrl.error) {
        return imageUrl;
    }

    if (thumbnailUrl.error) {
        return thumbnailUrl;
    }

    return {
        values: {
            imageUrl: imageUrl.value,
            thumbnailUrl: thumbnailUrl.value,
        },
    };
}

function parseEmbedBuilderAppearanceUpdates(interaction) {
    const colorInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_color'));
    const urlInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_url'));
    const timestampInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_timestamp'));
    const color = normalizeEmbedColorInput(colorInput);
    const url = validateOptionalUrlInput(urlInput, 'Ссылка заголовка');
    const timestamp = parseTimestampInput(timestampInput);

    if (colorInput && !color) {
        return {
            error: 'Цвет нужно указать в формате `#RRGGBB` или `RRGGBB`.',
        };
    }

    if (url.error) {
        return url;
    }

    if (timestamp === null) {
        return {
            error: 'Timestamp нужно указать как `yes`/`no`, `да`/`нет` или оставить пустым.',
        };
    }

    return {
        values: {
            color,
            url: url.value,
            timestamp,
        },
    };
}

function parseEmbedBuilderMetaUpdates(interaction) {
    const authorIconInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_author_icon_url'));
    const footerIconInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_footer_icon_url'));
    const authorIconUrl = validateOptionalUrlInput(authorIconInput, 'Иконка автора');
    const footerIconUrl = validateOptionalUrlInput(footerIconInput, 'Иконка footer');

    if (authorIconUrl.error) {
        return authorIconUrl;
    }

    if (footerIconUrl.error) {
        return footerIconUrl;
    }

    return {
        values: {
            author: normalizeOptionalText(interaction.fields.getTextInputValue('embed_author')) || '',
            authorIconUrl: authorIconUrl.value,
            footer: normalizeOptionalText(interaction.fields.getTextInputValue('embed_footer')) || '',
            footerIconUrl: footerIconUrl.value,
        },
    };
}

function parseEmbedBuilderTargetUpdates(interaction, draft) {
    const channelInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_channel'));
    const messageInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_message_id'));
    const channelTarget = parseDiscordMessageTarget(channelInput, 'channel');
    const messageTarget = parseDiscordMessageTarget(messageInput, 'message');

    if (!channelTarget.channelId) {
        return {
            error: 'Канал нужно указать как ID, #упоминание или ссылку Discord.',
        };
    }

    if (messageInput && !messageTarget.messageId) {
        return {
            error: 'Сообщение для редактирования нужно указать как ID или ссылку Discord.',
        };
    }

    return {
        values: {
            channelId: messageTarget.channelId || channelTarget.channelId || draft.channelId,
            messageId: messageInput ? messageTarget.messageId : (channelTarget.messageId || null),
        },
    };
}

function buildEmbedFromDraft(draft) {
    const errors = [];
    const color = draft.color ? parseEmbedColor(draft.color) : null;
    const embedUrl = validateOptionalUrlForBuild(draft.url, 'Ссылка заголовка', errors);
    const imageUrl = validateOptionalUrlForBuild(draft.imageUrl, 'Image URL', errors);
    const thumbnailUrl = validateOptionalUrlForBuild(draft.thumbnailUrl, 'Thumbnail URL', errors);
    const authorIconUrl = validateOptionalUrlForBuild(draft.authorIconUrl, 'Иконка автора', errors);
    const footerIconUrl = validateOptionalUrlForBuild(draft.footerIconUrl, 'Иконка footer', errors);

    if (draft.color && color === null) {
        errors.push('цвет должен быть в формате `#RRGGBB` или `RRGGBB`.');
    }

    if (!draft.title &&
        !draft.description &&
        !imageUrl &&
        !thumbnailUrl &&
        !draft.author &&
        !draft.footer) {
        errors.push('заполните хотя бы текст, картинку, автора или footer.');
    }

    if (errors.length) {
        return {
            embed: null,
            errors,
        };
    }

    const embed = new EmbedBuilder()
        .setColor(color ?? 0x5865F2);

    if (draft.title) {
        embed.setTitle(draft.title);
    }

    if (draft.description) {
        embed.setDescription(draft.description);
    }

    if (embedUrl) {
        embed.setURL(embedUrl);
    }

    if (imageUrl) {
        embed.setImage(imageUrl);
    }

    if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
    }

    if (draft.author) {
        const authorOptions = { name: draft.author };

        if (authorIconUrl) {
            authorOptions.iconURL = authorIconUrl;
        }

        embed.setAuthor(authorOptions);
    }

    if (draft.footer) {
        const footerOptions = { text: draft.footer };

        if (footerIconUrl) {
            footerOptions.iconURL = footerIconUrl;
        }

        embed.setFooter(footerOptions);
    }

    if (draft.timestamp) {
        embed.setTimestamp();
    }

    return {
        embed,
        errors,
    };
}

function validateOptionalUrlInput(value, fieldName) {
    if (!value) {
        return {
            value: '',
        };
    }

    const url = validateHttpUrl(value);

    if (!url) {
        return {
            error: `${fieldName} должен быть полной ссылкой в формате \`http://\` или \`https://\`.`,
        };
    }

    return {
        value: url,
    };
}

function validateOptionalUrlForBuild(value, fieldName, errors) {
    if (!value) {
        return null;
    }

    const url = validateHttpUrl(value);

    if (!url) {
        errors.push(`${fieldName} должен быть полной ссылкой в формате \`http://\` или \`https://\`.`);
        return null;
    }

    return url;
}

function normalizeEmbedColorInput(value) {
    if (!value) {
        return '';
    }

    const color = parseEmbedColor(value);

    if (color === null) {
        return null;
    }

    return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
}

function parseTimestampInput(value) {
    if (!value) {
        return false;
    }

    const normalized = value.trim().toLowerCase();

    if (['yes', 'true', '1', 'on', 'да'].includes(normalized)) {
        return true;
    }

    if (['no', 'false', '0', 'off', 'нет'].includes(normalized)) {
        return false;
    }

    return null;
}

function parseDiscordMessageTarget(value, mode = 'channel') {
    if (!value) {
        return {};
    }

    const trimmed = value.trim();
    const messageLinkMatch = trimmed.match(/channels\/(?:\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})/);

    if (messageLinkMatch) {
        return {
            channelId: messageLinkMatch[1],
            messageId: messageLinkMatch[2],
        };
    }

    const channelMentionMatch = trimmed.match(/^<#(\d{17,20})>$/);

    if (channelMentionMatch) {
        return {
            channelId: channelMentionMatch[1],
        };
    }

    const snowflakeMatch = trimmed.match(/\d{17,20}/);

    if (snowflakeMatch) {
        return mode === 'message'
            ? { messageId: snowflakeMatch[0] }
            : { channelId: snowflakeMatch[0] };
    }

    return {};
}

function setTextInputValue(input, value) {
    if (value) {
        input.setValue(String(value));
    }
}

function truncateText(value, maxLength) {
    const text = String(value || '');

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, Math.max(maxLength - 3, 0))}...`;
}

function ensureApplicationRecordFromMessage(interaction, userId) {
    const existingApplication = getApplication(userId);

    if (existingApplication) {
        return existingApplication;
    }

    const now = new Date(interaction.message.createdTimestamp || Date.now()).toISOString();

    return saveApplication({
        userId,
        guildId: interaction.guildId,
        applicationChannelId: interaction.channelId,
        applicationMessageId: interaction.message.id,
        status: 'pending',
        submittedAt: now,
        updatedAt: now,
        submissionCount: 1,
        resubmissionCount: 0,
        source: 'legacy-message',
    });
}

function ensureCourtRecordFromMessage(interaction, caseId) {
    const existingCourt = getCourt(caseId);

    if (existingCourt) {
        return existingCourt;
    }

    const now = new Date(interaction.message.createdTimestamp || Date.now()).toISOString();
    const applicantField = interaction.message.embeds[0]?.fields?.find((field) => field.name === 'Истец (Discord)');
    const userIdMatch = applicantField?.value?.match(/\d{17,20}/);

    return saveCourt({
        caseId,
        userId: userIdMatch ? userIdMatch[0] : null,
        guildId: interaction.guildId,
        reviewChannelId: interaction.channelId,
        reviewMessageId: interaction.message.id,
        status: 'pending',
        submittedAt: now,
        updatedAt: now,
        source: 'legacy-message',
    });
}

async function updateStatusMessage(message, color, statusText) {
    const originalEmbed = message.embeds[0];
    const baseEmbed = originalEmbed ? EmbedBuilder.from(originalEmbed) : new EmbedBuilder();
    const remainingFields = (originalEmbed?.fields || []).filter((field) => field.name !== 'Статус');

    baseEmbed.setColor(color).setFields([
        ...remainingFields,
        {
            name: 'Статус',
            value: statusText,
        },
    ]);

    await message.edit({
        embeds: [baseEmbed],
        components: [],
    });
}

async function getSubmissionBlockReason(interaction) {
    if (hasApprovedRole(interaction)) {
        return 'У вас уже есть доступ к серверу. Повторная подача заявки не требуется.';
    }

    const existingApplication = getApplication(interaction.user.id);

    if (existingApplication) {
        return getStoredApplicationBlockMessage(existingApplication);
    }

    const legacyApplication = await hydrateLegacyApplicationFromChannel(interaction.user.id);

    if (legacyApplication) {
        return getStoredApplicationBlockMessage(legacyApplication);
    }

    return null;
}

function getStoredApplicationBlockMessage(application) {
    switch (application?.status) {
        case 'pending':
            return 'Ваша заявка уже отправлена и ждет решения администрации.';
        case 'approving':
        case 'rejecting':
            return 'Ваша заявка сейчас обрабатывается администрацией. Попробуйте чуть позже.';
        case 'approved':
            return 'Ваша заявка уже была одобрена. Повторная подача не требуется.';
        case 'rejected':
            return getRejectedApplicationBlockMessage(application);
        default:
            return 'У вас уже есть заявка в системе.';
    }
}

function getModerationBlockMessage(status) {
    switch (status) {
        case 'approved':
            return 'Эта заявка уже была одобрена.';
        case 'rejected':
            return 'Эта заявка уже была отклонена.';
        case 'approving':
        case 'rejecting':
            return 'Эта заявка уже обрабатывается другим модератором.';
        default:
            return null;
    }
}

function getCourtModerationBlockMessage(status) {
    switch (status) {
        case 'approved':
            return 'Эта судебная заявка уже была принята.';
        case 'rejected':
            return 'Эта судебная заявка уже была отклонена.';
        case 'approving':
        case 'rejecting':
            return 'Эта судебная заявка уже обрабатывается другим модератором.';
        default:
            return null;
    }
}

function getRejectedApplicationBlockMessage(application) {
    const state = getApplicationResubmissionState(application);

    if (state.remainingResubmissions <= 0) {
        return `Ваша анкета отклонена. Лимит повторных подач исчерпан (${APPLICATION_RESUBMISSION_LIMIT} из ${APPLICATION_RESUBMISSION_LIMIT}).`;
    }

    if (state.canResubmitNow) {
        return null;
    }

    const exactTime = formatDiscordTimestamp(state.nextSubmissionDate, 'F');
    const relativeTime = formatDiscordTimestamp(state.nextSubmissionDate, 'R');
    return `Ваша анкета отклонена. Вы можете подать повторную анкету ${exactTime} (${relativeTime}). Осталось повторных подач: ${state.remainingResubmissions}.`;
}

function getApplicationSubmissionCount(application) {
    const submissionCount = Number(application?.submissionCount);

    if (Number.isInteger(submissionCount) && submissionCount > 0) {
        return submissionCount;
    }

    return application ? 1 : 0;
}

function getApplicationResubmissionCount(application) {
    const resubmissionCount = Number(application?.resubmissionCount);

    if (Number.isInteger(resubmissionCount) && resubmissionCount >= 0) {
        return resubmissionCount;
    }

    return Math.max(getApplicationSubmissionCount(application) - 1, 0);
}

function getApplicationNextSubmissionDate(application) {
    if (application?.nextSubmissionAt) {
        const nextSubmissionDate = new Date(application.nextSubmissionAt);

        if (!Number.isNaN(nextSubmissionDate.getTime())) {
            return nextSubmissionDate;
        }
    }

    const fallbackBase = application?.rejectedAt || application?.reviewedAt || application?.updatedAt;

    if (!fallbackBase) {
        return null;
    }

    const baseDate = new Date(fallbackBase);

    if (Number.isNaN(baseDate.getTime())) {
        return null;
    }

    return new Date(baseDate.getTime() + APPLICATION_RESUBMISSION_COOLDOWN_MS);
}

function getApplicationResubmissionState(application) {
    const resubmissionCount = getApplicationResubmissionCount(application);
    const remainingResubmissions = Math.max(APPLICATION_RESUBMISSION_LIMIT - resubmissionCount, 0);
    const nextSubmissionDate = getApplicationNextSubmissionDate(application);
    const canResubmitNow = Boolean(
        remainingResubmissions > 0 &&
        (!nextSubmissionDate || nextSubmissionDate.getTime() <= Date.now()),
    );

    return {
        resubmissionCount,
        remainingResubmissions,
        nextSubmissionDate,
        canResubmitNow,
    };
}

function buildApplicationRejectedDirectMessage(application) {
    const state = getApplicationResubmissionState(application);

    if (state.remainingResubmissions <= 0) {
        return `Ваша анкета была отклонена. Лимит повторных подач исчерпан (${APPLICATION_RESUBMISSION_LIMIT} из ${APPLICATION_RESUBMISSION_LIMIT}).`;
    }

    const exactTime = formatDiscordTimestamp(state.nextSubmissionDate, 'F');
    const relativeTime = formatDiscordTimestamp(state.nextSubmissionDate, 'R');
    return `Ваша анкета была отклонена. Повторную анкету можно подать ${exactTime} (${relativeTime}). Осталось повторных подач: ${state.remainingResubmissions}.`;
}

function buildApplicationRejectedStatusText(application) {
    const moderatorText = application?.moderatorId
        ? `администратором <@${application.moderatorId}>`
        : 'администратором';
    const state = getApplicationResubmissionState(application);

    if (state.remainingResubmissions <= 0) {
        return `Отклонено ${moderatorText}. Лимит повторных подач исчерпан.`;
    }

    if (state.canResubmitNow) {
        return `Отклонено ${moderatorText}. Повторная подача уже доступна. Осталось повторных подач: ${state.remainingResubmissions}.`;
    }

    const relativeTime = formatDiscordTimestamp(state.nextSubmissionDate, 'R');
    return `Отклонено ${moderatorText}. Повторная подача доступна ${relativeTime}. Осталось повторных подач: ${state.remainingResubmissions}.`;
}

function buildApplicationApprovedStatusText(application) {
    return application?.moderatorId
        ? `Одобрено администратором <@${application.moderatorId}>.`
        : 'Одобрено администратором.';
}

function buildCourtApprovedStatusText(court) {
    return court?.moderatorId
        ? `Принято администратором <@${court.moderatorId}>.`
        : 'Принято администратором.';
}

function buildCourtRejectedStatusText(court) {
    return court?.moderatorId
        ? `Отклонено администратором <@${court.moderatorId}>.`
        : 'Отклонено администратором.';
}

async function synchronizeClosedModerationMessages() {
    await synchronizeApplicationReviewMessages();
    await synchronizeCourtReviewMessages();
}

async function synchronizeApplicationReviewMessages() {
    const applicationChannel = await client.channels.fetch(process.env.APPLICATION_CHANNEL_ID).catch(() => null);

    if (!applicationChannel || !applicationChannel.isTextBased() || !('messages' in applicationChannel)) {
        return;
    }

    const recentMessages = await applicationChannel.messages.fetch({ limit: 100 }).catch(() => null);

    if (!recentMessages) {
        return;
    }

    for (const message of recentMessages.values()) {
        if (message.author.id !== client.user.id || !message.components.length) {
            continue;
        }

        const userId = extractApplicationUserId(message);

        if (!userId) {
            continue;
        }

        const application = getApplication(userId);

        if (!application) {
            continue;
        }

        await synchronizeApplicationMessage(message, application);
    }
}

async function synchronizeCourtReviewMessages() {
    const reviewChannel = await client.channels.fetch(getCourtReviewChannelId()).catch(() => null);

    if (!reviewChannel || !reviewChannel.isTextBased() || !('messages' in reviewChannel)) {
        return;
    }

    const recentMessages = await reviewChannel.messages.fetch({ limit: 100 }).catch(() => null);

    if (!recentMessages) {
        return;
    }

    for (const message of recentMessages.values()) {
        if (message.author.id !== client.user.id || !message.components.length) {
            continue;
        }

        const caseId = extractCourtCaseId(message);

        if (!caseId) {
            continue;
        }

        const court = getCourt(caseId);

        if (!court) {
            continue;
        }

        await synchronizeCourtMessage(message, court);
    }
}

function extractApplicationUserId(message) {
    for (const row of message.components) {
        for (const component of row.components) {
            if (component.customId?.startsWith(APPROVE_APPLICATION_PREFIX)) {
                return component.customId.slice(APPROVE_APPLICATION_PREFIX.length);
            }

            if (component.customId?.startsWith(REJECT_APPLICATION_PREFIX)) {
                return component.customId.slice(REJECT_APPLICATION_PREFIX.length);
            }
        }
    }

    return null;
}

function extractCourtCaseId(message) {
    for (const row of message.components) {
        for (const component of row.components) {
            if (component.customId?.startsWith(APPROVE_COURT_PREFIX)) {
                return component.customId.slice(APPROVE_COURT_PREFIX.length);
            }

            if (component.customId?.startsWith(REJECT_COURT_PREFIX)) {
                return component.customId.slice(REJECT_COURT_PREFIX.length);
            }
        }
    }

    return null;
}

async function synchronizeApplicationMessage(message, application) {
    if (application.status === 'approved') {
        await updateStatusMessage(
            message,
            0x57F287,
            buildApplicationApprovedStatusText(application),
        ).catch(() => {});
        return;
    }

    if (application.status === 'rejected') {
        await updateStatusMessage(
            message,
            0xED4245,
            buildApplicationRejectedStatusText(application),
        ).catch(() => {});
    }
}

async function synchronizeCourtMessage(message, court) {
    if (court.status === 'approved') {
        await updateStatusMessage(
            message,
            0x57F287,
            buildCourtApprovedStatusText(court),
        ).catch(() => {});
        return;
    }

    if (court.status === 'rejected') {
        await updateStatusMessage(
            message,
            0xED4245,
            buildCourtRejectedStatusText(court),
        ).catch(() => {});
    }
}

async function syncApplicationMessageIfNeeded(interaction, application) {
    if (!interaction.message.components.length) {
        return;
    }

    await synchronizeApplicationMessage(interaction.message, application);
}

async function syncCourtMessageIfNeeded(interaction, court) {
    if (!interaction.message.components.length) {
        return;
    }

    await synchronizeCourtMessage(interaction.message, court);
}

function formatDiscordTimestamp(value, style = 'F') {
    if (!value) {
        return 'через 12 часов';
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'через 12 часов';
    }

    return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

function getCourtPanelChannelId() {
    return process.env.COURT_PANEL_CHANNEL_ID || DEFAULT_COURT_PANEL_CHANNEL_ID;
}

function getCourtReviewChannelId() {
    return process.env.COURT_REVIEW_CHANNEL_ID || DEFAULT_COURT_REVIEW_CHANNEL_ID;
}

function createCourtCaseId() {
    return `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12);
}

function hasStaffRole(interaction) {
    return Boolean(interaction.member?.roles?.cache?.has(process.env.STAFF_ROLE_ID));
}

function hasApprovedRole(interaction) {
    return Boolean(interaction.member?.roles?.cache?.has(process.env.APPROVED_ROLE_ID));
}

function normalizeOptionalText(value) {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}

function parseEmbedColor(value) {
    if (!value) {
        return null;
    }

    const normalized = value.replace('#', '').trim();

    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return null;
    }

    return Number.parseInt(normalized, 16);
}

function parseKeyValueBlock(value) {
    if (!value) {
        return {
            values: {},
            errors: [],
        };
    }

    const values = {};
    const errors = [];
    const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
        const separatorIndex = line.indexOf('=');

        if (separatorIndex === -1) {
            errors.push(`Не удалось разобрать строку: \`${line}\`. Используй формат \`ключ=значение\`.`);
            continue;
        }

        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        const parsedValue = line.slice(separatorIndex + 1).trim();

        if (!key || !parsedValue) {
            errors.push(`Не удалось разобрать строку: \`${line}\`. Используй формат \`ключ=значение\`.`);
            continue;
        }

        values[key] = parsedValue;
    }

    return {
        values,
        errors,
    };
}

function validateHttpUrl(value) {
    if (!value) {
        return null;
    }

    try {
        const url = new URL(value);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return null;
        }

        return url.toString();
    } catch (error) {
        return null;
    }
}

function shouldUseTimestamp(value) {
    if (!value) {
        return false;
    }

    return ['yes', 'true', '1', 'on'].includes(value.trim().toLowerCase());
}

async function hydrateLegacyApplicationFromChannel(userId) {
    const applicationChannel = await client.channels.fetch(process.env.APPLICATION_CHANNEL_ID).catch(() => null);

    if (!applicationChannel || !applicationChannel.isTextBased() || !('messages' in applicationChannel)) {
        return null;
    }

    const recentMessages = await applicationChannel.messages.fetch({ limit: 100 }).catch(() => null);

    if (!recentMessages) {
        return null;
    }

    const legacyMessage = recentMessages.find((message) =>
        message.components.some((row) =>
            row.components.some((component) =>
                component.customId === `${APPROVE_APPLICATION_PREFIX}${userId}` ||
                component.customId === `${REJECT_APPLICATION_PREFIX}${userId}`,
            ),
        ),
    );

    if (!legacyMessage) {
        return null;
    }

    const submittedAt = new Date(legacyMessage.createdTimestamp || Date.now()).toISOString();

    return saveApplication({
        userId,
        guildId: legacyMessage.guildId || null,
        applicationChannelId: legacyMessage.channelId,
        applicationMessageId: legacyMessage.id,
        status: 'pending',
        submittedAt,
        updatedAt: submittedAt,
        submissionCount: 1,
        resubmissionCount: 0,
        source: 'legacy-channel-scan',
    });
}

async function showPanelForUser(userId) {
    const panelChannel = await client.channels.fetch(process.env.PANEL_CHANNEL_ID).catch(() => null);

    if (!panelChannel || !('permissionOverwrites' in panelChannel)) {
        return;
    }

    const overwrite = panelChannel.permissionOverwrites.cache.get(userId);

    if (overwrite) {
        await overwrite.delete().catch(() => {});
    }
}

async function replyEphemeral(interaction, content) {
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
            content,
            ephemeral: true,
        }).catch(() => {});
        return;
    }

    await interaction.reply({
        content,
        ephemeral: true,
    }).catch(() => {});
}
