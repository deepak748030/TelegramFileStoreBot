const { Telegraf, Markup } = require('telegraf');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Video } = require('./models/video'); // Assuming you have a Video model
dotenv.config();

let dbConnection;

const connectToMongoDB = async () => {
    if (!dbConnection) {
        try {
            dbConnection = await mongoose.connect(process.env.MONGODB_URI);
            console.log('Connected to MongoDB');
        } catch (err) {
            console.error('Failed to connect to MongoDB:', err);
        }
    }
    return dbConnection;
};

connectToMongoDB(); // Ensure the connection is established when the bot is initialized

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);


// Function to convert bytes to MB
const bytesToMB = (bytes) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + ' MB';
};

// Function to truncate text to a specified length
const truncateText = (text, maxLength) => {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
};

// Function to generate inline keyboard buttons for a specific page
const generateButtons = (videos, page, totalPages) => {
    const maxButtonsPerPage = 8;
    const startIndex = (page - 1) * maxButtonsPerPage;
    const endIndex = Math.min(startIndex + maxButtonsPerPage, videos.length);

    const buttons = videos.slice(startIndex, endIndex).map(video => {
        const sizeMB = bytesToMB(video.size);
        const truncatedCaption = truncateText(video.caption, 30); // Truncate the caption to 30 characters
        const videoLink = `https://t.me/movie_cast_bot?start=watch_${video._id}`;
        return [Markup.button.url(`${sizeMB != 'NaN MB' ? `[${sizeMB}]` : ''} ${truncatedCaption}`, videoLink)];
    });

    // Add navigation buttons if necessary
    const navigationButtons = [];
    if (page > 1) {
        navigationButtons.push(Markup.button.callback('Prev 🢢', `prev_${page}`));
    }
    if (page < totalPages) {
        navigationButtons.push(Markup.button.callback('Next 🢣', `next_${page}`));
    }
    if (navigationButtons.length > 0) {
        buttons.push(navigationButtons);
    }

    return buttons;
};

// Function to delete messages after a specified time
const deleteMessageAfter = (ctx, messageId, seconds) => {
    setTimeout(async () => {
        try {
            if (ctx.message && ctx.message.chat) {
                await ctx.telegram.deleteMessage(ctx.message.chat.id, messageId);
            } else {
                console.warn('Message or chat is undefined. Cannot delete message.');
            }
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    }, seconds * 1000); // Convert seconds to milliseconds
};

// Import axios or node-fetch to make HTTP requests if needed
const axios = require('axios');

// Handle /start command with specific video ID
bot.start(async (ctx) => {
    const callbackData = ctx.update.message.text;
    const userId = ctx.from.id; // Get user ID
    const channelUsername = '@moviecastback'; // The channel they need to join

    if (callbackData.startsWith('/start watch_')) {
        const videoId = callbackData.split('_')[1]; // Extract video ID from the callback data

        try {
            // Check if the user is a member of the channel
            const memberStatus = await bot.telegram.getChatMember(channelUsername, userId);

            // If user is not in the channel, prompt them to join
            if (memberStatus.status === 'left' || memberStatus.status === 'kicked') {
                await ctx.reply('You need to join our channel to access this video. Please join and try again.', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Join MovieCastBack Channel', url: 'https://t.me/moviecastback' }]
                        ]
                    }
                });
                return;
            }

            // If the user is already in the channel, proceed with sending the video
            const video = await Video.findById(videoId);
            if (!video) {
                ctx.reply(`Video with ID '${videoId}' not found.`);
                return;
            }

            // Add "Join ➥ @moviecastback" to the end of the caption
            const captionWithLink = `${video.caption}\n\nJoin ➥ @moviecastback`;

            // Send the video file to the user
            const sentMessage = await ctx.replyWithVideo(video.fileId, {
                caption: captionWithLink,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Watch Movie', url: `https://t.me/movie_cast_bot?start=watch_${videoId}` }
                        ]
                    ]
                }
            });

            // Delete the message after 2 minutes
            deleteMessageAfter(ctx, sentMessage.message_id, 120);

        } catch (error) {
            console.error(`Error fetching video with ID '${videoId}':`, error);
            ctx.reply(`Failed to fetch video. Please try again later.`);
        }
    } else {
        await ctx.reply("Welcome to Movie Cast Bot!", {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Go to Website', url: 'https://yourwebsite.com' },
                        { text: 'View Movies', callback_data: 'view_movies' }
                    ]
                ]
            }
        });

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, ctx.message.message_id, 120);
    }
});



// Telegram bot handlers
bot.command("moviecounts", async (ctx) => {
    try {
        const count = await Video.countDocuments();
        const sentMessage = await ctx.reply(`Total movies in the database: ${count}`);

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);

    } catch (error) {
        console.error("Error fetching movie count:", error);
        const sentMessage = await ctx.reply("Failed to fetch movie count. Please try again later.");

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);
    }
});


// Telegram bot handlers
bot.command("moviecounts", async (ctx) => {
    try {
        const count = await Video.countDocuments();
        const sentMessage = await ctx.reply(`Total movies in the database: ${count}`);

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);

    } catch (error) {
        console.error("Error fetching movie count:", error);
        const sentMessage = await ctx.reply("Failed to fetch movie count. Please try again later.");

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);
    }
});

bot.on("text", async (ctx) => {
    const movieName = ctx.message.text.trim();
    const username = ctx.from.first_name || ctx.from.username || 'user';

    try {
        if (!movieName) {
            ctx.reply("Please enter a valid movie name.", { reply_to_message_id: ctx.message.message_id });
            return;
        }

        // Create a case-insensitive, gap insensitive regex pattern
        const cleanMovieName = movieName.replace(/[^\w\s]/gi, '').replace(/\s\s+/g, ' ').trim();
        const searchPattern = cleanMovieName.split(/\s+/).map(word => `(?=.*${word})`).join('');
        const regex = new RegExp(`${searchPattern}`, 'i');

        // Find matching videos with case-insensitive regex
        const matchingVideos = await Video.find({ caption: { $regex: regex } }).sort({ caption: -1 });

        if (matchingVideos.length === 0) {
            return;
        }

        const totalPages = Math.ceil(matchingVideos.length / 8);
        let currentPage = 1;
        const buttons = generateButtons(matchingVideos, currentPage, totalPages);

        const sentMessage = await ctx.reply(
            `@${username}, found 📖${matchingVideos.length}📖 videos matching '${movieName}'. Select one to watch:`,
            {
                reply_to_message_id: ctx.message.message_id,
                ...Markup.inlineKeyboard(buttons)
            }
        );

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);

    } catch (error) {
        console.error("Error searching for videos:", error);
        const sentMessage = await ctx.reply("Failed to search for videos. Please try again later.", { reply_to_message_id: ctx.message.message_id });

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);
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
        const sentMessage = await ctx.editMessageText(
            `Page ${nextPage}/${totalPages}: Found ${matchingVideos.length} videos matching '${movieName}'. Select one to watch:`,
            Markup.inlineKeyboard(buttons)
        );

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);
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
        const sentMessage = await ctx.editMessageText(
            `Page ${prevPage}/${totalPages}: Found ${matchingVideos.length} videos matching '${movieName}'. Select one to watch:`,
            Markup.inlineKeyboard(buttons)
        );

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);
    }
    await ctx.answerCbQuery();
});

// Function to store video data in MongoDB
const storeVideoData = async (fileId, caption, size) => {
    const video = new Video({
        fileId: fileId,
        caption: caption,
        size: size
    });
    await video.save();
};

// Function to clean the caption by removing unwanted elements
const cleanCaption = (caption) => {
    // Remove links, special characters, stickers, emojis, extra spaces, and mentions except "@moviecastback"
    return caption
        .replace(/(?:https?|ftp):\/\/[\n\S]+/g, "") // Remove URLs
        .replace(/[^\w\s@.]/g, "") // Remove special characters except "@" and "."
        .replace(/\./g, " ") // Replace dots with a single space
        .replace(/\s\s+/g, " ") // Replace multiple spaces with a single space
        .replace(/@[A-Za-z0-9_]+/g, "@moviecastback") // Replace all mentions with "@moviecastback"
        .trim();
};

bot.on("video", async (ctx) => {
    const { message } = ctx.update;

    try {
        if (message.caption) {
            let caption = cleanCaption(message.caption);

            const videoFileId = message.video.file_id;
            const videoSize = message.video.file_size;

            // Check if the video already exists based on fileId, caption, and fileSize
            const existingVideo = await Video.findOne({
                caption: caption,
                size: videoSize
            });

            if (existingVideo) {
                if (ctx.from.username === 'knox7489' || ctx.from.username === 'deepak74893') {
                    throw new Error("Video already exists in the database.");
                }
            }

            // Store video data in MongoDB
            await storeVideoData(videoFileId, caption, videoSize);


            if (ctx.from.username === 'knox7489' || ctx.from.username === 'deepak74893') {
                await ctx.reply("Video uploaded successfully.");
            }

            console.log(`Video uploaded`);

            // Delete the message after 2 minutes
            deleteMessageAfter(ctx, message.message_id, 120);
        }

    } catch (error) {
        console.error("Error forwarding video with modified caption:", error);
        ctx.reply(`Failed to upload video: ${error.message}`);
    }
});




// Catch Telegraf errors
bot.catch((err, ctx) => {
    console.error('Telegraf error:', err);
    ctx.reply('Oops! Something went wrong.');
});

module.exports = bot;
