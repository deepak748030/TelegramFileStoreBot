const { Telegraf, Markup } = require('telegraf');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const NodeCache = require('node-cache');
const { Video } = require('./models/video'); // Assuming you have a Video model
dotenv.config();

const cache = new NodeCache(); // Cache TTL set to 10 minutes
const userCache = new NodeCache({ stdTTL: 86400 });

//admins
const allowedUsers = ["knox7489", "vixcasm", "Knoxbros"];
// hello
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
        const videoLink = `https://t.me/${process.env.BOT_USERNAME}?start=watch_${video._id}`;

        return [
            Markup.button.url(`🎬 ${truncatedCaption} ${sizeMB != 'NaN MB' ? `📦 [${sizeMB}]` : ''}`, videoLink)
        ];
    });

    // Add navigation buttons with emojis for "Prev" and "Next"
    const navigationButtons = [];
    if (page > 1) {
        navigationButtons.push(Markup.button.callback('⬅️ Prev', `prev_${page}`)); // Use left arrow for "Prev"
    }
    if (page < totalPages) {
        navigationButtons.push(Markup.button.callback('Next ➡️', `next_${page}`)); // Use right arrow for "Next"
    }

    if (navigationButtons.length > 0) {
        buttons.push(navigationButtons);
    }

    return buttons;
};
// retry 
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

    const userId = ctx.from.id;
    const username = ctx.from.username || "NoUsername";
    const name = ctx.from.first_name || ctx.from.last_name || "Anonymous";

    userCache.set(userId, { username, name });

    const message = ctx.update.message;
    const callbackQuery = ctx.update.callback_query;
    const callbackData = message ? message.text : callbackQuery.data;

    if (callbackData.startsWith('/start watch_')) {
        const chatMember = await ctx.telegram.getChatMember('@moviecast', ctx.from.id);
        const videoId = callbackData.split('_')[1]; // Extract video ID from the callback data
        try {
            if (chatMember.status === 'member' || chatMember.status === 'administrator' || chatMember.status === 'creator') {

                const cachedVideo = cache.get(videoId);
                let video;
                if (cachedVideo) {
                    video = cachedVideo;
                } else {
                    video = await Video.findById(videoId);
                    if (video) {
                        cache.set(videoId, video);
                    }
                }

                if (!video) {
                    const sentMessage = await ctx.reply(`❌ Video with ID '${videoId}' not found.`);
                    deleteMessageAfter(ctx, sentMessage.message_id, 120);
                    return;
                }

                // Add "Join ➥ @moviecast" to the end of the caption
                const captionWithLink = `🎥 <b>${video.title || "NOT AVAILABLE"}    📦 <b>SIZE:</b> ${bytesToMB(video.size)} </b>\n\n⚠️ <b>NOTE:</b> This video will be deleted after 10 minutes.\n\n✨ <i>Join ➥</i> @moviecast`;
                // Send the video file to the user
                const sentMessage = await ctx.replyWithVideo(video.fileId, {
                    caption: `${captionWithLink}`,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '▶️ Watch Movie', url: `https://t.me/filmpuradda` }
                            ]
                        ]
                    },
                    disable_notification: true,
                    protect_content: true
                });

                // Delete the message after 2 minutes
                deleteMessageAfter(ctx, sentMessage.message_id, 1000);
            } else {
                const sentMessage = await ctx.reply(
                    `🚀 <b>JOIN</b> @moviecast <b>TO WATCH THIS VIDEO</b> 🎥\n\n📢 <i>Unlock premium movies and exclusive content!</i>`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: '✨JOIN CHANNEL✨',
                                        url: 'https://t.me/moviecastmovie',
                                    },
                                    // Retry button with directional and play emojis
                                    {
                                        text: '🔄Retry',
                                        url: `https://t.me/${process.env.BOT_USERNAME}?start=watch_${videoId}`,
                                    },
                                ]
                            ]
                        }
                    }
                );
                deleteMessageAfter(ctx, sentMessage.message_id, 120);
            }
        } catch (error) {
            console.error(`Error fetching video with ID '${videoId}':`, error);
            const sentMessage = await ctx.reply(`⚠️ Failed to fetch video. Please try again later.`);
            deleteMessageAfter(ctx, sentMessage.message_id, 120);
        }
    } else {
        const sentMessage = await ctx.reply(
            `🎬 <b>Welcome to Movie-Cast Bot!</b> 🎥\n\n🌟 <i>Your gateway to amazing movies and entertainment.</i>\n\n👇 Explore now!`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🌐 Updates ', url: 'https://t.me/moviecastback' },
                            { text: '🎞️ View Movies', url: 'https://t.me/moviecastmovie' }
                        ]
                    ]
                }
            }
        );

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, message ? message.message_id : callbackQuery.message.message_id, 120);
    }
});


bot.command("allusers", (ctx) => {

    if (!allowedUsers.includes(ctx.from.username)) {
        ctx.reply("❌ You are not an admin, so you don't have permission to access this.");
        return;
    }

    const allUsers = userCache.keys().map((key) => {
        const user = userCache.get(key);
        return { id: key, name: user.name, username: user.username };
    });

    if (allUsers.length === 0) {
        // Reply with a simple message and emoji
        ctx.reply("🚫 No active users found in the last 24 hours.");
    } else {
        const totalUsers = allUsers.length;
        const userTable = allUsers
            .map((user, index) => {
                return `#️⃣ <b>${index + 1}</b>\n👤 <b>Name:</b> ${user.name}\n💻 <b>Username:</b> @${user.username}\n🆔 <b>User ID:</b> ${user.id}\n`;
            })
            .join("\n──────────\n");

        // Reply with the user list and total count
        ctx.reply(
            `🎉 <b>Total Active Users in the Last 24 Hours:</b> <b>${totalUsers}</b> 🟢\n\n` +
            `📝 <b>User List:</b>\n${userTable}`,
            { parse_mode: "HTML" }
        );
    }
});





// Telegram bot handlers
bot.command("moviecounts", async (ctx) => {
    try {
        const count = await Video.countDocuments();

        // Fancy response message
        const sentMessage = await ctx.reply(
            `🎥 <b>Total Movies in Our Collection</b> 🎬\n\n` +
            `📁 <i>Movies Count:</i> <b>${count}</b>\n\n` +
            `✨ <i>Discover amazing films and enjoy unlimited entertainment!</i>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🌟 Explore Movies 🌟", url: "https://t.me/moviecastmovie" }
                        ]
                    ]
                }
            }
        );

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);

    } catch (error) {
        console.error("Error fetching movie count:", error);

        // Error response message
        const sentMessage = await ctx.reply(
            `⚠️ <b>Oops!</b> Something went wrong. 😟\n\n` +
            `❌ <i>We couldn’t fetch the movie count. Please try again later.</i>`,
            {
                parse_mode: "HTML",
            }
        );

        // Delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);
    }
});

bot.on("text", async (ctx) => {
    const movieName = ctx.message.text.trim();
    const username = ctx.from.first_name || ctx.from.username || "user";

    try {
        if (!movieName) {
            await ctx.reply(
                "❌ <b>Please enter a valid movie name!</b>\n" +
                "💡 *Hint*: Type the name of the movie you want to search for.",
                { parse_mode: "HTML", reply_to_message_id: ctx.message.message_id }
            );
            return;
        }

        // Clean and prepare movie name for regex search
        const cleanMovieName = movieName.replace(/[^\w\s]/gi, "").replace(/\s\s+/g, " ").replace(/\*/g, "").trim();
        const searchPattern = cleanMovieName.split(/\s+/).map(word => `(?=.*${word})`).join("");
        const regex = new RegExp(`${searchPattern}`, "i");

        // Find matching videos with regex
        const matchingVideos = await Video.find({ caption: { $regex: regex } }).sort({ caption: -1 });

        if (matchingVideos.length === 0) {
            await ctx.reply(
                `❌ <b>Sorry, ${username}!</b>\n` +
                `🎥 No videos found matching your search for "<i>${movieName}</i>".`,
                { parse_mode: "HTML", reply_to_message_id: ctx.message.message_id }
            );
            return;
        }

        const totalPages = Math.ceil(matchingVideos.length / 8);
        let currentPage = 1;
        const buttons = generateButtons(matchingVideos, currentPage, totalPages);

        const sentMessage = await ctx.reply(
            `🎬 <b>Hello, ${username}!</b>\n` +
            `🔍 I found <b>${matchingVideos.length}</b> videos matching your search for "<i>${movieName}</i>".\n\n` +
            `📖 <b>Choose a video to watch:</b>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: ctx.message.message_id,
                reply_markup: { inline_keyboard: buttons },
            }
        );

        // Automatically delete the message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);

    } catch (error) {
        console.error("Error searching for videos:", error);
        const sentMessage = await ctx.reply(
            "⚠️ <b>Oops! Something went wrong.</b>\n" +
            "❌ Failed to search for videos. Please try again later.",
            { parse_mode: "HTML", reply_to_message_id: ctx.message.message_id }
        );

        // Automatically delete the error message after 2 minutes
        deleteMessageAfter(ctx, sentMessage.message_id, 120);
    }
});

// Handle next page action
bot.action(/next_(\d+)/, async (ctx) => {
    const currentPage = parseInt(ctx.match[1]);
    const nextPage = currentPage + 1;

    const movieName = ctx.callbackQuery.message.text.split("'")[1]; // Extract movieName from message text
    const regex = new RegExp(movieName, "i");

    // Check cache first
    const cacheKey = `videos_${movieName}`;
    let matchingVideos = cache.get(cacheKey);

    if (!matchingVideos) {
        matchingVideos = await Video.find({ caption: regex });
        cache.set(cacheKey, matchingVideos);
    }

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

    // Check cache first
    const cacheKey = `videos_${movieName}`;
    let matchingVideos = cache.get(cacheKey);

    if (!matchingVideos) {
        matchingVideos = await Video.find({ caption: regex });
        cache.set(cacheKey, matchingVideos);
    }

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

// Function to store video data in MongoDB
const storeVideoData = async (fileId, caption, size) => {
    const video = new Video({
        fileId: fileId,
        caption: caption,
        size: size
    });
    await video.save();
    return video;
};

// Function to clean the caption by removing unwanted elements
const cleanCaption = (caption) => {
    // Remove links, special characters, stickers, emojis, extra spaces, and mentions except "@moviecast"
    return caption
        .replace(/(?:https?|ftp):\/\/[\n\S]+/g, "") // Remove URLs
        .replace(/[^\w\s@.]/g, "") // Remove special characters except "@" and "."
        .replace(/\./g, " ") // Replace dots with a single space
        .replace(/\s\s+/g, " ") // Replace multiple spaces with a single space
        .replace(/@[A-Za-z0-9_]+/g, "@moviecast") // Replace all mentions with "@moviecast"
        .trim();
};

bot.on("video", async (ctx) => {
    const { message } = ctx.update;

    try {

        if (!allowedUsers.includes(ctx.from.username)) {
            await ctx.reply("❌ You are not authorized to upload videos.");
            return;
        }

        // Extract video details
        const videoFileId = message.video.file_id;
        const videoSize = message.video.file_size;

        // Use caption if available, otherwise fall back to videoFileId
        const caption = message.caption ? cleanCaption(message.caption) : videoFileId;

        // Check if the video already exists in the database
        const existingVideo = await Video.findOne({
            caption: caption,
            size: videoSize,
        });

        if (existingVideo) {
            throw new Error("This video already exists in the database.");
        }

        // Store video data in MongoDB
        const videos = await storeVideoData(videoFileId, caption, videoSize);

        // Send success message for admin users
        await ctx.reply("🎉 Video uploaded successfully.");

        // Generate and share the video link
        const videoLink = `https://t.me/${process.env.BOT_USERNAME}?start=watch_${videos._id}`;
        await ctx.reply(
            `🎥 <b>Video Uploaded Successfully</b> ✅\n\n` +
            `🔗 <b>Watch it here:</b> <a href="${videoLink}">${videoLink}</a>`,
            { parse_mode: "HTML" }
        );

        // Auto-delete the message after 2 minutes
        deleteMessageAfter(ctx, message.message_id, 120);
    } catch (error) {
        console.error("Error uploading video:", error);

        // Handle errors gracefully with a user-friendly message
        await ctx.reply(
            `⚠️ <b>Failed to Upload Video</b> ❌\n\n` +
            `Reason: ${error.message}`,
            { parse_mode: "HTML" }
        );
    }
});

// Middleware to reset TTL on any interaction
bot.use((ctx, next) => {
    const userId = ctx.from.id;
    console.log('run');
    // If user exists in cache, reset TTL
    if (userCache.has(userId)) {
        userCache.ttl(userId, 86400); // Reset TTL to 24 hours
    } else {
        // Add user to cache if not already stored
        const username = ctx.from.username || "NoUsername";
        const name = ctx.from.first_name || ctx.from.last_name || "Anonymous";
        userCache.set(userId, { username, name });
    }

    return next();
});

// bot.launch().then(() => {
//     console.log('Bot started');
// });


// Catch Telegraf errors
bot.catch((err, ctx) => {
    console.error('Telegraf error:', err);
    ctx.reply('Oops! Something went wrong.');
});

module.exports = bot;