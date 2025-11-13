import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";

const app = express();
const PORT = 8000;
const MONGO_URI = "";

app.use(cors());
app.use(express.json());

// Serve static images
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

const lessons = () => db.collection("lessons");
const orders = () => db.collection("orders");

// GET /lessons
app.get("/lessons", async (req, res) => {
  try {
    const allLessons = await lessons().find().toArray();
    const formatted = allLessons.map(l => ({
      _id: l._id.toString(),
      topic: l.topic,
      location: l.location,
      price: l.price,
      spaces: l.spaces ?? 5,
      image: l.image ? `http://localhost:${PORT}/images/${l.image}` : undefined
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch lessons" });
  }
});

// POST /orders
app.post("/orders", async (req, res) => {
  try {
    const order = req.body;
    await orders().insertOne(order);
    res.status(201).json({ message: "Order created successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to create order" });
  }
});

// PUT /lessons/:id
app.put("/lessons/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    await lessons().updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    res.json({ message: "Lesson updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update lesson" });
  }
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
});
