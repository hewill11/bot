require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// Команды нового конструктора Components V2 (уже в JSON-формате)
const componentsV2Editor = require('./componentsv2/editor');

const commands = [
    new SlashCommandBuilder()
        .setName('анкета')
        .setDescription('Открыть анкету на Minecraft сервер'),
    new SlashCommandBuilder()
        .setName('заявка')
        .setDescription('Открыть анкету на Minecraft сервер'),
    new SlashCommandBuilder()
        .setName('панельзаявки')
        .setDescription('Отправить готовую панель заявок в канал')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Канал, куда отправить панель заявок')
                .setRequired(false),
        ),
    new SlashCommandBuilder()
        .setName('applicationpanel')
        .setDescription('Send the ready-made application panel')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Channel where the application panel should be sent')
                .setRequired(false),
        ),
    new SlashCommandBuilder()
        .setName('панельсуда')
        .setDescription('Отправить готовую панель суда в канал')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Канал, куда отправить панель суда')
                .setRequired(false),
        ),
    new SlashCommandBuilder()
        .setName('courtpanel')
        .setDescription('Send the ready-made court panel')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Channel where the court panel should be sent')
                .setRequired(false),
        ),
    new SlashCommandBuilder()
        .setName('ивент')
        .setDescription('Создать панель регистрации на ивент')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Канал для отправки панели ивента')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('title')
                .setDescription('Название ивента или заголовок панели')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('description')
                .setDescription('Дополнительное описание ивента')
                .setRequired(false),
        ),
    new SlashCommandBuilder()
        .setName('event')
        .setDescription('Создать панель регистрации на ивент')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Канал для отправки панели ивента')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('title')
                .setDescription('Название ивента или заголовок панели')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('description')
                .setDescription('Дополнительное описание ивента')
                .setRequired(false),
        ),
    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Открыть конструктор embed с автосохранением черновика')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Канал, тред или forum для отправки embed (по умолчанию текущий)')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('message_id')
                .setDescription('ID или ссылка на сообщение бота для редактирования')
                .setRequired(false),
        ),
]
    .map((command) => command.toJSON())
    .concat(componentsV2Editor.commandData); // команды Components V2

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Регистрирую slash-команды...');

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID,
            ),
            { body: commands },
        );

        console.log('Команды зарегистрированы.');
    } catch (error) {
        console.error('Ошибка регистрации команд:', error);
    }
})();
