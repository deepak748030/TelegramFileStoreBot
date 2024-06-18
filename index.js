const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bot = require('./bot');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Define routes
app.get('/', (req, res) => {
    res.send('Server started');
});

// Initialize bot webhook
const path = `/api/telegram-bot`;
app.post(path, (req, res) => {
    bot.handleUpdate(req.body, res);
});

// Middleware to handle errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

// Start the bot
bot.launch().then(() => {
    console.log('Bot launched');
}).catch(err => {
    console.error('Failed to launch bot:', err);
});
