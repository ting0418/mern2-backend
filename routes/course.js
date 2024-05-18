const router = require("express").Router();
const Course = require("../models").course;
const courseValidation = require("../validation").courseValidation;
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const passport = require("passport");
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
    console.error("Error creating course:", e);
    return res.status(500).send("無法創建課程");
  }
});
router.post("/joinCourse/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    let course = await Course.findOne({ _id }).exec();
    course.students.push(req.user._id);
    await course.save();
    console.log(_id);
    return res.send({ msg: "註冊完成", students: course.students });
  } catch (e) {
    return res.send(e);
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
