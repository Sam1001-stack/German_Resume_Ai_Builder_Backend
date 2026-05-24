declare module "nodemailer" {
  interface Transporter {
    sendMail(options: unknown): Promise<unknown>;
  }

  interface Nodemailer {
    createTransport(options: unknown): Transporter;
  }

  const nodemailer: Nodemailer;
  export default nodemailer;
}
