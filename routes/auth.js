const router = require("express").Router();
const { registerValidation } = require("../validation");
const { loginValidation } = require("../validation");
const crypto = require("crypto");
const User = require("../models").user;
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
router.use((req, res, next) => {
  console.log("正在接收一個跟auth有關的請求");
  next();
});

router.get("/testAPI", (req, res) => {
  return res.send("成功連結auth route..");
});

// router.post("/register", async (req, res) => {
//   console.log(registerValidation(req.body));
//   // 確認數據是否符合規範
//   let { error } = registerValidation(req.body);
//   if (error) return res.status(400).send(error.details[0].message);
//   // 確認名稱是否被註冊過
//   const nameExist = await User.findOne({ username: req.body.username });
//   if (nameExist) return res.status(400).send("此名稱已經被註冊過了");
//   // 確認信箱是否被註冊過
//   const emailExist = await User.findOne({ email: req.body.email });
//   if (emailExist) return res.status(400).send("此信箱已經被註冊過了");
//   // 上述都沒問題就可以被註冊
//   let { email, username, password, role } = req.body;
//   // 建立新使用者
//   let newUser = new User({ email, username, password, role });
//   try {
//     let savedUser = await newUser.save();
//     return res.send({
//       msg: "使用者成功儲存",
//       saveUser: savedUser,
//     });
//   } catch (e) {
//     return res.status(500).send("無法儲存使用者");
//   }
// });

// 設置 Nodemailer 配置
const transporter = nodemailer.createTransport({
  service: "Gmail", // 使用 Gmail 或其他郵件服務
  auth: {
    user: "yy65carry@gmail.com",
    pass: "xahbkgdvflcshopx",
  },
});

router.post("/register", async (req, res) => {
  let { error } = registerValidation(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const nameExist = await User.findOne({ username: req.body.username });
  if (nameExist) return res.status(400).send("此名稱已經被註冊過了");

  const emailExist = await User.findOne({ email: req.body.email });
  if (emailExist) return res.status(400).send("此信箱已經被註冊過了");

  let { email, username, password, role } = req.body;

  // 生成驗證令牌
  const verificationToken = crypto.randomBytes(32).toString("hex");

  // 儲存使用者及其驗證令牌
  let newUser = new User({
    email,
    username,
    password,
    role,
    verificationToken,
  });
  try {
    let savedUser = await newUser.save();

    // 發送驗證信
    const verificationLink = "http://localhost:3000/verification";
    const mailOptions = {
      from: "yy65carry@gmail.com",
      to: email,
      subject: "網站驗證信",
      text: `請驗證您的帳戶並且點選連結驗證: ${verificationLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).send("無法發送驗證郵件");
      }
      console.log("Email sent:", info.response);
      return res.send({
        msg: "使用者成功儲存，請檢查你的郵件以驗證你的帳號。",
        saveUser: savedUser,
      });
    });
  } catch (e) {
    return res.status(500).send("無法儲存使用者");
  }
});

router.get("/verify/:token", async (req, res) => {
  const { token } = req.params;

  try {
    // 查找具有該驗證令牌的用戶
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).send("無效的驗證令牌");

    // 更新用戶狀態以顯示已驗證
    user.isVerified = true;
    user.verificationToken = null; // 清除驗證令牌
    await user.save();

    // 重定向到驗證成功頁面
    res.redirect("http://localhost:3000/verification-success");
  } catch (error) {
    res.status(500).send("驗證過程中出錯");
  }
});

router.post("/login", async (req, res) => {
  let { error } = loginValidation(req.body);
  if (error) return res.status(400).send(error.details[0].message);
  const foundUser = await User.findOne({ email: req.body.email });
  if (!foundUser) {
    return res.status(401).send("沒有此用戶，請確認信箱是否正確");
  }
  if (!req.body.password) return res.status(400).send("請輸入密碼");
  // 確認信箱是否被註冊過
  foundUser.comparePassword(req.body.password, (err, isMatch) => {
    if (err) return res.status(500).send(err);
    if (isMatch) {
      // 製作jwt
      const tokenObject = { _id: foundUser._id, email: foundUser.email };
      // 製作token 第一個放在jwt的資料，第二個放金鑰 第三個放過期時間(選填)
      const token = jwt.sign(tokenObject, process.env.PASSPORT_SECRET);
      return res.send({
        msg: "成功登入",
        token: "Bearer " + token,
        user: foundUser,
      });
    } else {
      return res.status(401).send("密碼有誤，請重新再試一次");
    }
  });
});
router.post("/logout", (req, res) => {
  // 清除Cookie
  res.clearCookie("token");

  res.status(200).send("登出成功");
});

module.exports = router;
