// config/db.js
const mongoose = require("mongoose");

// Only the host is ever logged. The full URI contains the DB password, so it must NEVER be printed.
const hostOf = (uri = "") => {
  try {
    return new URL(uri).hostname;
  } catch {
    return "(could not read host from MONGO_URI)";
  }
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not set. Add it in .env (local) or Render > Environment (live).");
  }

  console.log(`Connecting to MongoDB host: ${hostOf(uri)}`);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // fail in 10s instead of hanging
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    let hint = "";

    if (/querySrv|ENOTFOUND/i.test(error.message)) {
      hint =
        " -> The cluster address in MONGO_URI does not exist. Copy a fresh string from " +
        "Atlas > Connect > Drivers and update MONGO_URI.";
    } else if (/authentication failed|bad auth/i.test(error.message)) {
      hint = " -> Wrong database username or password in MONGO_URI.";
    } else if (/timed out|ReplicaSetNoPrimary|Server selection/i.test(error.message)) {
      hint = " -> Atlas is blocking this server. Atlas > Network Access > add 0.0.0.0/0.";
    }

    // error.message never contains the password; the URI itself is not printed
    throw new Error(`MongoDB connection failed: ${error.message}${hint}`);
  }
};

module.exports = connectDB;