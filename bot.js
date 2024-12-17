const { Telegraf, Markup } = require('telegraf');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Video } = require('./models/video'); // Assuming you have a Video model
const ai = require('unlimited-ai');
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



// Handle /start command with specific video ID
bot.start(async (ctx) => {
    const callbackData = ctx.update.message.text;
    if (callbackData.startsWith('/start watch_')) {
        const videoId = callbackData.split('_')[1]; // Extract video ID from the callback data

        try {
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

bot.command("update", async (ctx) => {
    await ctx.reply("Starting caption update process...");
    await connectToMongoDB();

    const videos = await Video.find();
    const totalVideos = videos.length;

    if (totalVideos === 0) {
        await ctx.reply("No videos found to update.");
        return;
    }

    let updateCount = 0;
    const progressInterval = Math.max(1, Math.floor(totalVideos * 0.0001)); // 0.01% threshold

    // Process videos
    for (const video of videos) {
        const prompt = `
            ${video.caption}

            Create a visually appealing video caption using the following format:
            <b>${video.title}</b>  
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━  
            <b>Language:</b> ${video.language} | <b>Quality:</b> ${video.quality} | <b>Format:</b> ${video.format} | <b>Codec:</b> ${video.codec} | <b>File Type:</b> ${video.fileType}  
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━   
        `;

        const model = 'gpt-4-turbo-2024-04-09';
        const messages = [
            { role: 'system', content: 'You are a movie/series data provider website.' },
            { role: 'user', content: prompt }
        ];

        try {
            await ctx.reply(`Genearting caption Wait`);
            // Generate new caption using AI
            const response = await ai.generate(model, messages);
            const newCaption = response;
            await ctx.reply(newCaption);
            if (newCaption && newCaption.length > 0) {
                await Video.findByIdAndUpdate(video._id, { caption: newCaption }, { new: true });
                updateCount++;

                // Send progress update every 0.01%
                if (updateCount % progressInterval === 0) {
                    await ctx.reply(`Progress: ${((updateCount / totalVideos) * 100).toFixed(2)}% (${updateCount}/${totalVideos} captions updated).`);
                }
            }
        } catch (aiError) {
            console.error(`Error generating caption for video ID ${video._id}:`, aiError);
        }

        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second per video
    }

    await ctx.reply(`Caption update process completed. Total captions updated: ${updateCount} out of ${totalVideos}.`);
});

// /Ai command to generate text based on user input
bot.command("Ai", async (ctx) => {
  const userInput = ctx.message.text.replace("/Ai", "").trim(); // Remove "/Ai" and get user input

  if (!userInput) {
    await ctx.reply("Please provide some text after the command.");
    return;
  }

  await ctx.reply("Generating response... Please wait.");

  const model = "gpt-4-turbo-2024-04-09";
  const messages = [
    { role: "system", content: "You are an AI assistant providing text responses based on user input." },
    { role: "user", content: userInput },
  ];

  try {
    const response = await ai.generate(model, messages);
    const generatedText = response;

    if (!generatedText) {
      await ctx.reply("Sorry, no valid response generated.");
    } else {
      await ctx.reply(`AI Response: \n${generatedText}`);
    }
  } catch (error) {
    console.error("Error generating AI response:", error);
    await ctx.reply("An error occurred while processing your request.");
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
        const matchingVideos = await Video.find({ caption: { $regex: regex } }).sort({ updatedAt: -1 }).exec();

        if (matchingVideos.length === 0) {
            ctx.reply(`No videos found for "${movieName}"`, { reply_to_message_id: ctx.message.message_id });
            return;
        }

        const totalPages = Math.ceil(matchingVideos.length / 8);
        let currentPage = 1;
        let message = await ctx.reply("Here are the results:", {
            reply_markup: {
                inline_keyboard: generateButtons(matchingVideos, currentPage, totalPages)
            }
        });

        // Handle pagination
        bot.action(/prev_(\d+)/, async (ctx) => {
            const page = parseInt(ctx.match[1]);
            if (page > 1) {
                currentPage = page - 1;
                await ctx.editMessageReplyMarkup({
                    inline_keyboard: generateButtons(matchingVideos, currentPage, totalPages)
                });
            }
        });

        bot.action(/next_(\d+)/, async (ctx) => {
            const page = parseInt(ctx.match[1]);
            if (page < totalPages) {
                currentPage = page + 1;
                await ctx.editMessageReplyMarkup({
                    inline_keyboard: generateButtons(matchingVideos, currentPage, totalPages)
                });
            }
        });
    } catch (error) {
        console.error('Error fetching videos:', error);
        ctx.reply("An error occurred. Please try again later.", { reply_to_message_id: ctx.message.message_id });
    }
});


// Catch Telegraf errors
bot.catch((err, ctx) => {
    console.error('Telegraf error:', err);
    ctx.reply('Oops! Something went wrong.');
});

module.exports = bot;
