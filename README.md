# Walkies

A 3D dog-care game for families. Log walks, do the nightly check-in, put your dog in its crate, and see who treats the dog best.

## Deploy to Vercel

The `walkies` folder is the finished site. It is plain static files, so it needs no build step.

1. Install the Vercel CLI once: `npm i -g vercel`
2. Open a terminal in the `walkies` folder.
3. Run `vercel --prod` and accept the defaults.
4. Copy the URL Vercel prints (for example `https://walkies-xyz.vercel.app`).

You can also drag the `walkies` folder onto https://vercel.com/new instead of using the CLI.

## Connect Supabase to your Vercel URL

The site already points at your Supabase project **walkies** (`oeaglkibntsovfezpqgo`). Do this once after the first deploy:

1. Open https://supabase.com/dashboard/project/oeaglkibntsovfezpqgo/auth/url-configuration
2. Set **Site URL** to your Vercel URL.
3. Under **Redirect URLs**, add your Vercel URL followed by `/**`.

## Turn on Google sign-in

1. Go to https://console.cloud.google.com/apis/credentials and create an **OAuth client ID** of type **Web application**.
2. Under **Authorized redirect URIs**, add `https://oeaglkibntsovfezpqgo.supabase.co/auth/v1/callback`
3. Copy the client ID and the client secret.
4. Open https://supabase.com/dashboard/project/oeaglkibntsovfezpqgo/auth/providers, open **Google**, turn it on, and paste both values.

Until Google sign-in is on, "Email me a sign-in link" works on its own.

## Your existing dog

Camper's data from the Claude version is already in Supabase. After you sign in, enter the pack code **CAMPER**. Then go to Family and click **That's me** next to "Palash" so your earlier walks count for your account.

## Edit the code

The source is in `walkies-source`. Run `npm install`, edit the files in `src/`, then run `npm run build`. The build writes the new `public/app.js`. Copy `public/` over the `walkies` folder and deploy again.
