const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const User = require("../models").user;

module.exports = (passport) => {
  let opts = {};
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
  opts.secretOrKey = process.env.PASSPORT_SECRET;
  passport.use(
    // jwt_payload包含jwt中的所有訊息
    // done用於只是身分驗證結果的callback function
    new JwtStrategy(opts, async function (jwt_payload, done) {
      // console.log("JWT Payload:", jwt_payload);
      try {
        let foundUser = await User.findOne({ _id: jwt_payload._id }).exec();
        if (foundUser) {
          return done(null, foundUser);
        } else {
          return done(null, false);
        }
      } catch (e) {
        return done(e, false);
      }
    })
  );
};
