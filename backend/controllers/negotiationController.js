import Negotiation from '../models/negotiationModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Notification from '../models/notificationModel.js';
import { sendBuyerOfferResponseEmail, sendNewOfferReceivedEmail, sendOfferAcceptedEmail, sendOfferDeclinedEmail, sendVendorOfferResponseEmail } from '../mailTrap/emails.js';

export const createNegotiation = async (req, res) => {
    const buyerId = req.userId;
    const { vendorId, productId, priceProposed } = req.body;

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(400).json({ message: 'Product not found' });
        }

        if(product.isNegotiable !== true){
            return res.status(400).json({message: 'This product has a fixed price'})
        }

        const negotiation = new Negotiation({
            buyer: buyerId,
            vendor: vendorId,
            product: productId,
            // history: [{
            //     priceProposed,
            //     message,
            //     status: 'proposed',
            //     respondedBy: buyerId
            // }],
            currentPrice: priceProposed
        });

        await negotiation.save();

        const user = await User.findById(buyerId)
        if(!user) return res.status(400).json({message: 'User Not Found'})

        const vendor = await User.findById(vendorId)
        if(!vendor) return res.status(400).json({message: 'User Not Found'})

        if(user.AppNotificationSettings.includes('OFFERS')){
            await Notification.create({
                userId: buyerId,
                title: "Offer Sent Successfully",
                message: 'You have successfully sent an offer',
                notificationType: 'OFFERS',
                metadata: {negotiationId: negotiation._id}
              })
        }

        if(vendor.AppNotificationSettings.includes('OFFERS')){
            await Notification.create({
                userId: vendorId,
                title: "Offer Sent Successfully",
                message: 'You just received a new offer',
                notificationType: 'OFFERS',
                metadata: {negotiationId: negotiation._id}
              })
        }

        if(vendor.EmailNotificationSettings.includes('OFFERS')){
            sendNewOfferReceivedEmail(vendor.email, vendor.firstName, vendor.lastName, product.name, priceProposed, message)
        }

        return res.status(201).json({ message: 'Negotiation created successfully', negotiation });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// export const respondToNegotiation = async (req, res) => {
//     const { negotiationId } = req.params;
//     const { priceProposed, message } = req.body;

//     try {
//         const negotiation = await Negotiation.findById(negotiationId);

//         if (!negotiation) {
//             return res.status(404).json({ message: 'Negotiation not found' });
//         }

//         const isVendor = negotiation.vendor.toString() === req.userId;
//         const isBuyer = negotiation.buyer.toString() === req.userId;

//         if (!isVendor && !isBuyer) {
//             return res.status(403).json({ message: 'You are not authorized to respond to this negotiation' });
//         }

//         negotiation.history.push({
//             priceProposed,
//             message,
//             status: 'countered',
//             respondedBy: req.userId,
//         });

//         negotiation.currentPrice = priceProposed;

//         await negotiation.save();

//         const user = await User.findById(negotiation.buyer)
//         if(!user) return res.status(400).json({message: 'User Not Found'})

//         const vendor = await User.findById(negotiation.vendor)
//         if(!vendor) return res.status(400).json({message: 'User Not Found'})

//         const currentUser = isVendor ? vendor : user
//         const otherUser = isVendor ? user : vendor

//         if(otherUser.AppNotificationSettings.includes('OFFERS')){
//             await Notification.create({
//                 userId: isVendor ? negotiation.buyer : negotiation.vendor,
//                 title: "Counter Offer Received",
//                 message: 'You just received a new counter offer',
//                 notificationType: 'OFFERS',
//                 metadata: {negotiationId: negotiation._id}
//             })
//         }

//         if(currentUser.AppNotificationSettings.includes()){
//             await Notification.create({
//                 userId: isVendor ? negotiation.vendor : negotiation.buyer,
//                 title: "Counter Offer Sent",
//                 message: 'You just sent a new counter offer',
//                 notificationType: 'OFFERS',
//                 metadata: {negotiationId: negotiation._id}
//             })
//         }

//         const product = await Product.findById(negotiation.product)
//         if(!product) return res.status(400).json({message: "product not found"})

//         if(otherUser.EmailNotificationSettings.includes('OFFERS')){
//             if(isVendor){
//                 sendVendorOfferResponseEmail(otherUser.email, otherUser.firstName, otherUser.lastName, product.name, message, priceProposed)
//             }else{
//                 sendBuyerOfferResponseEmail(otherUser.email, otherUser.firstName, otherUser.lastName, product.name, message, priceProposed)
//             }
//         }

//         return res.status(200).json({ message: 'Counteroffer submitted successfully', negotiation });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ message: 'Internal server error' });
//     }
// };

export const acceptNegotiation = async (req, res) => {
    const { negotiationId } = req.params;

    try {
        const negotiation = await Negotiation.findById(negotiationId);

        if (!negotiation) {
            return res.status(404).json({ message: 'Negotiation not found' });
        }

        const isVendor = negotiation.vendor.toString() === req.userId;

        if(!isVendor){
            return res.status(404).json({ message: 'Only vendor can accept offer' });
        }

        // if (negotiation.history.length > 0) {
        //     const lastResponse = negotiation.history[negotiation.history.length - 1];
        //     if (lastResponse.respondedBy.toString() === req.userId) {
        //         return res.status(400).json({ message: "You cannot accept an offer that you last responded to." });
        //     }
        // }

        // negotiation.history.push({
        //     priceProposed: negotiation.currentPrice,
        //     message: 'Offer accepted',
        //     status: 'accepted',
        //     respondedBy: req.userId,
        // });

        negotiation.negotiationStatus = 'completed';

        await negotiation.save();

        const user = await User.findById(negotiation.buyer)
        if(!user) return res.status(400).json({message: 'User Not Found'})

        const vendor = await User.findById(negotiation.vendor)
        if(!vendor) return res.status(400).json({message: 'User Not Found'})

        const currentUser = isVendor ? vendor : user
        const otherUser = isVendor ? user : vendor

        if(currentUser.AppNotificationSettings.includes('OFFERS')){
            await Notification.create({
                userId: isVendor ? negotiation.vendor : negotiation.buyer,
                title: "Offer Accepted",
                message: 'You have successfully accepted an offer',
                notificationType: 'OFFERS',
                metadata: {negotiationId: negotiation._id}
            })
        }

        if(otherUser.AppNotificationSettings.includes('OFFERS')){
            await Notification.create({
                userId: isVendor ? negotiation.buyer : negotiation.vendor,
                title: "Offer Accepted",
                message: 'Your offer has been accepted',
                notificationType: 'OFFERS',
                metadata: {negotiationId: negotiation._id}
            })
        }

        const product = await Product.findById(negotiation.product)
        if(!product) return res.status(400).json({message: "product not found"})

        if(otherUser.EmailNotificationSettings.includes('OFFERS')){
            sendOfferAcceptedEmail(otherUser.email, otherUser.firstName, otherUser.lastName, product.name, negotiation.currentPrice)
        }

        return res.status(200).json({ message: 'Negotiation accepted successfully', negotiation });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const cancelNegotiation = async (req, res) => {
    const { negotiationId } = req.params;
    const {declineReason} = req.body

    try {
        const negotiation = await Negotiation.findById(negotiationId);

        if (!negotiation) {
            return res.status(404).json({ message: 'Negotiation not found' });
        }

        const isVendor = negotiation.vendor.toString() === req.userId;

        if(!isVendor){
            return res.status(404).json({ message: 'Only Vendors can cancel negotiations' });
        }

        negotiation.negotiationStatus = 'canceled';
        await negotiation.save();

        const user = await User.findById(negotiation.buyer)
        if(!user) return res.status(400).json({message: 'User Not Found'})

        const vendor = await User.findById(negotiation.vendor)
        if(!vendor) return res.status(400).json({message: 'User Not Found'})

        const currentUser = isVendor ? vendor : user
        const otherUser = isVendor ? user : vendor

        if(otherUser.AppNotificationSettings.includes('OFFERS')){
            await Notification.create({
                userId: isVendor ? negotiation.buyer : negotiation.vendor,
                title: "Offer Declined",
                message: 'Your offer has been declined',
                notificationType: 'OFFERS',
                metadata: {negotiationId: negotiation._id}
            })
        }

        if(currentUser.AppNotificationSettings.includes('OFFERS')){
            await Notification.create({
                userId: isVendor ? negotiation.vendor : negotiation.buyer,
                title: "Offer Declined",
                message: 'You have successfully declined an offer',
                notificationType: 'OFFERS',
                metadata: {negotiationId: negotiation._id}
            })
        }

        const product = await Product.findById(negotiation.product)
        if(!product) return res.status(400).json({message: "product not found"})

        if(otherUser.EmailNotificationSettings.includes('OFFERS')){
            sendOfferDeclinedEmail(otherUser.email, otherUser.firstName, otherUser.lastName, product.name, declineReason || 'NONE')
        }

        return res.status(200).json({ message: 'Negotiation canceled successfully', negotiation });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

export const getNegotiationsByUser = async (req, res) => {
    const  userId  = req.userId

    try {
        const negotiations = await Negotiation.find({
            $or: [{ buyer: userId }, { vendor: userId }]
        })
            .populate('product', 'name price')
            .populate('buyer', 'firstName lastName')
            .populate('vendor', 'firstName lastName');

        return res.status(200).json({ negotiations });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};