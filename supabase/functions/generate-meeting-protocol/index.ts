// Groq AI Meeting Protocol Generator
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

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    console.log('Generating protocol with Groq AI...');

    const systemPrompt = `Du är en professionell mötessekreterare som skapar strukturerade mötesprotokoll på svenska. 
Analysera transkriptionen och extrahera:
1. En kort, beskrivande titel för mötet (max 60 tecken)
2. En sammanfattning i 2-3 meningar
3. 3-7 huvudpunkter som diskuterades
4. Eventuella beslut som fattades (om några)
5. Action items med ansvarig person om möjligt att identifiera

Svara ENDAST med en JSON-struktur enligt detta format:
{
  "title": "Kort beskrivande titel",
  "summary": "Sammanfattning av mötet",
  "mainPoints": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "decisions": ["Beslut 1", "Beslut 2"],
  "actionItems": ["Uppgift 1 - Ansvarig: Namn", "Uppgift 2 - Ansvarig: Namn"]
}

Om inga beslut eller action items finns, använd tomma arrayer.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analysera denna mötestranskription:\n\n${transcript}` }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);

    // Parse the JSON response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }

    const protocol = JSON.parse(jsonMatch[0]);

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
