import { sender, transport } from "./mailTrapConfig.js"
import { NEW_OFFER_RECEIVED_TEMPLATE, OFFER_ACCEPTED_TEMPLATE, OFFER_DECLINED_TEMPLATE, OFFER_RESPONSE_TEMPLATE, ORDER_CANCELED_TEMPLATE, ORDER_CONFIRMATION_TEMPLATE, ORDER_DELIVERED_TEMPLATE, ORDER_SHIPPED_TEMPLATE, PASSWORD_RESET_REQUEST_TEMPLATE, 
        PASSWORD_RESET_SUCCESS_TEMPLATE, 
        PAYMENT_PROCESSED_TEMPLATE, 
        VENDOR_ORDER_RECEIVED_TEMPLATE, 
        VERIFICATION_EMAIL_TEMPLATE, 
        VERIFICATION_SUCCESS_TEMPLATE, 
        WITHDRAWAL_PROCESSED_TEMPLATE} from "./emailTemplates.js"
import FormData from "form-data";
import Mailgun from "mailgun.js";

export const sendVerificationEmail = async function(email, name, code) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.API_KEY || "API_KEY",
  });
  try {
      await mg.messages.create("carehubex.com", {
      from: "Idara <postmaster@carehubex.com>",
      to: [`${name} <${email}>`],
      subject: 'Verify Your Email',
      text: `Your Idara verification code is ${code}`,
      html: VERIFICATION_EMAIL_TEMPLATE
      .replace('fullName', name)
      .replace('verificationCode', code)
    });
    
  } catch (error) {
    console.log(error);
  }
}
export const sendWelcomeEmail = async function(email, name) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.API_KEY || "API_KEY",
  });
  try {
      await mg.messages.create("carehubex.com", {
      from: "Idara <postmaster@carehubex.com>",
      to: [`${name} <${email}>`],
      subject: 'Welcome To Idara',
      text: `You have successfully registered on idara`,
      html: VERIFICATION_SUCCESS_TEMPLATE
      .replace('fullName', name)
    });
    
  } catch (error) {
    console.log(error);
  }
}
export const sendPasswordResetEmail = async function(email, name, code) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.API_KEY || "API_KEY",
  });
  try {
      await mg.messages.create("carehubex.com", {
      from: "Idara <postmaster@carehubex.com>",
      to: [`${name} <${email}>`],
      subject: 'Reset Your Password',
      text: `Your Idara password reset code is ${code}`,
      html: PASSWORD_RESET_REQUEST_TEMPLATE
      .replace('fullName', name)
      .replace('resetCode', code)
    });
    
  } catch (error) {
    console.log(error);
  }
}

export const sendResetSuccessEmail = async function(email, name) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.API_KEY || "API_KEY",
  });
  try {
      await mg.messages.create("carehubex.com", {
      from: "Idara <postmaster@carehubex.com>",
      to: [`${name} <${email}>`],
      subject: 'Reset Your Password',
      text: `Your Idara password reset was successful`,
      html: PASSWORD_RESET_SUCCESS_TEMPLATE
      .replace('fullName', name)
    });
    
  } catch (error) {
    console.log(error);
  }
}

//Orders
export const sendOrderConfirmationEmail = async (email, firstName, lastName, orderNumber, totalAmount) => {
    const recipient = [email];

    try {
        const emailHtml = ORDER_CONFIRMATION_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('orderNumber', orderNumber)
            .replace('totalAmount', totalAmount);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Your Order Confirmation",
            html: emailHtml,
            category: "Order Confirmation Email"
        });

        console.log('Order Confirmation Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Order Confirmation Email: ${error}`);
    }
};

export const sendVendorOrderReceivedEmail = async (email, firstName, lastName, productName, quantity, amount, buyerFirstName, buyerLastName) => {
    const recipient = [email];

    try {
        const emailHtml = VENDOR_ORDER_RECEIVED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('productName', productName)
            .replace('quantity', quantity)
            .replace('amount', amount)
            .replace('buyerFirstName', buyerFirstName)
            .replace('buyerLastName', buyerLastName);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "New Order Received",
            html: emailHtml,
            category: "Vendor Order Received Email"
        });

        console.log('Vendor Order Received Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Vendor Order Received Email: ${error}`);
    }
};

export const sendOrderShippedEmail = async (email, firstName, lastName, orderNumber, estimatedDeliveryDate) => {
    const recipient = [email];

    try {
        const emailHtml = ORDER_SHIPPED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('orderNumber', orderNumber)
            .replace('estimatedDeliveryDate', estimatedDeliveryDate)

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Your Order Has Been Shipped",
            html: emailHtml,
            category: "Order Shipped Email"
        });

        console.log('Order Shipped Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Order Shipped Email: ${error}`);
    }
};

export const sendOrderDeliveredEmail = async (email, firstName, lastName, orderNumber, deliveryDate) => {
    const recipient = [email];

    try {
        const emailHtml = ORDER_DELIVERED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('orderNumber', orderNumber)
            .replace('deliveryDate', deliveryDate) 

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Your Order Has Been Delivered",
            html: emailHtml,
            category: "Order Delivered Email"
        });

        console.log('Order Delivered Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Order Delivered Email: ${error}`);
    }
};

export const sendOrderCanceledEmail = async (email, firstName, lastName, orderNumber) => {
    const recipient = [email];

    try {
        const emailHtml = ORDER_CANCELED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('orderNumber', orderNumber);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Your Order Has Been Canceled",
            html: emailHtml,
            category: "Order Canceled Email"
        });

        console.log('Order Canceled Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Order Canceled Email: ${error}`);
    }
};

//Offers
export const sendNewOfferReceivedEmail = async (email, firstName, lastName, productName, offerPrice, message) => {
    const recipient = [email];

    try {
        const emailHtml = NEW_OFFER_RECEIVED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('productName', productName)
            .replace('offerPrice', offerPrice)
            .replace('message', message)

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "New Offer Received!",
            html: emailHtml,
            category: "New Offer Received Email"
        });

        console.log('New Offer Received Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending New Offer Received Email: ${error}`);
    }
};

export const sendVendorOfferResponseEmail = async (email, firstName, lastName, productName, responseMessage, counterOfferPrice) => {
    const recipient = [email];

    try {
        const emailHtml = OFFER_RESPONSE_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('productName', productName)
            .replace('responseMessage', responseMessage)
            .replace('counterOfferPrice', counterOfferPrice);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Response to Your Offer",
            html: emailHtml,
            category: "Offer Response Email"
        });

        console.log('Offer Response Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Offer Response Email: ${error}`);
    }
};

export const sendBuyerOfferResponseEmail = async (email, firstName, lastName, productName, responseMessage, counterOfferPrice) => {
    const recipient = [email];

    try {
        const emailHtml = OFFER_RESPONSE_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('productName', productName)
            .replace('buyerMessage', responseMessage)
            .replace('buyerCounterOfferPrice', counterOfferPrice);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Response to Your Offer",
            html: emailHtml,
            category: "Offer Response Email"
        });

        console.log('Offer Response Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Offer Response Email: ${error}`);
    }
};

export const sendOfferAcceptedEmail = async (email, firstName, lastName, productName, finalPrice) => {
    const recipient = [email];

    try {
        const emailHtml = OFFER_ACCEPTED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('productName', productName)
            .replace('finalPrice', finalPrice);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Your Offer Has Been Accepted!",
            html: emailHtml,
            category: "Offer Accepted Email"
        });

        console.log('Offer Accepted Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Offer Accepted Email: ${error}`);
    }
};

export const sendOfferDeclinedEmail = async (email, firstName, lastName, productName, declineReason) => {
    const recipient = [email];

    try {
        const emailHtml = OFFER_DECLINED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('productName', productName)
            .replace('declineReason', declineReason);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Your Offer Was Declined",
            html: emailHtml,
            category: "Offer Declined Email"
        });

        console.log('Offer Declined Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Offer Declined Email: ${error}`);
    }
};

//payments and withdrawals
export const sendPaymentProcessedEmail = async (email, firstName, lastName, amount, paymentMethod, transactionId) => {
    const recipient = [email];

    try {
        const emailHtml = PAYMENT_PROCESSED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('amount', amount)
            .replace('paymentMethod', paymentMethod)
            .replace('transactionId', transactionId);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Payment Processed Successfully",
            html: emailHtml,
            category: "Payment Processed Email"
        });

        console.log('Payment Processed Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Payment Processed Email: ${error}`);
    }
};

export const sendWithdrawalProcessedEmail = async (email, firstName, lastName, amount, bankName, accountNumber, transactionId) => {
    const recipient = [email];

    try {
        const emailHtml = WITHDRAWAL_PROCESSED_TEMPLATE
            .replace('firstName', firstName)
            .replace('lastName', lastName)
            .replace('amount', amount)
            .replace('bankName', bankName)
            .replace('accountNumber', accountNumber)
            .replace('transactionId', transactionId);

        const response = await transport.sendMail({
            from: sender,
            to: recipient,
            subject: "Withdrawal Processed Successfully",
            html: emailHtml,
            category: "Withdrawal Processed Email"
        });

        console.log('Withdrawal Processed Email Sent Successfully', response);
    } catch (error) {
        console.error(`Error sending Withdrawal Processed Email: ${error}`);
    }
};