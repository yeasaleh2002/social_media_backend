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
          where: {
            parentId: null,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 6,
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
            replies: {
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
                replies: {
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

    const formattedPosts = posts.map((post) => {
      const flatComments = [];
      post.comments.forEach((c) => {
        flatComments.push({
          id: c.id,
          content: c.content,
          parentId: c.parentId,
          createdAt: c.createdAt,
          author: c.author,
          likeCount: c._count.likes,
          hasLiked: c.likes.length > 0,
        });
        if (c.replies) {
          c.replies.forEach((r1) => {
            flatComments.push({
              id: r1.id,
              content: r1.content,
              parentId: r1.parentId,
              createdAt: r1.createdAt,
              author: r1.author,
              likeCount: r1._count.likes,
              hasLiked: r1.likes.length > 0,
            });
            if (r1.replies) {
              r1.replies.forEach((r2) => {
                flatComments.push({
                  id: r2.id,
                  content: r2.content,
                  parentId: r2.parentId,
                  createdAt: r2.createdAt,
                  author: r2.author,
                  likeCount: r2._count.likes,
                  hasLiked: r2.likes.length > 0,
                });
              });
            }
          });
        }
      });

      return {
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        privacy: post.privacy,
        createdAt: post.createdAt,
        author: post.author,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
        hasLiked: post.likes.length > 0,
        comments: flatComments,
      };
    });

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
