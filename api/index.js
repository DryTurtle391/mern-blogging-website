const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const app = express();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const salt = bcrypt.genSaltSync(10);
const secret = "sfaVJVJHvbkhjhjkhv";

app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect(process.env.MONGO_URL);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(400).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("IN API ", username, password);

  try {
    const userDoc = await User.findOne({ username });
    console.log("IN API ", username, password);

    const passOk = bcrypt.compareSync(password, userDoc.password);

    if (passOk) {
      //Logged in
      jwt.sign({ username, id: userDoc._id }, secret, {}, (error, token) => {
        if (error) throw error;
        res.cookie("token", token).json({
          id: userDoc._id,
          username,
        });
      });
    } else {
      res.status(400).json("Incorrect credentials");
    }
  } catch (e) {
    res.status(400).json(e);
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (error, info) => {
    if (error) throw error;
    res.json(info);
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.post("/post", uploadMiddleware.single("file"), (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;
  const { title, summary, content } = req.body;
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (error, info) => {
    if (error) throw error;
    try {
      fs.renameSync(path, newPath);
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
      });
      res.json(postDoc);
    } catch (e) {
      res.status(400).json(e);
    }
  });
});

app.get("/post", (req, res) => {
  Post.find()
    .populate("author", ["username"])
    .sort({ createdAt: -1 })
    .limit(20)
    .then((posts) => {
      res.json(posts);
    });
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    newPath = path + "." + ext;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (error, info) => {
    if (error) throw error;

    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);

    if (!isAuthor) {
      res.status(400).json("You ain't the author");
    }

    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });
});

if (process.env.API_PORT) {
  app.listen(process.env.API_PORT);
}

module.exports = app;

//mongodb+srv://binayakway:HOH5ZpJR8tbLsfbx@cluster0.nfuthdr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
