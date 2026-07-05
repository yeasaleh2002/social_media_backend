const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.use(authenticateToken);

router.post("/posts", postController.createPost);
router.get("/feed", postController.getFeed);

module.exports = router;
