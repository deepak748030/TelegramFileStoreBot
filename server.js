const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bot = require('./bot/bot'); // Adjust the path if necessary

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Define routes
app.get('/api', (req, res) => {
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

// Ensure MongoDB connection is established once
let dbConnection;

//update

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

app.listen(PORT, async () => {
    await connectToMongoDB();
    console.log(`Server started on port ${PORT}`);
});

module.exports = app;
