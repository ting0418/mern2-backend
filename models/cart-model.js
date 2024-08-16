const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cartSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  courses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
});

module.exports = mongoose.model("Cart", cartSchema);
