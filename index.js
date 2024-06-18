const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config()

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Function to get the bot's profile photo
async function getBotProfilePhoto() {
    try {
        const botInfo = await bot.telegram.getMe();
        const userId = botInfo.id;

        // Fetch the profile photos from the Telegram API
        const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUserProfilePhotos`, {
            params: { user_id: userId, limit: 1 }
        });

        const photos = response.data.result.photos;
        if (photos.length > 0) {
            return photos[0][0].file_id; // Return the file_id of the first photo
        } else {
            throw new Error('No profile photos found');
        }
    } catch (error) {
        console.error('Error getting bot profile photo:', error);
        throw error;
    }
}

// Telegram bot handlers
bot.start(async (ctx) => {
    try {
        const username = ctx.from.first_name || 'user';
        const botPhotoFileId = await getBotProfilePhoto();
        const message = await ctx.replyWithPhoto(
            botPhotoFileId,
            {
                caption: `HELLO ${username}, I AM A MOVIE BOT ADD ME TO YOUR MOVIE CHAT GROUP`,
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.url('+ Add me to your group +', 'http://t.me/movie_cast_bot?startgroup=true')],
                    [Markup.button.url('JOIN OUR SERIES CHANNEL', 'https://t.me/moviecastseriess')],
                    [Markup.button.url('JOIN OUR BACKUP CHANNEL', 'https://t.me/moviecastback')],
                    [Markup.button.url('JOIN OUR CHAT CHANNEL', 'https://t.me/filmpurchat1')],
                    [Markup.button.url('JOIN OUR MAIN CHANNEL', 'https://t.me/moviecastmovie')],
                ])
            }
        );

        // Schedule the deletion of the message after 2 minutes
        setTimeout(() => {
            ctx.deleteMessage(message.message_id)
                .catch(err => console.error('Error deleting message:', err));
        }, 2 * 60 * 1000); // 2 minutes in milliseconds

    } catch (err) {
        console.error('Error sending start message:', err);
        ctx.reply('Oops! Something went wrong.');
    }
});

// Catch Telegraf errors
bot.catch((err, ctx) => {
    console.error('Telegraf error:', err);
    ctx.reply('Oops! Something went wrong.');
});

// Expose the bot webhook handler through Vercel
const express = require('express');
const app = express();

// Initialize bot webhook
const path = `/api/telegram-bot`;
app.use(express.json());
app.post(path, (req, res) => {
    bot.handleUpdate(req.body, res);
});

// Start the Express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

// Start the bot
bot.launch().then(() => {
    console.log('Bot launched');
}).catch(err => {
    console.error('Failed to launch bot:', err);
});
