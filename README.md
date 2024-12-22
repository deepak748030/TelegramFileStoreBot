# Movie Cast Telegram Bot

The Movie Cast Telegram Bot allows users to search and watch movies directly within Telegram. It provides a seamless experience by listing videos, supporting search functionality, and enabling video streaming through the Telegram platform. The bot also supports inline keyboard navigation for browsing movies and interacting with users.

## Features

- **Movie Search**: Search for movies based on keywords.
- **Video Streaming**: Users can watch movies by selecting them from the inline buttons.
- **Pagination**: Navigate through the list of movies with next/previous buttons.
- **MongoDB Integration**: The bot stores video data (caption, size, file ID) in a MongoDB database.
- **Automatic Message Deletion**: Messages are deleted after 2 minutes to keep the chat clean.
- **Video Upload**: Admins can upload videos, which are checked for duplicates before being added to the database.

## Prerequisites

Before running the bot, ensure you have the following tools and accounts:

1. **Node.js** (version 14.x or higher)
2. **MongoDB** account with a URI for connecting to your database
3. **Telegram Bot Token** - Get yours from [@BotFather](https://core.telegram.org/bots#botfather)
4. **npm or yarn** for package management

## Installation

Follow these steps to set up the bot locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/movie-cast-bot.git
   cd movie-cast-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables:
   - Create a `.env` file in the root of the project.
   - Add the following variables:
     ```env
     TELEGRAM_BOT_TOKEN=your-telegram-bot-token
     MONGODB_URI=your-mongodb-connection-uri
     ```

4. Run the bot:
   ```bash
   node index.js
   ```

## Usage

Once the bot is up and running, you can interact with it by sending commands or searching for movies.

### Available Commands

- `/start`: Greets the user and provides a welcome message with a navigation menu.
- `/moviecounts`: Returns the total number of movies in the database.
- **Search for Movies**: Type a movie name to search for matching videos.
- **Inline Buttons**: Navigate through video search results with "Next" and "Previous" buttons.
- **Watch Movies**: Select a movie from the results to watch it.

### Example of Movie Search:

1. Type the movie name you want to search for.
2. The bot will respond with a list of movies matching your search.
3. Use the "Next" or "Previous" buttons to browse through multiple pages of results.
4. Click on a movie to watch it.

### Video Upload:

- Admins (identified by specific usernames) can upload videos to the bot. The bot ensures that no duplicate videos are stored.
- Videos will be stored with a cleaned-up caption and their metadata (file ID, caption, and size).

## Database Schema

The bot stores video information in a MongoDB database with the following schema:

```js
const videoSchema = new mongoose.Schema({
    fileId: { type: String, required: true },
    caption: { type: String, required: true },
    size: { type: Number, required: true }
});
```

## How It Works

1. **Start Command**: When a user starts the bot, they are greeted with a welcome message and given the option to view movies or visit the website.
2. **Search Functionality**: Users can search for movies by name, and the bot will return matching results from the database. The results are displayed with the option to select and watch the video.
3. **Pagination**: The results are displayed in pages, with a maximum of 8 movies per page. Users can navigate through the pages using inline buttons.
4. **Video Upload**: Admins can upload videos to the bot. The bot checks for duplicates and saves the video data to the database.

## Contributing

Contributions are welcome! To contribute to this project, follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature-branch`)
3. Make your changes
4. Commit your changes (`git commit -am 'Add new feature'`)
5. Push to the branch (`git push origin feature-branch`)
6. Create a pull request

## Contact

For any questions, you can reach out to:

- Telegram: [@yourusername](https://t.me/@movie_cast_bot)
- Email: deepakkushwah748930@gmail.com

## Acknowledgements

- [Telegraf](https://github.com/telegraf/telegraf): A modern Telegram Bot API framework for Node.js
- [Mongoose](https://mongoosejs.com/): MongoDB ODM for Node.js

