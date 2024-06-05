const router = require("express").Router();
const { registerValidation } = require("../validation");
const { loginValidation } = require("../validation");
const User = require("../models").user;
const jwt = require("jsonwebtoken");

router.use((req, res, next) => {
  console.log("正在接收一個跟auth有關的請求");
  next();
});

router.get("/testAPI", (req, res) => {
  return res.send("成功連結auth route..");
});

router.post("/register", async (req, res) => {
  console.log(registerValidation(req.body));
  // 確認數據是否符合規範
  let { error } = registerValidation(req.body);
  if (error) return res.status(400).send(error.details[0].message);
  // 確認信箱是否被註冊過
  const emailExist = await User.findOne({ email: req.body.email });
  if (emailExist) return res.send("此信箱已經被註冊過了");
  // 上述都沒問題就可以被註冊
  let { email, username, password, role } = req.body;
  // 建立新使用者
  let newUser = new User({ email, username, password, role });
  try {
    let savedUser = await newUser.save();
    return res.send({
      msg: "使用者成功儲存",
      saveUser: savedUser,
    });
  } catch (e) {
    return res.status(500).send("無法儲存使用者");
  }
});

router.post("/login", async (req, res) => {
  let { error } = loginValidation(req.body);
  // if (error) return res.status(400).send(error.details[0].message);

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
