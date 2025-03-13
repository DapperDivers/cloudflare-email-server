import nodemailer from 'nodemailer';
import { z } from 'zod';

const EmailRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  message: z.string().min(1, 'Message is required')
});

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail(data: z.infer<typeof EmailRequestSchema>): Promise<EmailResponse> {
    try {
      // Validate input data
      const validatedData = await EmailRequestSchema.parseAsync(data);

      // Prepare email content
      const mailOptions = {
        from: `"${validatedData.name}" <${validatedData.email}>`,
        to: process.env.EMAIL_TO,
        subject: `New Contact Form Submission from ${validatedData.name}`,
        text: validatedData.message,
        html: `<p>${validatedData.message}</p>`
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully'
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors[0].message
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }
} 