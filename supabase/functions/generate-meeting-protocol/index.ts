import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('Meeting protocol generator initialized');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No transcript provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Generating protocol with Lovable AI...');

    const systemPrompt = `Du är en erfaren mötessekreterare som skapar DETALJERADE och PROFESSIONELLA mötesprotokoll på svenska.

VIKTIGT: Du måste ALLTID ge ett komplett protokoll, även om transkriptionen är kort!

Din uppgift:
1. Skapa en BESKRIVANDE titel (max 60 tecken) baserat på vad som diskuterades
2. Skriv en GRUNDLIG sammanfattning i 3-5 meningar som fångar essensen av mötet
3. Identifiera 5-10 huvudpunkter som diskuterades (var generös och analysera noggrant)
4. Leta efter och dokumentera ALLA beslut som fattades
5. Identifiera och lista ALLA uppgifter eller action items som nämndes

REGLER:
- Även om transkriptionen är kort, analysera den noggrant och skapa ett meningsfullt protokoll
- Var kreativ och tolka innehållet professionellt
- Om något är otydligt, gör en kvalificerad tolkning
- Skapa ALLTID minst 3-5 huvudpunkter, även från korta diskussioner
- Om inga tydliga beslut finns, tolka vad som diskuterades som potentiella beslutspunkter`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analysera denna mötestranskription noggrant och skapa ett DETALJERAT protokoll:\n\n${transcript}\n\nKom ihåg: Ge ALLTID ett komplett protokoll med minst 3-5 huvudpunkter, även om transkriptionen är kort!` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_meeting_protocol",
              description: "Skapa ett strukturerat mötesprotokoll",
              parameters: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Beskrivande titel baserat på innehållet (max 60 tecken)"
                  },
                  summary: {
                    type: "string",
                    description: "Detaljerad sammanfattning i 3-5 meningar"
                  },
                  mainPoints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista med 5-10 huvudpunkter från mötet"
                  },
                  decisions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Beslut som fattades under mötet"
                  },
                  actionItems: {
                    type: "array",
                    items: { type: "string" },
                    description: "Uppgifter och action items som ska genomföras"
                  }
                },
                required: ["title", "summary", "mainPoints", "decisions", "actionItems"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_meeting_protocol" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Full AI response:', JSON.stringify(data, null, 2));
    
    const toolCall = data.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const protocol = JSON.parse(toolCall.function.arguments);
    console.log('Extracted protocol:', protocol);

    return new Response(
      JSON.stringify({ protocol }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in generate-meeting-protocol:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate protocol';
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
