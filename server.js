// --- Import dependencies ---
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import dotenv from "dotenv"

// --- Setup ---
const app = express();
const PORT = 8000;

// [Requirement: MongoDB Connection]
dotenv.config(); 
const MONGO_URI = process.env.MONGO_URI;

// --- Middleware ---
// Enables the frontend to talk to this backend 
app.use(cors());
app.use(express.json());

// [Requirement: Logger Middleware] 
app.use((req, res, next) => {
  console.log(`[LOG] ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// --- Static images ---
const __dirname = path.resolve();
// [Requirement: Static File Server] 
// Serves image files from the "images" folder to the frontend
app.use("/images", express.static(path.join(__dirname, "images")));

// Middleware to catch missing images if static file isn't found
app.use("/images", (req, res, next) => {
  res.status(404).json({ message: "Image not found" });
});

// --- Connect to MongoDB ---
let db;
async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
}

// Collections shortcut
const Lessons = () => db.collection("lessons");
const Orders = () => db.collection("orders");

// ----------------------------
//        LESSON ROUTES
// ----------------------------

// [Requirement: GET Route] Fetch all lessons
app.get("/lessons", async (req, res) => {
  try {
    const lessonsList = await Lessons().find().toArray();
    res.json(
      lessonsList.map(l => ({
        ...l,
        _id: l._id.toString(),
        spaces: l.spaces ?? 5,
        image: l.image ? `https://talentclub-backend.onrender.com/images/${l.image}` : null
      }))
    );
  } catch (err) {
    res.status(500).json({ message: "Error fetching lessons" });
  }
});

// Add a lesson 
app.post("/lessons", async (req, res) => {
  const { topic, location, price, spaces = 5, image } = req.body;
  if (!topic || !location || price == null)
    return res.status(400).json({ message: "Missing fields" });

  const result = await Lessons().insertOne({ topic, location, price, spaces, image });
  res.json({ message: "Lesson added", id: result.insertedId });
});

// [Requirement: PUT Route] Update lesson spaces
app.put("/lessons/:id", async (req, res) => {
  try {
    // Updates specific fields (like spaces) for the lesson ID provided
    const result = await Lessons().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );

    if (!result.modifiedCount)
      return res.status(404).json({ message: "Lesson not found or no change" });

    res.json({ message: "Lesson updated" });
  } catch (err) {
    res.status(500).json({ message: "Error updating lesson" });
  }
});


// ----------------------------
//        ORDER ROUTES
// ----------------------------

// [Requirement: POST Route] 
app.post("/orders", async (req, res) => {
  const { lessons, name, phone, password } = req.body;

  // Basic check to make sure we have data
  if (!lessons || !name || !phone || !password) {
    return res.status(400).json({ message: "All fields (name, phone, password) are required." });
  }

  try {
    //Check if the Phone Number exists
    const user = await Orders().findOne({ phone });

    // Create the order object to save
    const newOrder = {
      lessons: lessons, 
      createdAt: new Date()
    };

    if (user) {
      // ACCOUNT EXISTS (Phone Match)
      // We must check if the Name and Password match the existing account.
      
      const dbName = user.name.toLowerCase();
      const inputName = name.toLowerCase();
      
      const isNameWrong = dbName !== inputName;
      const isPasswordWrong = user.password !== password;

      // ERROR MESSAGES:
      if (isNameWrong && isPasswordWrong) {
        return res.status(400).json({ 
          message: "Account exists with this phone number, but both Name and Password are wrong." 
        });
      }
      
      if (isNameWrong) {
        return res.status(400).json({ 
          message: `Account exists with this phone number, but the Name '${name}' is wrong.` 
        });
      }

      if (isPasswordWrong) {
        return res.status(400).json({ 
          message: "Account exists with this phone number, but the Password is wrong." 
        });
      }
      
      //Update the user.
      await Orders().updateOne(
        { phone },
        { $push: { orders: newOrder } }
      );
      return res.json({ message: "Order added to existing account", userId: user._id });

    } else {
      //NEW ACCOUNT (New Phone number)
      // Create a brand new user document
      const result = await Orders().insertOne({
        name,
        phone,
        password,
        orders: [newOrder]
      });
      return res.json({ message: "New user created & order placed", userId: result.insertedId });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Order failed due to server error." });
  }
});

// Get all orders 
app.get("/orders", async (req, res) => {
  try {
    const usersList = await Orders().find().toArray();

    // Format IDs for frontend usage
    const formattedUsers = usersList.map(user => ({
      ...user,
      _id: user._id.toString(),
      orders: user.orders.map(order => ({
        ...order,
        lessons: Array.isArray(order.lessons) 
          ? order.lessons.map(l => (typeof l === 'object' && l.id) ? { ...l, id: l.id.toString() } : l)
          : order.lessons
      }))
    }));

    res.json(formattedUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching orders" });
  }
});


// ----------------------------
//        SEARCH ROUTE
// ----------------------------

// [Requirement: Backend Search] 
app.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  
  // Create a case-insensitive Regex
  const regex = new RegExp(q, "i");

  // MongoDB Aggregation to search across multiple fields at once
  const results = await Lessons().aggregate([
    {
      // Convert price/spaces to strings
      $addFields: {
        priceStr: { $toString: "$price" },
        spacesStr: { $toString: "$spaces" }
      }
    },
    {
      // [Requirement] Match Query in Topic OR Location OR Price OR Spaces
      $match: {
        $or: [
          { topic: regex },
          { location: regex },
          { priceStr: regex },
          { spacesStr: regex }
        ]
      }
    }
  ]).toArray();

  res.json(results.map(l => ({ 
    ...l, 
    _id: l._id.toString(),
    image: l.image ? `https://talentclub-backend.onrender.com/images/${l.image}` : null 
  })));
});
 
// ----------------------------
//      START SERVER
// ----------------------------
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
});