import Message from "../models/messageModel.js";
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import cloudinary from '../utils/cloudinary.js'
import { getReceiverSocketId, io } from '../utils/socket.js';

export const startChat = async (req, res) => {
  const user1Id = req.userId
  const {user2Id} = req.body
  try {
    let chat = await Message.findOne({ users: { $all: [user1Id, user2Id] } });
  
    if (chat) {
      if (chat.deletedBy.includes(user1Id)) {
        chat.deletedBy = chat.deletedBy.filter((id) => id.toString() !== user1Id);
        await chat.save();
      }
      return res.status(200).json({chat})
    }
  
    chat = await Message.create({ users: [user1Id, user2Id], messages: [] });
    return res.status(200).json({chat})
  } catch (error) {
    res.status(500).json({message: error.message})
  }
};

export const getUserChats = async (req, res) => {
  try {
    const userId = req.userId
    const userChats = await Message.find({
      users: userId,
      deletedBy: { $ne: userId },
    }).populate('users', 'name role');
  
    return res.status(200).json({userChats}) 
  } catch (error) {
    res.status(500).json({message: error.message})
  }
}

export const sendMessage = async (req, res) => {
  const {chatId, text, image} = req.body
  const senderId = req.userId

  try {
    const chat = await Message.findById(chatId);
    if (!chat) throw new Error('Chat not found');

    const sender = await User.findById(senderId)
  
    if (chat.deletedBy.includes(senderId)) {
      chat.deletedBy = chat.deletedBy.filter((id) => id.toString() !== senderId);
    }

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      try {
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
      } catch (error) {
        console.log(error)
        return res.status(500).json({message: error.message})
      }
    }
  
    const newMessage = { sender: senderId, text, image: imageUrl }
    chat.messages.push(newMessage)
    await chat.save();

    const recipients = chat.users.filter(id => id.toString() !== senderId); // Exclude sender

    const notifications = recipients.map(recipientId=>({
      userId: recipientId,
      title: 'New Message',
      message: `You have received a new message from ${sender.firstName} ${sender.lastName}`,
      notificationType: 'CHATS',
      metadata:{chatId}
    }))

    await Notification.create(notifications)

    recipients.forEach(recipientId => {
      const recipientSocketId = getReceiverSocketId(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("newMessage", newMessage);
      }
    });
  
    return res.status(201).json({status: 'success', chat});
  } catch (error) {
    res.status(500).json({message: error.message})
  }
};

export const softDeleteChat = async (req, res) => {
  const {chatId} = req.body
  const userId = req.userId

  try {
    const chat = await Message.findById(chatId);
    if (!chat) throw new Error('Chat not found');
  
    if (chat.deletedBy.includes(userId)) {
      return { message: 'Chat already deleted for this user' };
    }
  
    chat.deletedBy.push(userId);
    await chat.save();
  
    await hardDeleteIfBothUsersDeleted(chatId);
  
    return res.status(200).json({ message: 'Chat deleted for this user' });
    
  } catch (error) {
    res.status(500).json({message: error.message})
  }

};

export const markChatAsAppealed = async(req, res)=>{
  const { chatId } = req.body
  const userId = req.userId

  try {
    const chat = await Message.findById(chatId)
  
    if(!chat) return res.status(400).json({message: "Chat Not Found"})

    if(!chat.users.includes(userId)) return res.status(400).json({message: 'Only chat participants can appeal'})

    chat.hasAppealed = true

    const admins = await User.find({role: 'ADMIN'})

    admins.forEach(admin=>{
      chat.users.push(admin._id)
      chat.admin.push(admin._id)
    })

    await chat.save()

    return res.status(200).json({message: "Chat has been appealed - Admin will join the chat soon"})
  } catch (error) {
    console.log(error)
    return res.status(500).json({message: 'Internal Server Error'})
  }
}

const hardDeleteIfBothUsersDeleted = async (chatId) => {
  try {
    const chat = await Message.findById(chatId);
    if (!chat) return;
  
    if (chat.deletedBy.length === chat.users.length) {
      const imageUrls = chat.messages
      .filter(msg => msg.image)
      .map(msg => msg.image);

      const deleteImagePromises = imageUrls.map(async (imageUrl) => {
      try {
          const publicId = imageUrl.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(publicId);
      } catch (error) {
          console.error('Error deleting image from Cloudinary:', error);
          return res.status(500).json({message: 'Error deleting Images from cloudinary'})
      }});

      await Promise.all(deleteImagePromises);

      await Message.findByIdAndDelete(chatId);
    }  
  } catch (error) {
    res.status(500).json({message: error.message})
  }
};