import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();
const PORT = 8000;
const MONGO_URI = "";

app.use(cors());
app.use(express.json());

// CONNECT TO MONGODB
let db;
async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  console.log("MongoDB connected successfully");
}

// Shortcut for lessons collection
const lessons = () => db.collection("lessons");

// Basic GET /lessons route
app.get("/lessons", async (req, res) => {
  try {
    const allLessons = await lessons().find().toArray();
    res.json(allLessons);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch lessons" });
  }
});

// Testing 
app.get("/test", (req, res) => {
  res.send("Hello World");
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
});
