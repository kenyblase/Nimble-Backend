import Nodemailer from 'nodemailer'
import { MailtrapTransport } from 'mailtrap';

const Token = process.env.TOKEN

export const transport = Nodemailer.createTransport(
  MailtrapTransport({
    token: Token,
  })
);

 export const sender = {
  address: "mailtrap@demomailtrap.com",
  name: "MarketPlace",
};
