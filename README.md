## README

### Overview
This project demonstrates how to produce a single post per day (a quote / historical example / short exercise) created by calling the OpenAI API with a clear, stable prompt that captures your intent: encourage mortality awareness with kindness, actionable suggestions, alternation of content types, and supportive tone.

### Principles for the generation prompt (used by the code)
The generator prompt used by the server:

```
You are an assistant building a single short daily item for a public site called "Daily Memento Mori".
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
```

This precise format makes it easy for the frontend to parse and render.

### Security & API keys
Set environment variables (see `.env.example`) and NEVER commit your real `OPENAI_API_KEY` to Git.

### Storage
This starter uses a simple server-side `storage/posts.json` file to save the post generated for each date. On larger projects use a database (Postgres, Supabase, DynamoDB, etc.).

### How it works
- The scheduled job runs a small script that requests the OpenAI API to produce a single day's post using the prompt above.
- The script saves the generated text into `storage/posts.json` under the key `YYYY-MM-DD` (Eastern time date).
- The frontend fetches `/api/post?date=YYYY-MM-DD` (or `/api/post` for today) and renders it beautifully.

---

## .env.example

```.env
OPENAI_API_KEY=sk-...your-key...
PORT=3000
# Optional: STORAGE_PATH=./storage/posts.json
```

---