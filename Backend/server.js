require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error(
        "JWT_SECRET is missing in environment variables."
      );
    }

    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing in environment variables."
      );
    }

    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `MNCConnect server running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Server startup failed:",
      error.message
    );

    process.exit(1);
  }
};

startServer();