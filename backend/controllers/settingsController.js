import cloudinary from '../utils/cloudinary.js'
import User from '../models/userModel.js'
import Notification from '../models/notificationModel.js'
import bcryptjs from 'bcryptjs'

export const updateProfile = async(req, res)=>{
    try {
        const userId = req.userId
        const {firstName, lastName, phoneNumber, gender, profilePic} = req.body
    
        const user = await User.findById(userId)
    
        if(!user) return res.status(400).json({message: 'User not found'})
    
        user.firstName = firstName || user.firstName
        user.lastName = lastName || user.lastName
        user.phoneNumber = phoneNumber || user.phoneNumber
        user.gender = gender || user.gender

        if(user.profilePic !== '' && profilePic){
            try {
                const publicId = user.profilePic.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(publicId)
            } catch (error) {
                return res.status(500).json({message: 'Error Deleting Images from Cloudinary'})
            }
        }

        if (profilePic) {
            try {
                const uploaded = await cloudinary.uploader.upload(profilePic, {
                    folder: 'profile_pics',
                });
                user.profilePic = uploaded.secure_url;
            } catch (error) {
                return res.status(500).json({ message: 'Error Uploading Image to Cloudinary' });
            }
        }
    
        await user.save()
    
        return res.status(200).json({message: 'User Profile Updated Successfully'})
    } catch (error) {
        console.log(error)
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const updateBusinessProfile = async(req, res)=>{
    try {
        const userId = req.userId
        const {businessName, businessInformation, address, city, state} = req.body
    
        const user = await User.findById(userId)
    
        if(!user) return res.status(400).json({message: 'User not found'})

        if (!user.businessDetails) {
            user.businessDetails = {};
        }
    
        user.businessDetails.businessName = businessName || user.businessDetails.businessName
        user.businessDetails.businessInformation = businessInformation || user.businessDetails.businessInformation
        user.businessDetails.address = address || user.businessDetails.address
        user.businessDetails.city = city || user.businessDetails.city
        user.businessDetails.state = state || user.businessDetails.state
    
        await user.save()
        res.status(200).json({message: 'Business Profile Updated Successfully'})
    } catch (error) {
        res.status(500).json({message: 'Internal Server Error'})
    }
}

export const addWithdrawalOptions = async(req, res)=>{
    try {
        const userId = req.userId
        const {newOption} = req.body
        const user = await User.findById(userId);
        if (!user) return { success: false, message: 'User not found' };


        const exists = user.withdrawalOptions.some(
            option => option.accountNumber === newOption.accountNumber && option.bankName === newOption.bankName
        );

        if (exists) {
            return res.status(400).json({message: 'Withdrawal Option Already Exists'})
        }

        if (newOption.isDefault) {
            user.withdrawalOptions.forEach(option => (option.isDefault = false));
        }

        user.withdrawalOptions.push(newOption);
        await user.save();

        return res.status(200).json({message: 'Withdrawal Option Added Successfully'})
    } catch (error) {
        console.error('Error adding withdrawal option:', error);
        return res.status(500).json({message: 'Internal Server Error'})
    }
}

export const setDefaultWithdrawalOption = async (req, res) => {
    try {
        const userId = req.userId;
        const { accountNumber, bankName } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        let optionFound = false;

        user.withdrawalOptions.forEach(option => {
            if (option.accountNumber === accountNumber && option.bankName === bankName) {
                option.isDefault = true;
                optionFound = true;
            } else {
                option.isDefault = false;
            }
        });

        if (!optionFound) {
            return res.status(400).json({ message: 'Withdrawal option not found' });
        }

        await user.save();

        return res.status(200).json({ message: 'Default withdrawal option set successfully' });
    } catch (error) {
        console.error('Error setting default withdrawal option:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const deleteWithdrawalOption = async(req, res)=>{
    try {
        const userId = req.userId
        const {accountNumber, bankName} = req.body

        const user = await User.findById(userId);
        if (!user) return res.status(400).json({message: 'User not found'})

        const updatedOptions = user.withdrawalOptions.filter(
            option => !(option.accountNumber === accountNumber && option.bankName === bankName)
        );

        if (updatedOptions.length === user.withdrawalOptions.length) {
            return res.status(400).json({ message: 'Withdrawal option not found' })
        }

        user.withdrawalOptions = updatedOptions;
        await user.save();

        return res.status(200).json({ message: 'Withdrawal option deleted successfully' });
    } catch (error) {
        console.error('Error deleting withdrawal option:', error);
        return res.status(500).json({message: 'Internal Server Error'})
    }
}

export const updateEmailNotificationSettings = async(req, res)=>{
    try {
        const userId = req.userId
        const {updatedNotifications} = req.body
        const user = await User.findById(userId);
        if (!user) return  res.status(400).json({message: 'User not found'})

        user.EmailNotificationSettings = updatedNotifications 
        await user.save();

        return res.status(200).json({ message: 'Email Notification settings updated successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({message: 'Internal Server Error'})
    }
}

export const updateInAppNotificationSettings = async(req, res)=>{
    try {
        const userId = req.userId
        const {updatedNotifications} = req.body
        const user = await User.findById(userId);
        if (!user) return  res.status(400).json({message: 'User not found'})

        user.AppNotificationSettings = updatedNotifications 
        await user.save();

        return res.status(200).json({ message: 'In-App Notification settings updated successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({message: 'Internal Server Error'})
    }
}

export const changePassword = async(req, res)=>{
    try {
        const userId = req.userId
        const {currentPassword, newPassword, confirmPassword} = req.body

        if(newPassword !== confirmPassword){
            return res.status(400).json({message: 'Passwords must match'})
        }
        
        const user = await User.findById(userId)

        if(!user){
            return res.status(400).json({message: 'User not found'})
        }

        const isPasswordValid = await bcryptjs.compare(currentPassword, user.password)

        if(!isPasswordValid){
            return res.status(400).json({ message:'Current Password is Incorrect'})
        }

        const hashedPassword = await bcryptjs.hash(newPassword, 10)

        user.password = hashedPassword

        await user.save()

        await Notification.create({
            userId: user._id,
            title: "Password Changed Successfully",
            message: 'You have successfully changed you password',
            notificationType: 'SETTINGS',
          })

        return res.status(200).json({message: 'Password Changed Successfully'})
    } catch (error) {
        console.log(error.message)
        res.status(500).json({message: 'Internal Server Error'})
    }
}