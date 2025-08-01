import nodemailer from "nodemailer";
import {
  EMAIL_FROM,
  EMAIL_SERVER_HOST,
  EMAIL_SERVER_PASSWORD,
  EMAIL_SERVER_PORT,
  EMAIL_SERVER_USER,
  NODE_ENV,
} from "./const";

const transporter = nodemailer.createTransport({
  host: EMAIL_SERVER_HOST,
  port: EMAIL_SERVER_PORT,
  secure: true,
  auth: {
    user: EMAIL_SERVER_USER,
    pass: EMAIL_SERVER_PASSWORD,
  },
});

export const sendVerificationEmail = async (
  host: string,
  email: string,
  token: string
) => {
  const confirmLink = `${host}/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Verify your email address",
    html: `<p>Click <a href="${confirmLink}">here</a> to verify your email.</p>`,
  });
};

export const sendOtpEmail = async (email: string, otp: string) => {

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Your One-Time Password",
    html: `<p>Your OTP is: <strong>${otp}</strong></p>`,
  });
};

export const sendMagicLinkEmail = async (host: string, email: string, token: string) => {
  const magicLink = `${host}/auth/verify-token?token=${token}`;
  
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Your Magic Login Link",
    html: `<p>Click <a href="${magicLink}">here</a> to log in.</p>`,
  });
};
