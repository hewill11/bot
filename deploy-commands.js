require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('анкета')
        .setDescription('Открыть анкету на Minecraft сервер'),
    new SlashCommandBuilder()
        .setName('заявка')
        .setDescription('Открыть анкету на Minecraft сервер'),
    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Открыть конструктор embed с автосохранением черновика')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Канал для отправки embed (по умолчанию текущий)')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('message_id')
                .setDescription('ID или ссылка на сообщение бота для редактирования')
                .setRequired(false),
        ),
].map((command) => command.toJSON());

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
