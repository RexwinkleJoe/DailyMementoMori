const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// This script can be run manually or by a scheduler.
// It calls the same OpenAI prompt and saves to storage/posts.json

const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve('./storage/posts.json');
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Make sure the secret is properly configured in GitHub Actions');
    process.exit(1);
}

console.log('✅ OPENAI_API_KEY found and loaded from environment');

async function callOpenAI(prompt) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful generator.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7
        })
    });
    
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${errorText}`);
    }
    
    const j = await res.json();
    return j.choices?.[0]?.message?.content ?? '';
}

function ensureStorage() {
    const dir = path.dirname(STORAGE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(STORAGE_PATH)) {
        fs.writeFileSync(STORAGE_PATH, JSON.stringify({}), 'utf8');
    }
}

function parseGenerated(text) {
    // Expecting the strict format from the prompt. We'll parse defensively.
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const out = { type: '', title: '', body: '', takeaway: '' };
    
    for (const ln of lines) {
        if (ln.toLowerCase().startsWith('type:')) {
            out.type = ln.split(':')[1].trim();
        } else if (ln.toLowerCase().startsWith('title:')) {
            out.title = ln.split(':')[1].trim();
        } else if (ln.toLowerCase().startsWith('body:')) {
            out.body = ln.split(':')[1].trim();
        } else if (ln.toLowerCase().startsWith('takeaway:')) {
            out.takeaway = ln.split(':')[1].trim();
        } else {
            // append to body if body already exists and no new field
            if (out.body && !out.takeaway) {
                out.body += '\n' + ln;
            }
        }
    }
    return out;
}

async function main() {
    try {
        ensureStorage();
        
        // Get today's date in America/New_York
        const now = new Date();
        const parts = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
        const ny = new Date(parts);
        const yyyy = ny.getFullYear();
        const mm = String(ny.getMonth() + 1).padStart(2, '0');
        const dd = String(ny.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        
        // Read existing posts
        const storeRaw = fs.readFileSync(STORAGE_PATH, 'utf8');
        const store = JSON.parse(storeRaw || '{}');
        
        // Check if post already exists for today
        if (store[key]) {
            console.log(`Post already exists for ${key}`);
            console.log('Existing post:', JSON.stringify(store[key], null, 2));
            return;
        }
        
        // Determine next type based on last saved entry
        const dates = Object.keys(store).sort();
        let nextType = 'Quote';
        if (dates.length > 0) {
            const lastDate = dates[dates.length - 1];
            const lastType = store[lastDate]?.type || '';
            if (lastType === 'Quote') nextType = 'Historical Example';
            else if (lastType === 'Historical Example') nextType = 'Exercise';
            else nextType = 'Quote';
        }
        
        const prompt = `You are an assistant building a single short daily item for a public site called "Daily Memento Mori".

Requirements:
- Produce exactly one piece of content (no numbered lists) in plain text with three fields separated by a blank line: a) type (Quote / Historical Example / Exercise), b) title on one line, c) body of 2-5 sentences (concise, kind, encouraging action or reflection), and finally d) a 1- to 2-sentence "Takeaway" line starting with "Takeaway: ".
- Alternate type each day in the order: Quote, Historical Example, Exercise, repeating.
- Keep total length <= 300 words.
- Use accessible language and avoid morbid or graphic imagery. Aim for gentle urgency: remind of mortality but encourage meaningful, compassionate action.
- If you include a quote, either use a public-domain quote, attribute it, or synthesize a short aphorism prefaced by "Attributed: " if not a real historical quote.
- For historical examples, prefer short historical facts or cultural practices that illustrate impermanence.

Format output exactly like:

Type: <Quote|Historical Example|Exercise>
Title: <one-line title>
Body: <2-5 sentences>
Takeaway: <1-2 sentences>

End.

Force Type: ${nextType}`;

        console.log(`Generating ${nextType} for ${key}...`);
        const generated = await callOpenAI(prompt);
        console.log('Generated content:', generated);
        
        const parsed = parseGenerated(generated);
        parsed.date = key;
        
        // Save to storage
        store[key] = parsed;
        fs.writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2), 'utf8');
        
        console.log(`Saved post for ${key}:`);
        console.log(JSON.stringify(parsed, null, 2));
        
    } catch (err) {
        console.error('Error generating post:', err);
        process.exit(1);
    }
}

main();
