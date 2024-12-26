const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");

require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ error: true, message: "unauthorized" });
  }
  jwt.verify(token, process.env.JWT_PRIVET_KEY, (error, decoded) => {
    if (error) {
      return res.status(401).send({ error: true, message: "unauthorized" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASSWORD}@cluster0.yrhbvyy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("mobile-shop").collection("users");
    const productsCollection = client.db("mobile-shop").collection("products");

    const verifySeller = async (req, res, next) => {
      const decoded = req.decoded;
      const user = await usersCollection.findOne({ email: decoded.email });
      if (!user) {
        return res.status(404).send({ error: true, message: "user no found" });
      }
      if (user.role === "Seller") {
        next();
      } else {
        return res.status(401).send({ error: true, message: "unauthorized" });
      }
    };
    const verifyAdmin = async (req, res, next) => {
      const decoded = req.decoded;
      const user = await usersCollection.findOne({ email: decoded.email });
      if (!user) {
        return res.status(404).send({ error: true, message: "user no found" });
      }
      if (user.role === "Admin") {
        next();
      } else {
        return res.status(401).send({ error: true, message: "unauthorized" });
      }
    };
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/getMe", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const result = await usersCollection.findOne({
        email,
      });
      res.send(result);
    });
    app.post("/product", verifyJWT, verifySeller, async (req, res) => {
      const data = req.body;
      const result = await productsCollection.insertOne(data);
      return result;
    });
    app.get("/product", async (req, res) => {
      const { title, category, brand, sort } = req.query;
      // Build the query object
      const query = {};
      if (title) {
        query.title = { $regex: title, $options: "i" };
      }
      if (category) {
        query.category = { $regex: category, $options: "i" };
      }
      if (brand) {
        query.brand = { $regex: brand, $options: "i" };
      }

      // Define sort options
      let sortOptions = {};
      if (sort === "price_asc") {
        sortOptions.price = 1; // Ascending order
      } else if (sort === "price_desc") {
        sortOptions.price = -1; // Descending order
      }

      // Fetch data from the database
      const products = await productsCollection
        .find(query)
        .sort(sortOptions)
        .toArray();

      res.send(products);
    });
    app.delete("/product/:id", verifyJWT, verifySeller, async (req, res) => {
      const { id } = req.params;
      const token = req.headers.authorization;
      console.log(token);
      const result = await productsCollection.findOneAndDelete({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    app.patch("/product/:id", verifyJWT, verifySeller, async (req, res) => {
      const data = req.body;
      const { id } = req.params;
      const result = await productsCollection.findOneAndUpdate(
        {
          _id: new ObjectId(String(id)),
        },
        {
          $set: { ...data },
        }
      );
      res.send(result);
    });
    app.get("/product/:id", async (req, res) => {
      const { id } = req.params;
      const result = await productsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    app.post("/add-wishlist", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const { id } = req.body;
      const user = await usersCollection.findOne({
        email,
        wishlist: { $elemMatch: { $eq: id } },
      });

      if (user) {
        return res.status(400).send({
          success: false,
          message: "Product is already in the wishlist.",
        });
      }
      const result = await usersCollection.findOneAndUpdate(
        { email },
        { $push: { wishlist: id } }
      );
      res.send(result);
    });
    app.get("/wishlist", verifyJWT, async (req, res) => {
      const email = req.decoded.email;

      try {
        // Find the user's wishlist
        const user = await usersCollection.findOne({ email });
        if (!user || !user.wishlist) {
          return res
            .status(404)
            .json({ success: false, message: "Wishlist not found" });
        }

        // Perform a lookup to fetch products based on wishlist IDs
        const wishlistProducts = await productsCollection
          .aggregate([
            {
              $match: {
                _id: {
                  $in: user.wishlist.map((id) => new ObjectId(String(id))),
                },
              },
            },
          ])
          .toArray();

        res.status(200).json(wishlistProducts);
      } catch (error) {
        console.error("Error fetching wishlist products:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch wishlist products",
        });
      }
    });
    app.patch("/delete-wishlist", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const { id } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user || !user.wishlist) {
        return res
          .status(404)
          .json({ success: false, message: "Wishlist not found" });
      }
      const result = await usersCollection.findOneAndUpdate(
        { email },
        { $pull: { wishlist: id } }
      );
      res.send(result);
    });

    app.post("/user", async (req, res) => {
      const { email } = req.body;
      const data = {};
      const isExist = await usersCollection.findOne({ email });
      data.wishlist = [];
      if (isExist) {
        (data.email = isExist.email), (data.role = isExist.role);
      } else {
        data.email = email;
        data.role = "User";
        await usersCollection.insertOne(data);
      }
      const token = jwt.sign(data, process.env.JWT_PRIVET_KEY, {
        expiresIn: "1d",
      });
      res.send({ token });
    });
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.patch("/role-change/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const result = await usersCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...data } }
      );
      res.send(result);
    });
    app.delete("/user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await usersCollection.findOneAndDelete({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", async (req, res) => {
  res.send("hello");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
