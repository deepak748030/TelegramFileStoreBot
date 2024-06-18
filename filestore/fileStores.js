const Video = require("../models/video");

async function fileStoreData(fileId, caption) {
    try {
        // Check if a video with the same file ID or caption already exists
        const existingVideo = await Video.findOne({ $or: [{ fileId }, { caption }] });

        if (existingVideo) {
            console.log("Video with the same file ID or caption already exists. Not saving to MongoDB.");
            return; // Do not save the video if it already exists
        }

        // If no existing video is found, create a new one
        const video = new Video({ fileId, caption });
        await video.save();
        console.log("Video data saved to MongoDB");
    } catch (error) {
        console.error("Error saving video data to MongoDB:", error);
    }
}

module.exports = fileStoreData;