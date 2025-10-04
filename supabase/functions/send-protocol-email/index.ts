import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  recipients: string[];
  subject: string;
  message: string;
  documentBase64: string;
  fileName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, message, documentBase64, fileName }: EmailRequest = await req.json();

    console.log('Sending email to:', recipients);

    // Decode base64 document
    const documentBuffer = Uint8Array.from(atob(documentBase64), c => c.charCodeAt(0));

    // Configure SMTP client for iCloud
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.mail.me.com",
        port: 587,
        tls: true,
        auth: {
          username: "send@wby.se",
          password: Deno.env.get('SMTP_PASSWORD') as string,
        },
      },
    });

    // Send email to each recipient
    for (const recipient of recipients) {
      await client.send({
        from: "send@wby.se",
        to: recipient,
        subject: subject,
        content: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
        attachments: [
          {
            filename: fileName,
            content: documentBuffer,
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            encoding: "binary",
          },
        ],
      });
      console.log(`Email sent successfully to: ${recipient}`);
    }

    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email skickades till ${recipients.length} mottagare` 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-protocol-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
