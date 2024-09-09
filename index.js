const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const authRoute = require("./routes").auth;
const courseRoute = require("./routes").course;
const passport = require("passport");
require("./config/passport")(passport);
const cookieParser = require("cookie-parser");
// 連接mongoDB
mongoose
  .connect("mongodb://127.0.0.1:27017/mernDB ")
  .then(() => {
    console.log("連接到mongoDB");
  })
  .catch((e) => {
    console.log(e);
  });

// cors
const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "DELETE", "PUT"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // 允許使用 credentials
};

//   middlewares

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.use(passport.initialize());
app.use("/api/user", authRoute);
// course應該被jwt保護
// 如果req header內部沒有jwt ，則req就會被視為unauthorized
app.use(
  "/api/courses",
  passport.authenticate("jwt", { session: false }),
  courseRoute
);
app.listen(3005, () => {
  console.log("伺服器已經連線在port 3005");
});
