const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const checkPostAccess = async (postId, userId) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, privacy: true, authorId: true },
  });

  if (!post) throw new Error("NOT_FOUND");
  if (post.privacy === "PRIVATE" && post.authorId !== userId) {
    throw new Error("FORBIDDEN");
  }
  return post;
};

exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res
        .status(400)
        .json({ success: false, data: null, error: "Content is required." });
    }

    try {
      await checkPostAccess(postId, userId);
    } catch (e) {
      if (e.message === "NOT_FOUND")
        return res
          .status(404)
          .json({ success: false, data: null, error: "Post not found." });
      if (e.message === "FORBIDDEN")
        return res.status(403).json({
          success: false,
          data: null,
          error: "Access denied to this post.",
        });
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parentComment || parentComment.postId !== postId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Invalid parent comment.",
        });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        authorId: userId,
        parentId: parentId || null,
      },
      select: {
        id: true,
        content: true,
        parentId: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const formattedComment = {
      id: comment.id,
      content: comment.content,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      author: comment.author,
      likeCount: 0,
      hasLiked: false,
    };

    res.status(201).json({
      success: true,
      data: { message: "Comment added successfully", comment: formattedComment },
      error: null,
    });
  } catch (error) {
    console.error("Add Comment Error:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "An error occurred while adding the comment.",
    });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const { postId, commentId } = req.body;
    const userId = req.user.id;

    if (!postId && !commentId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Must provide either postId or commentId.",
      });
    }
    if (postId && commentId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Provide only one: postId or commentId.",
      });
    }

    if (postId) {
      try {
        await checkPostAccess(postId, userId);
      } catch (e) {
        if (e.message === "NOT_FOUND")
          return res
            .status(404)
            .json({ success: false, data: null, error: "Post not found." });
        if (e.message === "FORBIDDEN")
          return res.status(403).json({
            success: false,
            data: null,
            error: "Access denied to this post.",
          });
      }

      const existingLike = await prisma.postLike.findUnique({
        where: { userId_postId: { userId, postId } },
      });

      if (existingLike) {
        await prisma.postLike.delete({ where: { id: existingLike.id } });
        return res.status(200).json({
          success: true,
          data: { message: "Post unliked successfully", liked: false },
          error: null,
        });
      } else {
        await prisma.postLike.create({ data: { userId, postId } });
        return res.status(200).json({
          success: true,
          data: { message: "Post liked successfully", liked: true },
          error: null,
        });
      }
    }

    if (commentId) {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
      });
      if (!comment)
        return res
          .status(404)
          .json({ success: false, data: null, error: "Comment not found." });

      try {
        await checkPostAccess(comment.postId, userId);
      } catch (e) {
        if (e.message === "FORBIDDEN")
          return res
            .status(403)
            .json({ success: false, data: null, error: "Access denied." });
      }

      const existingLike = await prisma.commentLike.findUnique({
        where: { userId_commentId: { userId, commentId } },
      });

      if (existingLike) {
        await prisma.commentLike.delete({ where: { id: existingLike.id } });
        return res.status(200).json({
          success: true,
          data: { message: "Comment unliked successfully", liked: false },
          error: null,
        });
      } else {
        await prisma.commentLike.create({ data: { userId, commentId } });
        return res.status(200).json({
          success: true,
          data: { message: "Comment liked successfully", liked: true },
          error: null,
        });
      }
    }
  } catch (error) {
    console.error("Toggle Like Error:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "An error occurred while toggling the like.",
    });
  }
};

exports.getPostLikes = async (req, res) => {
  try {
    const { postId } = req.params;
    const { cursor, limit = 10 } = req.query;
    const userId = req.user.id;
    const take = parseInt(limit, 10);

    try {
      await checkPostAccess(postId, userId);
    } catch (e) {
      if (e.message === "NOT_FOUND")
        return res
          .status(404)
          .json({ success: false, data: null, error: "Post not found." });
      if (e.message === "FORBIDDEN")
        return res
          .status(403)
          .json({ success: false, data: null, error: "Access denied." });
    }

    const queryOptions = {
      take: take + 1,
      where: { postId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    };
    if (cursor) queryOptions.cursor = { id: cursor };

    const likes = await prisma.postLike.findMany(queryOptions);

    let nextCursor = null;
    if (likes.length > take) {
      const nextItem = likes.pop();
      nextCursor = nextItem.id;
    }

    res.status(200).json({
      success: true,
      data: { users: likes.map((l) => l.user), nextCursor },
      error: null,
    });
  } catch (error) {
    console.error("Get Post Likes Error:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "An error occurred while fetching post likes.",
    });
  }
};

exports.getCommentLikes = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { cursor, limit = 10 } = req.query;
    const userId = req.user.id;
    const take = parseInt(limit, 10);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment)
      return res
        .status(404)
        .json({ success: false, data: null, error: "Comment not found." });

    try {
      await checkPostAccess(comment.postId, userId);
    } catch (e) {
      if (e.message === "FORBIDDEN")
        return res
          .status(403)
          .json({ success: false, data: null, error: "Access denied." });
    }

    const queryOptions = {
      take: take + 1,
      where: { commentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    };
    if (cursor) queryOptions.cursor = { id: cursor };

    const likes = await prisma.commentLike.findMany(queryOptions);

    let nextCursor = null;
    if (likes.length > take) {
      const nextItem = likes.pop();
      nextCursor = nextItem.id;
    }

    res.status(200).json({
      success: true,
      data: { users: likes.map((l) => l.user), nextCursor },
      error: null,
    });
  } catch (error) {
    console.error("Get Comment Likes Error:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "An error occurred while fetching comment likes.",
    });
  }
};
