import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn("MONGODB_URI is not set. Skipping database connection.");
    return;
  }

  try {
    let connection = await mongoose.connect(uri);
    if(connection){
      console.log("MongoDB connected", connection.connection.host);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("MongoDB connection error:", message);
    process.exit(1);
  }
};

export default connectDB;
