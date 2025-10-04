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

    const systemPrompt = `Du är en erfaren mötessekreterare som skapar DETALJERADE och PROFESSIONELLA mötesprotokoll på svenska.

VIKTIGT: Du måste ALLTID ge ett komplett protokoll, även om transkriptionen är kort eller oklar!

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
- Om inga tydliga beslut finns, tolka vad som diskuterades som potentiella beslutspunkter

Svara ENDAST med JSON i detta format:
{
  "title": "Beskrivande titel baserat på innehållet",
  "summary": "Detaljerad sammanfattning i 3-5 meningar som fångar hela mötet",
  "mainPoints": ["Huvudpunkt 1 med detaljer", "Huvudpunkt 2 med kontext", "Huvudpunkt 3...", "..."],
  "decisions": ["Beslut 1 om det finns", "Beslut 2..."],
  "actionItems": ["Uppgift 1 med ansvarig om möjligt", "Uppgift 2..."]
}

Ge ALDRIG tomma arrayer för mainPoints - det ska alltid finnas minst 3-5 punkter!`;

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
          { role: 'user', content: `Analysera denna mötestranskription noggrant och skapa ett DETALJERAT protokoll:\n\n${transcript}\n\nKom ihåg: Ge ALLTID ett komplett protokoll med minst 3-5 huvudpunkter, även om transkriptionen är kort!` }
        ],
        temperature: 0.7,
        max_tokens: 3000,
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
