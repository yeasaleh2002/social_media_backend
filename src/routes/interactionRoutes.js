const express = require("express");
const router = express.Router();
const interactionController = require("../controllers/interactionController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.use(authenticateToken);

router.post("/posts/:postId/comments", interactionController.addComment);
router.get("/posts/:postId/comments", interactionController.getPostComments);

router.post("/likes/toggle", interactionController.toggleLike);

router.get("/posts/:postId/likes", interactionController.getPostLikes);

router.get("/comments/:commentId/likes", interactionController.getCommentLikes);

module.exports = router;
