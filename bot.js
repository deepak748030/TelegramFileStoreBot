const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Video } = require('./models/video'); // Assuming you have a Video model
dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
});

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

// Handle incoming videos
bot.on('video', async (ctx) => {
    try {
        const video = ctx.message.video;
        const caption = ctx.message.caption ? ctx.message.caption.replace(/@\S+/g, '').replace(/http\S+/g, '') : '';

        // Check if video already exists in MongoDB
        const existingVideo = await Video.findOne({
            $or: [
                { videoId: new RegExp(video.file_id, 'i') },
                {
                    $and: [
                        { caption: new RegExp(caption, 'i') },
                        { size: video.file_size }
                    ]
                }
            ]
        });

        if (existingVideo) {
            await ctx.reply('This video already exists in the database.');
            return;
        }

        // Save video details to MongoDB
        const newVideo = new Video({
            videoId: video.file_id,
            caption: caption,
            size: video.file_size
        });
        await newVideo.save();

        await ctx.reply(
            'Video received!',
            Markup.inlineKeyboard([
                [Markup.button.url(caption, `https://telegram.me/movie_cast_bot?start=files_${video.file_id}`)],
            ])
        );
    } catch (err) {
        console.error('Error processing video:', err);
        ctx.reply('Failed to process video.');
    }
});

// Catch Telegraf errors
bot.catch((err, ctx) => {
    console.error('Telegraf error:', err);
    ctx.reply('Oops! Something went wrong.');
});

module.exports = bot;
