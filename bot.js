const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Video } = require('./models/video'); // Assuming you have a Video model
dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB:', err);
    });

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Function to get the bot's profile photo
async function getBotProfilePhoto() {
    try {
        const botInfo = await bot.telegram.getMe();
        const userId = botInfo.id;

        const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUserProfilePhotos`, {
            params: { user_id: userId, limit: 1 }
        });

        const photos = response.data.result.photos;
        if (photos.length > 0) {
            return photos[0][0].file_id;
        } else {
            throw new Error('No profile photos found');
        }
    } catch (error) {
        console.error('Error getting bot profile photo:', error);
        throw error;
    }
}

// Function to convert bytes to MB
const bytesToMB = (bytes) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + ' MB';
};

// Function to generate inline keyboard buttons for a specific page
const generateButtons = (videos, page, totalPages) => {
    const maxButtonsPerPage = 8;
    const startIndex = (page - 1) * maxButtonsPerPage;
    const endIndex = Math.min(startIndex + maxButtonsPerPage, videos.length);

    const buttons = videos.slice(startIndex, endIndex).map(video => {
        const sizeMB = bytesToMB(video.size);
        return [Markup.button.callback(`[${sizeMB}] - ${video.caption}`, `watch_${video._id}`)];
    });

    // Add navigation buttons if necessary
    const navigationButtons = [];
    if (page > 1) {
        navigationButtons.push(Markup.button.callback('Prev', `prev_${page}`));
    }
    if (page < totalPages) {
        navigationButtons.push(Markup.button.callback('Next', `next_${page}`));
    }
    if (navigationButtons.length > 0) {
        buttons.push(navigationButtons);
    }

    return buttons;
};

// Telegram bot handlers
bot.start(async (ctx) => {
    try {
        const username = ctx.from.first_name || 'user';
        const botPhotoFileId = await getBotProfilePhoto();
        const message = await ctx.replyWithPhoto(
            botPhotoFileId,
            {
                caption: `HELLO ${username}, I AM A MOVIE BOT. ADD ME TO YOUR MOVIE CHAT GROUP.`,
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

        setTimeout(() => {
            ctx.deleteMessage(message.message_id)
                .catch(err => console.error('Error deleting message:', err));
        }, 2 * 60 * 1000);

    } catch (err) {
        console.error('Error sending start message:', err);
        ctx.reply('Oops! Something went wrong.');
    }
});

// Handle text messages (movie name search)
bot.on("text", async (ctx) => {
    const movieName = ctx.message.text.trim();

    try {
        if (!movieName) {
            ctx.reply("Please enter a valid movie name.");
            return;
        }

        const regex = new RegExp(movieName, "i");
        const matchingVideos = await Video.find({ caption: regex });

        if (matchingVideos.length === 0) {
            ctx.reply(`No movie found with matching name '${movieName}'.`);
            return;
        }

        const totalPages = Math.ceil(matchingVideos.length / 8);
        let currentPage = 1;
        const buttons = generateButtons(matchingVideos, currentPage, totalPages);

        await ctx.reply(
            `Found ${matchingVideos.length} videos matching '${movieName}'. Select one to watch:`,
            Markup.inlineKeyboard(buttons)
        );

    } catch (error) {
        console.error("Error searching for videos:", error);
        ctx.reply("Failed to search for videos. Please try again later.");
    }
});

// Handle next page action
bot.action(/next_(\d+)/, async (ctx) => {
    const currentPage = parseInt(ctx.match[1]);
    const nextPage = currentPage + 1;

    const movieName = ctx.callbackQuery.message.text.split("'")[1]; // Extract movieName from message text
    const regex = new RegExp(movieName, "i");
    const matchingVideos = await Video.find({ caption: regex });
    const totalPages = Math.ceil(matchingVideos.length / 8);

    if (nextPage <= totalPages) {
        const buttons = generateButtons(matchingVideos, nextPage, totalPages);
        await ctx.editMessageText(
            `Page ${nextPage}/${totalPages}: Found ${matchingVideos.length} videos matching '${movieName}'. Select one to watch:`,
            Markup.inlineKeyboard(buttons)
        );
    }
    await ctx.answerCbQuery();
});

// Handle previous page action
bot.action(/prev_(\d+)/, async (ctx) => {
    const currentPage = parseInt(ctx.match[1]);
    const prevPage = currentPage - 1;

    const movieName = ctx.callbackQuery.message.text.split("'")[1]; // Extract movieName from message text
    const regex = new RegExp(movieName, "i");
    const matchingVideos = await Video.find({ caption: regex });
    const totalPages = Math.ceil(matchingVideos.length / 8);

    if (prevPage > 0) {
        const buttons = generateButtons(matchingVideos, prevPage, totalPages);
        await ctx.editMessageText(
            `Page ${prevPage}/${totalPages}: Found ${matchingVideos.length} videos matching '${movieName}'. Select one to watch:`,
            Markup.inlineKeyboard(buttons)
        );
    }
    await ctx.answerCbQuery();
});

// Handle 'watch' action
bot.action(/watch_(.+)/, async (ctx) => {
    const selectedVideoId = ctx.match[1]; // Extract _id from action
    await ctx.answerCbQuery();

    try {
        // Retrieve the selected video from MongoDB using the Video model
        const selectedVideo = await Video.findById(selectedVideoId);

        if (!selectedVideo) {
            await ctx.reply("Video not found.");
            return;
        }

        let caption = selectedVideo.caption || "";
        const videoFileId = selectedVideo.fileId;

        // Remove usernames and channel URLs except for @moviecastback
        caption = caption.replace(/@[A-Za-z0-9_]+/g, (match) => {
            if (match.toLowerCase() === "@moviecastback") {
                return match; // Keep @moviecastback as is
            } else {
                return ""; // Remove other usernames
            }
        });

        // Append "Jᴏɪɴ ➥「 @moviecastback 」" if no usernames are left in caption
        if (!/@[A-Za-z0-9_]+/g.test(caption)) {
            caption += "\n\nJᴏɪɴ  ➥「 @moviecastback 」";
        }

        try {
            // Attempt to send the video to @movie_cast_bot
            const result = await ctx.telegram.sendVideo("@movie_cast_bot", videoFileId, { caption });

            // Inform the user that the video is sent to @movie_cast_bot
            await ctx.reply("Sent the video to @movie_cast_bot.");
        } catch (error) {
            if (error.code === 400 && error.description.includes('chat not found')) {
                // If @movie_cast_bot chat not found, send the video to the user instead
                await ctx.telegram.sendVideo(ctx.from.id, videoFileId, { caption });

                // Inform the user that the video is sent directly to them
                await ctx.reply("VIDEO UPLOADED HERE @movie_cast_bot");
            } else {
                console.error("Error sending video to @movie_cast_bot:", error);
                ctx.reply("Failed to send the video to @movie_cast_bot. Please try again later.");
            }
        }
    } catch (error) {
        console.error("Error handling 'watch' action:", error);
        ctx.reply("Failed to handle 'watch' action. Please try again later.");
    }
});


// Catch Telegraf errors
bot.catch((err, ctx) => {
    console.error('Telegraf error:', err);
    ctx.reply('Oops! Something went wrong.');
});

module.exports = bot;
