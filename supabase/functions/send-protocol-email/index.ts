import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

    const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

    // Send email to all recipients
    const { data, error } = await resend.emails.send({
      from: "WBY Möten <send@wby.se>",
      to: recipients,
      subject: subject,
      html: `<p style="white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>`,
      attachments: [
        {
          filename: fileName,
          content: documentBase64,
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(error.message || 'Failed to send email');
    }

    console.log('Email sent successfully:', data);

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
      JSON.stringify({ error: error.message || 'Ett fel uppstod vid skickandet' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
