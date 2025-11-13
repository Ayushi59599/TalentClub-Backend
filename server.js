import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import path from "path";

const app = express();
const PORT = 8000;
const MONGO_URI = "";

app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
app.use("/images", express.static(path.join(__dirname, "images")));

// Connect to MongoDB
let db;
async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  console.log("MongoDB connected successfully");
}

// Lessons collection helper
const lessons = () => db.collection("lessons");

// GET /lessons
app.get("/lessons", async (req, res) => {
  try {
    const allLessons = await lessons().find().toArray();

    const formatted = allLessons.map(l => ({
      _id: l._id.toString(),
      topic: l.topic,
      location: l.location,
      price: l.price,
      spaces: l.spaces ?? 5, // default 5 spaces
      image: l.image ? `http://localhost:${PORT}/images/${l.image}` : undefined
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch lessons" });
  }
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
});
