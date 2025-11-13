import Chat from "../models/chatModel.js";
import { io, getReceiverSocketId } from "../utils/socket.js";

export const createChatBetweenBuyerAndSeller = async (buyer, seller, product, order) => {
  let chat = await Chat.findOne({ buyer, seller, product, order: null });

  if (chat) {
    chat.order = order;
    await chat.save();

    const receiverSocketId = getReceiverSocketId(seller.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chatUpdated", chat);
    }

    return chat;
  }

  chat = await Chat.create({ buyer, seller, product, order });

  const receiverSocketId = getReceiverSocketId(seller.toString());
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newChat", chat);
  }

  return chat;
};