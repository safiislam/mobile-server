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
  console.log(token);
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

const { MongoClient, ServerApiVersion } = require("mongodb");
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

    // app.post("/user", async (req, res) => {
    //   const data = req.body;
    //   const result = await usersCollection.insertOne(data);
    //   return result;
    // });
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.post("/product", async (req, res) => {
      const data = req.body;
      const result = await productsCollection.insertOne(data);
      return result;
    });
    app.get("/product", async (req, res) => {
      const { title, category, brand, sort } = req.query;

      // Build the query object
      const query = {};
      if (title) {
        query.title = { $regex: title, $options: "i" }; // Case-insensitive search
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

    app.post("/user", async (req, res) => {
      const { email } = req.body;
      const data = {};
      const isExist = await usersCollection.findOne({ email });
      data.wishlist = [];
      if (isExist) {
        (data.email = isExist.email), (data.role = isExist.role);
      } else {
        data.email = email;
        data.role = "user";
        await usersCollection.insertOne(data);
      }
      const token = jwt.sign(data, process.env.JWT_PRIVET_KEY, {
        expiresIn: "1d",
      });
      res.send({ token });
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
