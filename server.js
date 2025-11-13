import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";

const app = express();
const PORT = 8000;

const MONGO_URI = "mongodb+srv://ayushi59599:Cloudnine1@cluster0.vxf4zlx.mongodb.net/talentClub?retryWrites=true&w=majority";

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} at ${new Date().toISOString()}`);
  next();
});

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

// POST /lessons
app.post("/lessons", async (req, res) => {
  try {
    const { topic, location, price, spaces = 5, image } = req.body;
    if (!topic || !location || price === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const result = await lessons().insertOne({ topic, location, price, spaces, image });
    res.json({ message: "Lesson added successfully", id: result.insertedId });
  } catch (err) {
    res.status(500).json({ message: "Failed to add lesson" });
  }
});

// PUT /lessons/:id
app.put("/lessons/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const result = await lessons().updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );
    if (!result.modifiedCount) return res.status(404).json({ message: "Lesson not found" });
    res.json({ message: "Lesson updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update lesson" });
  }
});

// POST /orders
app.post("/orders", async (req, res) => {
  try {
    const { lessons: lessonIds, name, phone } = req.body;

    // Validate order input
    if (!lessonIds?.length) return res.status(400).json({ message: "Cart is empty" });
    if (!name || !phone) return res.status(400).json({ message: "Name and phone are required" });

    // Fetch lessons from DB
    const lessonDocs = await lessons()
      .find({ _id: { $in: lessonIds.map(id => new ObjectId(id)) } })
      .toArray();

    if (lessonDocs.length !== lessonIds.length)
      return res.status(400).json({ message: "Some lessons not found" });

    // Check available spaces
    for (const l of lessonDocs) {
      if (l.spaces <= 0) return res.status(400).json({ message: `No spaces left for ${l.topic}` });
    }

    // Decrease spaces for booked lessons
    for (const l of lessonDocs) {
      await lessons().updateOne({ _id: l._id }, { $inc: { spaces: -1 } });
    }

    // Create order document
    const order = {
      lessons: lessonDocs.map(l => ({ id: l._id, topic: l.topic })),
      name,
      phone,
      createdAt: new Date()
    };

    const result = await orders().insertOne(order);
    res.status(201).json({ message: "Order placed successfully", orderId: result.insertedId });
  } catch (err) {
    res.status(500).json({ message: "Failed to place order" });
  }
});

// GET /search
app.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const regex = new RegExp(q, "i");
    const results = await lessons()
      .find({ $or: [{ topic: regex }, { location: regex }] })
      .toArray();

    res.json(results.map(l => ({ ...l, _id: l._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: "Search failed" });
  }
});

connectDB().then(() =>
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))
);
