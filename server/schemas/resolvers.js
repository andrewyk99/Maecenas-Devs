const { AuthenticationError } = require('apollo-server-express');
const { User, Creator, Comment, BlogPost } = require('../models');
const { signToken } = require('../utils/auth');

const resolvers = {
    Query: {
        me: async (parent, args, context) => {
            if (context.user) {
                const user = await User.findById(context.user._id)
                    .select('-__v -password')
                    .populate('comments');
                return user;
            }
            throw new AuthenticationError('Not logged in');
        },
        users: async () => {
            return User.find()
                .select('-__v -password')
                .populate('comments');
        },
        user: async (parent, { username }) => {
            return User.findOne({ username })
                .select('-__v -password')
                .populate('comments');
        },
        creators: async () => {
            return Creator.find()
                .select('-__v')
                .populate('tier1')
                .populate('blogPosts');
        },
        creator: async (parent, { creatorName }) => {
            return Creator.findOne({ creatorName })
                .select('-__v')
                .populate('tier1')
                .populate('blogPosts');
        },
        blogposts: async (parent, { creatorName }) => {
            const params = creatorName ? { creatorName } : {};
            return BlogPost.find(params).sort({ createdAt: -1 });
        },
        blogpost: async (parent, { _id }) => {
            return BlogPost.findById(_id);
        }
    },
    Mutation: {
        addUser: async (parent, args) => {
            const user = await User.create(args);
            const token = signToken(user);

            return { token, user };
        },
        login: async (parent, { email, password }) => {
            const user = await User.findOne({ email });
            if (!user) {
                throw new AuthenticationError('Incorrect credentials');
            }
            const correctPw = await user.isCorrectPassword(password);
            if (!correctPw) {
                throw new AuthenticationError('Incorrect credentials');
            }
            const token = signToken(user);
            return { token, user };
        },
        addCreator: async (parent, args) => {
            const creator = await Creator.create(args);
            return creator;
        },
        addSub: async (parent, { creatorName }, context) => {
            if (context.user) {
                const updatedCreator = await Creator.findOneAndUpdate(
                    { creatorName: creatorName },
                    { $addToSet: { tier1: context.user._id} },
                    { new: true }
                ).populate('tier1');
                return updatedCreator;
            }
            throw new AuthenticationError('You need to be logged in!');
        },
        addBlogPost: async (parent, { creatorName, blogText }) => {
            const blogpost = await BlogPost.create({ creatorName, blogText });
            await Creator.findOneAndUpdate(
                { creatorName: creatorName },
                { $push: { blogPosts: blogpost._id } },
                { new: true, runValidators: true }
            );
            return blogpost;
        },
        addComment: async (parent, { blogId, commentText, username }, context) => {
            if (context.user) {
                const updatedBlogPost = await BlogPost.findOneAndUpdate(
                    { _id: blogId },
                    { $push: { comments: { commentText, username } } },
                    { new: true, runValidators: true }
                );
                return updatedBlogPost;
            }
            throw new AuthenticationError('You need to be logged in!');
        },
        addReply: async (parent, { blogId, commentId, replyText, username }, context) => {
            if (context.user) {
                const updatedBlogPost = await BlogPost.findOneAndUpdate(
                    { _id: blogId },
                    { $push: { 'comments.$[element].replies': { replyText, username } } },
                    { arrayFilters: [{ 'element._id': commentId }], new: true, runValidators: true }
                );
                return updatedBlogPost;
            }
            throw new AuthenticationError('You need to be logged in!');
        }
    }
};

module.exports = resolvers;