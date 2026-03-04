import nodemailer from "nodemailer";
import {
  EMAIL_FROM,
  EMAIL_SERVER_HOST,
  EMAIL_SERVER_PASSWORD,
  EMAIL_SERVER_PORT,
  EMAIL_SERVER_USER,
  APPLICATION_HOST,
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

export const sendVerificationEmail = async (email: string, token: string) => {
  const confirmLink = `${APPLICATION_HOST}/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Verify your email address",
    html: `
      <p>Click <a href="${confirmLink}">here</a> to verify your email address.</p>
      <p>This link is valid for <strong>1 hour</strong>.</p>
      <p>
        <strong>Link expired?</strong> No worries — you don't need to re-register.
        Just go to the <a href="${APPLICATION_HOST}/auth/login">login page</a> and sign in using
        <strong>OTP</strong> or <strong>Magic Link</strong>. Both methods will automatically
        verify your email on first use.
      </p>
    `,
  });
};

export const sendOtpEmail = async (email: string, otp: string) => {
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Your One-Time Password",
    html: `<p>Your OTP is: <strong>${otp}</strong><br>Valid for 10 minutes.</p>`,
  });
};

export const sendMagicLinkEmail = async (email: string, token: string) => {
  const magicLink = `${APPLICATION_HOST}/auth/verify-token?token=${token}`;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Your Magic Login Link",
    html: `<p>Click <a href="${magicLink}">here</a> to log in.<br>Valid for 10 minutes.</p>`,
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetLink = `${APPLICATION_HOST}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Reset Your Password",
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password.<br>Valid for 1 hour.</p>`,
  });
};
