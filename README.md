<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1EoGgFqQZmyIpQnLccGNr5l5iVJgh4j9o

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Google sign-in setup

Create both Web and native OAuth clients in Google Cloud. In Supabase Auth > Providers > Google, configure the Web client ID and secret. Add these redirect URLs in Supabase Auth URL configuration:

- Web local/dev: `http://localhost:3000/`
- Web production: `https://your-domain.com/`
- GitHub Pages production: `https://saivara1341.github.io/Nexus-Careers/`
- Android app: `com.nexuscareers.platform://auth/callback`

Keep the Google client IDs in `.env.local` using the keys shown in `.env.example`; client secrets must stay in Supabase/Google Cloud, not in the app bundle.
