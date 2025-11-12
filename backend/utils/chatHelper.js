import Chat from "../models/chatModel.js";
import { io, getReceiverSocketId } from "../utils/socket.js";

export const createChatBetweenBuyerAndSeller = async (buyer, seller, product, order) => {
  let chat = await Chat.findOne({ buyer, seller, product, order });
  if (!chat) {
    chat = await Chat.create({ buyer, seller, product, order });
  } else if (!chat.order) {
    chat.order = order;
    await chat.save();
  }

  const receiverId = seller.toString();
  const receiverSocketId = getReceiverSocketId(receiverId);

  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newChat", chat);
  }

  return chat;
};
