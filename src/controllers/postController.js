const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

exports.createPost = async (req, res) => {
  try {
    const { content, imageUrl, privacy } = req.body;
    const authorId = req.user.id;

    if (!content) {
      return res
        .status(400)
        .json({ success: false, data: null, error: "Content is required." });
    }

    const post = await prisma.post.create({
      data: {
        content,
        imageUrl,
        privacy: privacy || "PUBLIC",
        authorId,
      },
    });

    res.status(201).json({
      success: true,
      data: { message: "Post created successfully", post },
      error: null,
    });
  } catch (error) {
    console.error("Create Post Error:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "An error occurred while creating the post.",
    });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const userId = req.user.id;
    const take = parseInt(limit, 10);

    const queryOptions = {
      take: take + 1,
      where: {
        OR: [{ privacy: "PUBLIC" }, { authorId: userId }],
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        content: true,
        imageUrl: true,
        privacy: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId },
          select: { id: true },
        },
        comments: {
          orderBy: {
            createdAt: "desc",
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
            likes: {
              where: {
                userId,
              },
              select: {
                id: true,
              },
            },
            _count: {
              select: {
                likes: true,
              },
            },
          },
        },
      },
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
    }

    const posts = await prisma.post.findMany(queryOptions);

    let nextCursor = null;
    if (posts.length > take) {
      const nextItem = posts.pop();
      nextCursor = nextItem.id;
    }

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      privacy: post.privacy,
      createdAt: post.createdAt,
      author: post.author,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      hasLiked: post.likes.length > 0,
      comments: post.comments.map((c) => ({
        id: c.id,
        content: c.content,
        parentId: c.parentId,
        createdAt: c.createdAt,
        author: c.author,
        likeCount: c._count.likes,
        hasLiked: c.likes.length > 0,
      })),
    }));

    res.status(200).json({
      success: true,
      data: { posts: formattedPosts, nextCursor },
      error: null,
    });
  } catch (error) {
    console.error("Get Feed Error:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "An error occurred while fetching the feed.",
    });
  }
};
