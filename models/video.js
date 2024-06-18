const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
    fileId: { type: String, required: true },
    caption: { type: String, required: true }
});

const Video = mongoose.model("Video", videoSchema);

module.exports = Video;