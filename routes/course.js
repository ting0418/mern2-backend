const router = require("express").Router();
const Course = require("../models").course;
const Cart = require("../models").cart;
const courseValidation = require("../validation").courseValidation;
const express = require("express");
const app = express();
const crypto = require("crypto");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const { user } = require("../models");
require("../config/passport")(passport);
app.use(cookieParser());
router.use((req, res, next) => {
  console.log("course route正在接收一個request");
  next();
});
router.get("/", async (req, res) => {
  // populate為mongoose內的方法，可以根據id來找到關於這個id的個人資料
  try {
    let courseFind = await Course.find({})
      .populate("instructor", ["_id", "username", "email"])
      .exec();
    return res.send(courseFind);
  } catch (e) {
    return res.status(500).send(e);
  }
});

router.get("/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    let courseFound = await Course.findOne({ _id })
      .populate("instructor", ["email"])
      .exec();
    return res.send(courseFound);
  } catch (e) {
    res.status(500).send(e);
  }
});

router.post("/", async (req, res) => {
  try {
    // 驗證數據符合規範
    const { error } = courseValidation(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }
    console.log("req.user:" + req.user);
    // 檢查用戶是否是講師
    if (req.user.isStudent()) {
      return res.status(400).send("只有講師才能發布課程");
    }

    // 創建新的課程
    const { title, description, price } = req.body;
    const newCourse = new Course({
      title,
      description,
      price,
      instructor: req.user._id,
    });

    // 儲存新的課程到資料庫中
    const savedCourse = await newCourse.save();

    return res.send({ msg: "新課程已保存", savedCourse });
  } catch (e) {
    // console.error("Error creating course:", e);
    return res.status(500).send("無法創建課程");
  }
});
router.post("/joinCourse/:_id", async (req, res) => {
  let { _id } = req.params;
  const userId = req.user._id;

  try {
    const course = await Course.findById(_id);
    if (!course) {
      return res.status(404).send({ error: "找不到該課程" });
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, courses: [] });
    }

    if (cart.courses.includes(_id)) {
      return res.status(400).send({ error: "課程已在購物車中" });
    }

    cart.courses.push(_id);
    await cart.save();
    console.log("加入購物車:", cart);

    return res.status(200).send({ message: "課程已加入購物車" });
  } catch (error) {
    console.error("加入購物車失敗:", error);
    return res.status(500).send({ error: "加入購物車失敗" });
  }
});

// 確認是否有購買過此課程
router.post("/check-enrollment", async (req, res) => {
  const userId = req.user._id;
  const { courseId } = req.body;

  try {
    //  先找此課程
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).send({ error: "未找到課程" });
    }

    // 检查用戶是否有買過
    const enrolled = course.students.includes(userId);

    // 返回是否購買過此課程
    return res.status(200).send({ enrolled });
  } catch (error) {
    console.error("檢查報名狀態失敗:", error);
    return res.status(500).send({ error: "檢查報名狀態失敗" });
  }
});

// 結帳路由
// router.post("/checkout", async (req, res) => {
//   const userId = req.user._id;

//   try {
//     const { cart, totalAmount } = req.body;

//     if (!cart || cart.length === 0) {
//       return res.status(400).send({ error: "購物車為空" });
//     }

//     // 計算來自後端的實際總金額
//     let calculatedTotal = 0;
//     const updatedCourses = await Promise.all(
//       cart.map(async (courseId) => {
//         const course = await Course.findById(courseId);
//         if (!course) {
//           console.error(`Course ${courseId} not found`);
//           return null;
//         }

//         calculatedTotal += course.price; // 累加每個課程的價格

//         // 檢查該課程是否已在用戶的學生列表中
//         if (course.students.includes(userId)) {
//           return res.status(500).send("已經報名過此課程了喔");
//         } else {
//           course.students.push(userId);
//           await course.save();
//         }

//         return course;
//       })
//     );

//     // 檢查總金額是否匹配
//     if (calculatedTotal !== totalAmount) {
//       return res.status(400).send("總金額不匹配");
//     }

//     return res.status(200).send({ message: "結帳成功", updatedCourses });
//   } catch (error) {
//     console.error("結帳失敗:", error.data);
//     return res.status(500).send("結帳失敗");
//   }
// });
router.post("/checkout", async (req, res) => {
  const userId = req.user._id;

  try {
    const { cart, totalAmount } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).send({ error: "購物車為空" });
    }

    // 計算後端實際總金額
    let calculatedTotal = 0;
    const coursesToUpdate = [];
    const updatedCourses = await Promise.all(
      cart.map(async (courseId) => {
        const course = await Course.findById(courseId);
        if (!course) {
          console.error(`課程 ${courseId} 不存在`);
          return null;
        }

        calculatedTotal += course.price;

        if (course.students.includes(userId)) {
          throw new Error("您已經報名過此課程");
        } else {
          coursesToUpdate.push(course); // 收集需要更新的課程
        }

        return course;
      })
    );

    if (calculatedTotal !== totalAmount) {
      return res.status(400).send("總金額不匹配");
    }

    // 准備 LINE Pay 請求
    const channelId = process.env.LINE_PAY_CHANNEL_ID;
    const channelSecret = process.env.LINE_PAY_CHANNEL_SECRET;
    const nonce = crypto.randomUUID();
    const requestUrl = process.env.LINE_PAY_SITE;

    const paymentData = {
      amount: totalAmount,
      currency: "TWD",
      orderId: `order_${new Date().getTime()}`,
      packages: [
        {
          id: "package_1",
          amount: totalAmount,
          name: "購物車訂單",
          products: cart.map((course) => ({
            name: course.title,
            quantity: 1,
            price: course.price,
          })),
        },
      ],
      redirectUrls: {
        confirmUrl: process.env.LINE_PAY_RETURN_CONFIRM_URL,
        cancelUrl: process.env.LINE_PAY_RETURN_CANCEL_URL,
      },
    };
    const rawSignature = `${channelSecret}/${requestUrl}/${JSON.stringify(
      paymentData
    )}/${nonce}`;
    const signature = crypto
      .createHmac("sha256", channelSecret)
      .update(rawSignature)
      .digest("base64");

    console.log(nonce);
    console.log(signature);

    const linePayResponse = await axios.post(requestUrl, paymentData, {
      headers: {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": channelId,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": signature,
      },
    });

    console.log("LINE Pay Response:", linePayResponse.data);
    const paymentInfo = linePayResponse.data;

    // 只在 LINE Pay 返回成功後才更新課程
    await Promise.all(
      coursesToUpdate.map(async (course) => {
        course.students.push(userId);
        await course.save();
      })
    );

    return res.status(200).send({
      message: "重定向到 LINE Pay",
      redirectUrl: paymentInfo.info.paymentUrl.web, // 使用此 URL 導向 LINE Pay
    });
  } catch (error) {
    console.error("結帳失敗:", error.message);

    // 如果發生錯誤，記得回滾已經進行的操作（如未保存課程資料）
    return res.status(500).send("結帳失敗");
  }
});

// 更改課程

router.patch("/:_id", async (req, res) => {
  // 驗證數據是否符合規範
  let { error } = courseValidation(req.body);
  if (error) return res.status(400).send(error.details[0].message);
  let { _id } = req.params;

  try {
    let courseFound = await Course.findOne({ _id });
    if (!courseFound) {
      return res.status(400).send("找不到課程");
    }
    if (courseFound.instructor.equals(req.user._id)) {
      //  更新課程
      let updatedCourse = await Course.findOneAndUpdate({ _id }, req.body, {
        new: true,
        runValidators: true,
      });
      return res.send({
        msg: "課程已經被更新成功",
        updatedCourse,
      });
    } else {
      return res.status(403).send("必須要是此課程講師才可以更改課程");
    }
  } catch (e) {}
});
router.delete("/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    // 先確認課程是否存在
    let courseFound = await Course.findOne({ _id }).exec();
    if (!courseFound) {
      return res.status(404).send("找不到此課程，請再試一次");
    }
    // 檢查是否有權限刪除課程
    if (courseFound.instructor.equals(req.user._id)) {
      await Course.deleteOne({ _id }).exec();
      return res.status(200).send("課程已被刪除");
    } else {
      return res.status(403).send("您無權刪除此課程");
    }
  } catch (e) {
    res.status(500).send(e.message);
  }
});
module.exports = router;
