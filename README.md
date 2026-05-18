This is a Next.js App Router demo: an “Einstein house” foyer with Meshy‑backed generation, an edit canvas for placing GLBs, and a strict walk mode.

### Meshy API

Put your Meshy key in `.env.local` as `MESHY_API_KEY` (see [.env.example](.env.example)). Route handlers under `app/api/meshy/**` relay requests so the key never reaches the browser. Generated GLBs on `*.meshy.ai` are streamed through `/api/models/proxy` so the viewer can load them same-origin.

### Reference folder

If you keep a **`3d-house/`** vendor or sample tree in this repo root, TypeScript excludes it (`tsconfig.json`) so Next’s checker only sees this app.

## Getting Started


First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
