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
        .setDescription('Создать embed и отправить его в канал')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Канал, куда отправить embed')
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
