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

function buildCreateEmbedModal(channelId, messageId = null, existingData = {}) {
    // Сохраняем и ID канала, и ID сообщения (если есть) в CustomID
    const customId = messageId
        ? `${EMBED_MODAL_PREFIX}:${channelId}:${messageId}`
        : `${EMBED_MODAL_PREFIX}:${channelId}`;

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
        '> 1. Повторная подача заявки отключена.',
        '> 2. Не пишите администрации по статусу заявки до решения.',
        '> 3. Развернутые ответы повышают шанс одобрения.',
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

    const panelPayload = {
        embeds: [buildApplicationPanelEmbed()],
        components: buildApplicationPanelComponents(),
    };

    if (existingPanel) {
        await existingPanel.edit(panelPayload);
        return;
    }

    await panelChannel.send({
        ...panelPayload,
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
        await replyEphemeral(interaction, 'У вас нет прав для создания или редактирования embed.');
        return;
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const messageId = interaction.options.getString('message_id');

    if (!targetChannel || !targetChannel.isTextBased() || !('send' in targetChannel)) {
        await replyEphemeral(interaction, 'Нужен текстовый канал, куда бот сможет отправить embed.');
        return;
    }

    let existingData = {};

    if (messageId) {
        try {
            const message = await targetChannel.messages.fetch(messageId);

            // Защита: бот может редактировать только свои сообщения
            if (message.author.id !== client.user.id) {
                await replyEphemeral(interaction, 'Я могу редактировать только те сообщения, которые отправлял сам.');
                return;
            }

            if (message.embeds.length > 0) {
                existingData = deconstructEmbed(message.embeds[0]);
            } else {
                await replyEphemeral(interaction, 'В этом сообщении нет embed для редактирования.');
                return;
            }
        } catch (error) {
            await replyEphemeral(interaction, 'Не удалось найти сообщение с таким ID в указанном канале.');
            return;
        }
    }

    await interaction.showModal(buildCreateEmbedModal(targetChannel.id, messageId, existingData));
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
        await replyEphemeral(interaction, 'У вас нет прав для работы с embed.');
        return;
    }

    const parts = interaction.customId.split(':');
    const channelId = parts[1];
    const messageId = parts[2]; // Будет undefined, если это создание нового embed

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

    if (!title && !description) {
        await replyEphemeral(interaction, 'Нужно заполнить хотя бы заголовок или описание embed.');
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

    // Если передан ID сообщения, пытаемся его отредактировать
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
        // Иначе создаем новое
        const sentMessage = await targetChannel.send({ embeds: [embed] });
        await interaction.reply({
            content: `Embed отправлен в канал <#${targetChannel.id}>. ID: \`${sentMessage.id}\` (сохрани ID, если захочешь отредактировать его позже)`,
            ephemeral: true,
        });
    }
}

// Новая функция-помощник для "распаковки" старого Embed обратно в текстовые ключи
function deconstructEmbed(embed) {
    if (!embed) return {};

    const appearance = [];
    if (embed.color !== null && embed.color !== undefined) {
        appearance.push(`color=#${embed.color.toString(16).padStart(6, '0')}`);
    }
    if (embed.url) appearance.push(`url=${embed.url}`);
    if (embed.timestamp) appearance.push(`timestamp=yes`);

    const media = [];
    if (embed.image?.url) media.push(`image=${embed.image.url}`);
    if (embed.thumbnail?.url) media.push(`thumbnail=${embed.thumbnail.url}`);

    const meta = [];
    if (embed.author?.name) meta.push(`author=${embed.author.name}`);
    if (embed.author?.iconURL) meta.push(`authorIcon=${embed.author.iconURL}`);
    if (embed.footer?.text) meta.push(`footer=${embed.footer.text}`);
    if (embed.footer?.iconURL) meta.push(`footerIcon=${embed.footer.iconURL}`);

    return {
        title: embed.title || '',
        description: embed.description || '',
        appearance: appearance.join('\n'), // Склеиваем переносом строки для корректного парсинга
        media: media.join('\n'),
        meta: meta.join('\n'),
    };
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
        return true;
    }

    return !['no', 'false', '0', 'off'].includes(value.trim().toLowerCase());
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