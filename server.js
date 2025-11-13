// Import dependencies
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";

const app = express();
const PORT = 8000;

const MONGO_URI = "mongodb+srv://ayushi59599:Cloudnine1@cluster0.vxf4zlx.mongodb.net/talentClub?retryWrites=true&w=majority";

// Middleware setup
app.use(cors());            
app.use(express.json());    

// Logger: prints request info (method + URL + time)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} at ${new Date().toISOString()}`);
  next();
});

// Static images 
const __dirname = path.resolve();
app.use("/images", express.static(path.join(__dirname, "images")));

let db; 

// Connect to mongodb
async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  console.log("MongoDB connected successfully");
}
// Collections
const lessons = () => db.collection("lessons");
const orders = () => db.collection("orders");



// LESSON ROUTES


// Get all lessons
app.get("/lessons", async (req, res) => {
  try {
    const allLessons = await lessons().find().toArray();

    const formatted = allLessons.map(l => ({
      _id: l._id.toString(),
      topic: l.topic,
      location: l.location,
      price: l.price,
      spaces: l.spaces ?? 5, // default 5 spaces if undefined
      image: l.image ? `http://localhost:${PORT}/images/${l.image}` : undefined
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch lessons" });
  }
});

// Add a new lesson
app.post("/lessons", async (req, res) => {
  try {
    const { topic, location, price, spaces = 5, image } = req.body;

    // Validate required fields
    if (!topic || !location || price === undefined)
      return res.status(400).json({ message: "Missing required fields" });

    // Insert new lesson into DB
    const result = await lessons().insertOne({ topic, location, price, spaces, image });
    res.json({ message: "Lesson added successfully", id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add lesson" });
  }
});

// Update a lesson by ID
app.put("/lessons/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Save new lesson to MongoDB
    const result = await lessons().updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (!result.modifiedCount)
      return res.status(404).json({ message: "Lesson not found" });

    res.json({ message: "Lesson updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update lesson" });
  }
});



// ORDER ROUTES


// Place a new order
app.post("/orders", async (req, res) => {
  try {
    const { lessons: lessonIds, name, phone } = req.body;

    // Validate order data
    if (!lessonIds?.length)
      return res.status(400).json({ message: "Cart is empty" });
    if (!name || !phone)
      return res.status(400).json({ message: "Name and phone are required" });

    // Fetch all selected lessons
    const lessonDocs = await lessons()
      .find({ _id: { $in: lessonIds.map(id => new ObjectId(id)) } })
      .toArray();

    // Ensure all lesson IDs exist
    if (lessonDocs.length !== lessonIds.length)
      return res.status(400).json({ message: "Some lessons not found" });

    // Check available spaces
    for (const l of lessonDocs) {
      if (l.spaces <= 0)
        return res.status(400).json({ message: `No spaces left for ${l.topic}` });
    }

    // Decrease space count for each booked lesson
    for (const l of lessonDocs) {
      await lessons().updateOne({ _id: l._id }, { $inc: { spaces: -1 } });
    }

    // Create and insert order record in MongoDB
    const order = {
      lessons: lessonDocs.map(l => ({ id: l._id, topic: l.topic })),
      name,
      phone,
      createdAt: new Date()
    };
    const result = await orders().insertOne(order);
    res.json({
      message: "Order placed successfully",
      orderId: result.insertedId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to place order" });
  }
});



// SEARCH ROUTE

// Search lessons by topic or location
app.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]); // Return empty if no search term

    const regex = new RegExp(q, "i"); // Case-insensitive regex
    const results = await lessons()
      .find({ $or: [{ topic: regex }, { location: regex }] })
      .toArray();

    res.json(results.map(l => ({ ...l, _id: l._id.toString() })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Search failed" });
  }
});

// Start server after DB connection
connectDB().then(() =>
  app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`)
  )
);
