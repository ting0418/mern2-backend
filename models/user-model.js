const mongoose = require("mongoose");
const { Schema } = mongoose;
const bcrypt = require("bcrypt");
const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50,
  },
  email: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 50,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: ["student", "instructor"],
  },
  date: {
    type: Date,
    default: Date.now,
  },
});
// instance methods
userSchema.methods.isStudent = function () {
  return this.role == "student";
};
userSchema.methods.isInstructor = function () {
  return this.role == "instructor";
};

userSchema.methods.comparePassword = async function (password, cb) {
  //  第一個password是登入的密碼，第二個是經過hash後的密碼
  let result;
  try {
    result = await bcrypt.compare(password, this.password);
    return cb(null, result);
  } catch (e) {
    return cb(e, result);
  }
};

// mongoose middlewares
// 若使用者為新用戶，或者是正在更改密碼，則將密碼進行雜湊處理
userSchema.pre("save", async function (next) {
  // mongoose的屬性
  if (this.isNew || this.isModified("password")) {
    // 將密碼進行雜湊處理
    const hashValue = await bcrypt.hash(this.password, 10);
    this.password = hashValue;
  }
  next();
});
module.exports = mongoose.model("User", userSchema);
