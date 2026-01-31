import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  let token;

  token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.userId).select('-password');

      if (!req.user) {
        console.log("Auth Failed: User not found for token");
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      console.log(`Auth Success: ${req.user.email}`);
      next();
    } catch (error) {
      console.error('Auth Error:', error.message);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  } else {
    console.log("Auth Failed: No token");
    res.status(401);
    throw new Error('Not authorized, no token');
  }
};

export { protect };
