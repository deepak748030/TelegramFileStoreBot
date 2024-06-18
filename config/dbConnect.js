const mongoose = require("mongoose");

const dbConn = async () => {
    try {
        await mongoose.connect('mongodb+srv://deepakkushwah748930:Ironman900@cluster0.wecxdql.mongodb.net/');
        console.log("Connected to DB");
    } catch (error) {
        console.error("Error connecting to DB:", error);
    }
};

module.exports = dbConn;