const { Telegraf, Markup } = require('telegraf');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Video } = require('./models/video'); // Assuming you have a Video model
dotenv.config();
const { getChatCompletion } = require('./api/api-services')

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

    const message = ctx.update.message;
    const callbackQuery = ctx.update.callback_query;
    const callbackData = message ? message.text : callbackQuery.data;

    if (callbackData.startsWith('/start watch_')) {
        // const chatMember = await ctx.telegram.getChatMember('@filmmelaupdates', ctx.from.id);
        const videoId = callbackData.split('_')[1]; // Extract video ID from the callback data
        try {
            // if (chatMember.status === 'member' || chatMember.status === 'administrator' || chatMember.status === 'creator') {
            if (1 == 1) {
                let video = await Video.findById(videoId);

                if (!video) {
                    const sentMessage = await ctx.reply(`❌ Video with ID '${videoId}' not found.`);
                    deleteMessageAfter(ctx, sentMessage.message_id, 120);
                    return;
                }
                // Add "Join ➥ @filmmelaupdates" to the end of the caption
                const cleanedCaption = video.caption.replace(/\*/g, "") || "NOT AVAILABLE";
                const captionWithLink = `🎥 <b>${cleanedCaption}</b>\n\n⚠️ <b>NOTE:</b> This video will be deleted after 10 minutes.\n\n✨ <i>Join ➥</i> @filmmelaupdates`;


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
                    `🚀 <b>JOIN</b> @filmmelaupdates <b>TO WATCH THIS VIDEO</b> 🎥\n\n📢 <i>Unlock premium movies and exclusive content!</i>`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: '✨JOIN CHANNEL✨',
                                        url: 'https://t.me/filmmelaupdates',
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
            `🎬 <b>Welcome to Film-Mela Bot!</b> 🎥\n\n🌟 <i>Your gateway to amazing movies and entertainment.</i>\n\n👇 Explore now!`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🌐 Updates ', url: 'https://t.me/filmmelaupdates' },
                            { text: '🎞️ View Movies', url: 'https://t.me/filmpuradda' }
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
                            { text: "🌟 Explore Movies 🌟", url: "https://yourwebsite.com/movies" }
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
        const cleanMovieName = movieName.replace(/[^\w\s]/gi, "").replace(/\s\s+/g, " ").trim();
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


bot.on("video", async (ctx) => {
    const { message } = ctx.update;
    console.log(message)
    try {
        if (!allowedUsers.includes(ctx.from.username)) {
            await ctx.reply("❌ You are not authorized to upload videos.");
            return;
        }

        // Extract video details
        const videoFileId = message.video.file_id;
        const videoSize = message.video.file_size;

        // Use caption if available, otherwise fall back to videoFileId
        const captionRaw = message.caption ? message.caption : videoFileId;
        const captionAi = await getChatCompletion(`
        ${captionRaw} 
        
        Create a visually appealing video caption using the following format:
        - Only the movie/series name, no extra words or symbols in this dont use emoji or sticker also.\n
        - ⭐ Rating: Include stars and IMDb rating.
        - 🎭 Genre: Specify the category/genre.
        - 🔢 Size: ${bytesToMB(videoSize)} MB.
        - ⏱️ Duration: Include the duration.
        - 🎬 S0/EP write after this: write episode   and season also if it is series .
        - 🗂️ Quality: Specify the video quality.
        - 🗣️ Language: Mention the language.
        - 📁 Format: Specify the file format. \n
        - 🎬 Plot Summary: Keep it concise.
        
        Use proper spacing, fancy icons, and a clean, visually appealing design. Do not add any extra words or unnecessary details.
        `);

        const caption = captionAi.replace(/\*/g, "");
        console.log(caption);
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

        // Check if there are more videos to process
        const nextVideo = ctx.message.reply_to_message;
        if (nextVideo && nextVideo.video) {
            await bot.handleUpdate({ message: nextVideo });
        }
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
    return next();
});

bot.launch().then(() => {
    console.log('Bot started');
});


// Catch Telegraf errors
bot.catch((err, ctx) => {
    console.error('Telegraf error:', err);
    ctx.reply('Oops! Something went wrong.');
});

module.exports = bot;
