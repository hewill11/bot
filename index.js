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

const PORT = Number(process.env.PORT) || 10000;
const APPLICATION_MODAL_ID = 'minecraft_application_modal';
const EMBED_MODAL_PREFIX = 'create_embed_modal';
const OPEN_APPLICATION_BUTTON_ID = 'open_application_modal';
const APPROVE_APPLICATION_PREFIX = 'approve_application_';
const REJECT_APPLICATION_PREFIX = 'reject_application_';
const APPLICATION_COMMAND_NAMES = new Set(['анкета', 'заявка']);
const EMBED_COMMAND_NAME = 'embed';
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
            if (interaction.customId === OPEN_APPLICATION_BUTTON_ID) {
                await handleApplicationOpen(interaction);
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
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === APPLICATION_MODAL_ID) {
                await handleApplicationSubmit(interaction);
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

function buildCreateEmbedModal(channelId) {
    const modal = new ModalBuilder()
        .setCustomId(`${EMBED_MODAL_PREFIX}:${channelId}`)
        .setTitle('Создание embed');

    const titleInput = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel('Заголовок')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256)
        .setPlaceholder('Например: Новости проекта');

    const descriptionInput = new TextInputBuilder()
        .setCustomId('embed_description')
        .setLabel('Описание')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000)
        .setPlaceholder('Основной текст embed.');

    const colorInput = new TextInputBuilder()
        .setCustomId('embed_color')
        .setLabel('Цвет')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7)
        .setPlaceholder('Например: #5865F2');

    const footerInput = new TextInputBuilder()
        .setCustomId('embed_footer')
        .setLabel('Подвал')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2048)
        .setPlaceholder('Например: Администрация EVOSMP');

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(footerInput),
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

async function ensureApplicationPanel() {
    const panelChannel = await client.channels.fetch(process.env.PANEL_CHANNEL_ID);

    if (!panelChannel || !panelChannel.isTextBased() || !('messages' in panelChannel)) {
        throw new Error('PANEL_CHANNEL_ID не указывает на текстовый канал.');
    }

    const recentMessages = await panelChannel.messages.fetch({ limit: 100 });
    const existingPanel = recentMessages.find((message) =>
        message.author.id === client.user.id &&
        message.components.some((row) =>
            row.components.some((component) => component.customId === OPEN_APPLICATION_BUTTON_ID),
        ),
    );

    if (existingPanel) {
        return;
    }

    const panelEmbed = new EmbedBuilder()
        .setTitle('Анкета на участие в проекте EVOSMP')
        .setDescription('Нажми кнопку ниже, чтобы заполнить анкету.\n\nПовторная подача заявки отключена.')
        .setColor(0x5865F2)
        .setFooter({ text: 'После отправки заявка попадет администрации.' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(OPEN_APPLICATION_BUTTON_ID)
            .setLabel('Подать заявку')
            .setStyle(ButtonStyle.Primary),
    );

    await panelChannel.send({
        embeds: [panelEmbed],
        components: [row],
    });
}

async function handleApplicationOpen(interaction) {
    const blockReason = await getSubmissionBlockReason(interaction);

    if (blockReason) {
        await replyEphemeral(interaction, blockReason);
        return;
    }

    await interaction.showModal(buildApplicationModal());
}

async function handleEmbedCommand(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для создания embed.');
        return;
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel || !targetChannel.isTextBased() || !('send' in targetChannel)) {
        await replyEphemeral(interaction, 'Нужен текстовый канал, куда бот сможет отправить embed.');
        return;
    }

    await interaction.showModal(buildCreateEmbedModal(targetChannel.id));
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

    saveApplication({
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
    });

    try {
        await hidePanelForUser(interaction.user.id);
    } catch (error) {
        console.error('Не удалось скрыть панель заявок для пользователя:', error);
    }

    await interaction.reply({
        content: 'Ваша заявка отправлена администрации. Повторная подача отключена.',
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
        await replyEphemeral(interaction, moderationBlockMessage);
        return;
    }

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

    patchApplication(userId, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    await updateApplicationMessage(
        interaction,
        0x57F287,
        `Одобрено администратором <@${interaction.user.id}>`,
    );
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
        await replyEphemeral(interaction, moderationBlockMessage);
        return;
    }

    patchApplication(userId, {
        status: 'rejecting',
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    const member = await interaction.guild.members.fetch(userId).catch(() => null);

    if (member) {
        try {
            await member.send('Ваша заявка была отклонена. Вы были забанены на сервере.');
        } catch (error) {
            console.log('Не удалось отправить сообщение пользователю в личные сообщения.');
        }
    }

    try {
        await interaction.guild.members.ban(userId, {
            reason: `Заявка отклонена администратором ${interaction.user.tag}`,
        });
    } catch (error) {
        patchApplication(userId, {
            status: 'pending',
            updatedAt: new Date().toISOString(),
        });
        console.error('Ошибка при бане пользователя:', error);
        await replyEphemeral(interaction, 'Не удалось забанить пользователя. Проверь права бота и позицию роли.');
        return;
    }

    patchApplication(userId, {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
    });

    await updateApplicationMessage(
        interaction,
        0xED4245,
        `Отклонено администратором <@${interaction.user.id}>. Пользователь забанен.`,
    );
}

async function handleEmbedSubmit(interaction) {
    if (!hasStaffRole(interaction)) {
        await replyEphemeral(interaction, 'У вас нет прав для создания embed.');
        return;
    }

    const [, channelId] = interaction.customId.split(':');
    const targetChannel = await client.channels.fetch(channelId).catch(() => null);

    if (!targetChannel || !targetChannel.isTextBased() || !('send' in targetChannel)) {
        await replyEphemeral(interaction, 'Не удалось найти текстовый канал для отправки embed.');
        return;
    }

    const description = interaction.fields.getTextInputValue('embed_description').trim();
    const title = normalizeOptionalText(interaction.fields.getTextInputValue('embed_title'));
    const colorInput = normalizeOptionalText(interaction.fields.getTextInputValue('embed_color'));
    const footer = normalizeOptionalText(interaction.fields.getTextInputValue('embed_footer'));
    const color = parseEmbedColor(colorInput);

    if (colorInput && color === null) {
        await replyEphemeral(interaction, 'Цвет нужно указать в формате `#RRGGBB` или `RRGGBB`.');
        return;
    }

    const embed = new EmbedBuilder()
        .setDescription(description)
        .setColor(color ?? 0x5865F2)
        .setTimestamp();

    if (title) {
        embed.setTitle(title);
    }

    if (footer) {
        embed.setFooter({ text: footer });
    }

    await targetChannel.send({
        embeds: [embed],
    });

    await interaction.reply({
        content: `Embed отправлен в канал <#${targetChannel.id}>.`,
        ephemeral: true,
    });
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
        source: 'legacy-message',
    });
}

async function updateApplicationMessage(interaction, color, statusText) {
    const originalEmbed = interaction.message.embeds[0];
    const baseEmbed = originalEmbed ? EmbedBuilder.from(originalEmbed) : new EmbedBuilder();
    const remainingFields = (originalEmbed?.fields || []).filter((field) => field.name !== 'Статус');

    baseEmbed.setColor(color).setFields([
        ...remainingFields,
        {
            name: 'Статус',
            value: statusText,
        },
    ]);

    await interaction.update({
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
        return getStoredApplicationBlockMessage(existingApplication.status);
    }

    const legacyApplication = await hydrateLegacyApplicationFromChannel(interaction.user.id);

    if (legacyApplication) {
        return getStoredApplicationBlockMessage(legacyApplication.status);
    }

    const panelAlreadyHidden = await isPanelHiddenForUser(interaction.user.id);

    if (panelAlreadyHidden) {
        return 'Вы уже отправляли заявку раньше. Повторная подача отключена.';
    }

    return null;
}

function getStoredApplicationBlockMessage(status) {
    switch (status) {
        case 'pending':
            return 'Ваша заявка уже отправлена и ждет решения администрации.';
        case 'approving':
        case 'rejecting':
            return 'Ваша заявка сейчас обрабатывается администрацией. Попробуйте чуть позже.';
        case 'approved':
            return 'Ваша заявка уже была одобрена. Повторная подача не требуется.';
        case 'rejected':
            return 'Ваша заявка уже была отклонена. Повторная подача отключена.';
        default:
            return 'У вас уже есть заявка в системе. Повторная подача отключена.';
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
        source: 'legacy-channel-scan',
    });
}

async function isPanelHiddenForUser(userId) {
    const panelChannel = await client.channels.fetch(process.env.PANEL_CHANNEL_ID).catch(() => null);

    if (!panelChannel || !('permissionOverwrites' in panelChannel)) {
        return false;
    }

    const overwrite = panelChannel.permissionOverwrites.cache.get(userId);
    return Boolean(overwrite && overwrite.deny.has('ViewChannel'));
}

async function hidePanelForUser(userId) {
    const panelChannel = await client.channels.fetch(process.env.PANEL_CHANNEL_ID);

    if (!panelChannel || !('permissionOverwrites' in panelChannel)) {
        return;
    }

    await panelChannel.permissionOverwrites.edit(userId, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false,
    });
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
