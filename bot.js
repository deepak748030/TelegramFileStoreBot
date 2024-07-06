const { Telegraf, Markup } = require('telegraf');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Video } = require('./models/video'); // Assuming you have a Video model
dotenv.config();

let dbConnection;

const connectToMongoDB = async () => {
    if (!dbConnection) {
        try {
            dbConnection = await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
            console.log('Connected to MongoDB');
        } catch (err) {
            console.error('Failed to connect to MongoDB:', err);
        }
    }
    return dbConnection;
};

connectToMongoDB(); // Ensure the connection is established when the bot is initialized

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const requiredChannel = '@moviecastback'; // The channel that users must join

// Function to check if a user is a member of the required channel
const isMemberOfChannel = async (userId) => {
    try {
        const chatMember = await bot.telegram.getChatMember(requiredChannel, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
        console.error('Error checking membership status:', error);
        return false;
    }
};

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
// Handle /start command with specific video ID
bot.start(async (ctx) => {
    const callbackData = ctx.update.message.text;
    if (callbackData.startsWith('/start watch_')) {
        const videoId = callbackData.split('_')[2]; // Extract video ID from the callback data

        try {
            const isMember = await isMemberOfChannel(ctx.from.id);
            if (!isMember) {
                await ctx.reply(`Please join ${requiredChannel} to access the video.`);
                return;
            }

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
                reply_markup: Markup.inlineKeyboard([
                    Markup.button.url('Watch Movie', `https://t.me/movie_cast_bot?start=watch_${videoId}`)
                ])
            });

            // Delete the message after 2 minutes
            deleteMessageAfter(ctx, sentMessage.message_id, 120);

        } catch (error) {
            console.error(`Error fetching video with ID '${videoId}':`, error);
            ctx.reply(`Failed to fetch video. Please try again later.`);
        }
    } else {
        await ctx.reply("Welcome to Movie Cast Bot!", {
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.button.url('Go to Website', 'https://yourwebsite.com'),
                    Markup.button.callback('View Movies', 'view_movies')
                ]
            ])
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

        // Remove common terms like "movies" and "webseries" from the search query
        const cleanedMovieName = movieName.replace(/(?:movies?|webseries?)/gi, '').trim();

        // Create a case-insensitive, gap insensitive regex pattern
        const cleanMovieName = cleanedMovieName.replace(/[^\w\s]/gi, '').replace(/\s\s+/g, ' ').trim();
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
        await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons));
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

    if (prevPage >= 1) {
        const buttons = generateButtons(matchingVideos, prevPage, totalPages);
        await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons));
    }
    await ctx.answerCbQuery();
});

bot.launch();
console.log('Bot is running...');
